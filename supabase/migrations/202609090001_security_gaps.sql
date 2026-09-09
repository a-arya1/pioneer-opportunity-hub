-- Atomic server-side caps: changing a caller-supplied session ID cannot bypass
-- the site-wide hourly, daily and monthly budgets. No IP addresses are stored.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.write_budgets(
  scope text not null,
  bucket timestamptz not null,
  used integer not null,
  primary key(scope,bucket)
);
revoke all on private.write_budgets from public,anon,authenticated;
alter table private.write_budgets enable row level security;

create or replace function private.consume_budget(p_scope text,p_bucket timestamptz,p_max integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  insert into private.write_budgets as b(scope,bucket,used) values(p_scope,p_bucket,1)
  on conflict(scope,bucket) do update set used=b.used+1 where b.used<p_max;
  if not found then raise sqlstate 'P0001' using message='Too many requests. Please try again later.'; end if;
end;
$$;
revoke all on function private.consume_budget(text,timestamptz,integer) from public,anon,authenticated;

create or replace function private.limit_public_write(p_scope text,p_session text,p_hour integer,p_day integer,p_month integer,p_caller integer)
returns void language plpgsql security definer set search_path='' as $$
declare utc_now timestamptz:=now();
  caller text:=coalesce(auth.uid()::text,p_session);
begin
  -- Acquire global buckets in a consistent order. All increments roll back if
  -- any validation or limit fails; concurrent callers serialize on these rows.
  perform private.consume_budget(p_scope||':month',date_trunc('month',utc_now at time zone 'utc') at time zone 'utc',p_month);
  perform private.consume_budget(p_scope||':day',date_trunc('day',utc_now at time zone 'utc') at time zone 'utc',p_day);
  perform private.consume_budget(p_scope||':hour',date_trunc('hour',utc_now at time zone 'utc') at time zone 'utc',p_hour);
  perform private.consume_budget(p_scope||':caller:'||caller,date_trunc('day',utc_now at time zone 'utc') at time zone 'utc',p_caller);
end;
$$;
revoke all on function private.limit_public_write(text,text,integer,integer,integer,integer) from public,anon,authenticated;

create or replace function public.record_impact_event(
  p_event_name text,
  p_session_id text,
  p_opportunity_id text default null,
  p_coarse_page text default null,
  p_category text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_event_name is null or p_event_name not in (
    'site_visit','page_view','opportunity_view','opportunity_saved',
    'official_source_click','magic_link_requested'
  ) then
    raise exception 'Unsupported impact event' using errcode='22023';
  end if;

  if p_session_id is null or p_session_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Invalid anonymous session' using errcode='22023';
  end if;

  if p_coarse_page is not null and p_coarse_page not in (
    'home','opportunity-directory','opportunity-detail','saved',
    'sign-in','impact','information'
  ) then
    raise exception 'Unsupported page category' using errcode='22023';
  end if;

  perform private.limit_public_write('analytics',p_session_id,120,1000,20000,100);

  insert into public.analytics_events(
    pseudonymous_id,event_name,opportunity_id,coarse_page,category,event_day
  ) values (
    p_session_id,
    p_event_name,
    left(nullif(p_opportunity_id,''),120),
    p_coarse_page,
    null,
    (now() at time zone 'utc')::date
  ) on conflict do nothing;
end;
$$;

revoke all on function public.record_impact_event(text,text,text,text,text) from public;
grant execute on function public.record_impact_event(text,text,text,text,text) to anon, authenticated;

create or replace function public.submit_feedback(
  p_session_id text,
  p_audience text,
  p_helpfulness integer,
  p_ease integer,
  p_would_recommend boolean,
  p_missing text default null,
  p_comments text default null,
  p_consent boolean default false
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_consent is not true then raise exception 'Consent required' using errcode='22023'; end if;
  if p_session_id is null or p_session_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Invalid anonymous session' using errcode='22023';
  end if;
  if p_audience is null or p_audience not in ('student','counselor','educator','parent','community') then
    raise exception 'Unsupported audience' using errcode='22023';
  end if;
  if p_helpfulness is null or p_ease is null or p_would_recommend is null or p_helpfulness not between 1 and 5 or p_ease not between 1 and 5 then
    raise exception 'Ratings must be between 1 and 5' using errcode='22023';
  end if;
  if length(coalesce(p_missing,''))>500 or length(coalesce(p_comments,''))>1500 then
    raise exception 'Feedback is too long' using errcode='22023';
  end if;

  perform private.limit_public_write('feedback',p_session_id,20,100,1000,3);
  insert into public.feedback_submissions(
    pseudonymous_id,audience,helpfulness,ease,would_recommend,missing_text,comments,feedback_day
  ) values (
    p_session_id::uuid,p_audience,p_helpfulness,p_ease,p_would_recommend,
    nullif(trim(p_missing),''),nullif(trim(p_comments),''),(now() at time zone 'utc')::date
  ) on conflict (pseudonymous_id,feedback_day) do update set
    audience=excluded.audience,helpfulness=excluded.helpfulness,ease=excluded.ease,
    would_recommend=excluded.would_recommend,missing_text=excluded.missing_text,
    comments=excluded.comments,created_at=now();
end;
$$;

revoke all on function public.submit_feedback(text,text,integer,integer,boolean,text,text,boolean) from public;
grant execute on function public.submit_feedback(text,text,integer,integer,boolean,text,text,boolean) to anon, authenticated;

create or replace function public.submit_directory_request(
  p_session_id text,
  p_kind text,
  p_opportunity_id text,
  p_name text,
  p_evidence_url text,
  p_details text,
  p_confirmed boolean default false
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_confirmed is not true then raise exception 'Confirmation required' using errcode='22023'; end if;
  if p_session_id is null or p_session_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Invalid anonymous session' using errcode='22023';
  end if;
  if p_kind is null or p_kind not in ('new','correction','expired','claim','missing-club') then
    raise exception 'Unsupported request type' using errcode='22023';
  end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 160 or length(trim(coalesce(p_details,''))) not between 20 and 2000 then
    raise exception 'Invalid report length' using errcode='22023';
  end if;
  if p_evidence_url is not null and trim(p_evidence_url)<>'' and trim(p_evidence_url) !~* '^https://[^[:space:]]+$' then
    raise exception 'Evidence must use HTTPS' using errcode='22023';
  end if;
  if p_kind='new' and nullif(trim(coalesce(p_evidence_url,'')),'') is null then
    raise exception 'An official source is required' using errcode='22023';
  end if;

  perform private.limit_public_write('reports',p_session_id,20,100,1000,5);

  if p_kind in ('correction','expired') then
    insert into public.change_requests(opportunity_id,proposed_changes,evidence,requester_user_id,moderation_state,pseudonymous_id,request_day)
    values (
      left(nullif(trim(p_opportunity_id),''),120),
      jsonb_build_object('kind',p_kind,'name',trim(p_name),'details',trim(p_details)),
      left(nullif(trim(p_evidence_url),''),500),auth.uid(),'pending',p_session_id::uuid,(now() at time zone 'utc')::date
    ) on conflict do nothing;
  else
    insert into public.submissions(submitter_user_id,submitter_role,organization_name,proposed_data,evidence_url,moderation_status,pseudonymous_id,request_day)
    values (
      auth.uid(),'community',trim(p_name),jsonb_build_object('kind',p_kind,'details',trim(p_details)),
      left(nullif(trim(p_evidence_url),''),500),'pending',p_session_id::uuid,(now() at time zone 'utc')::date
    ) on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.submit_directory_request(text,text,text,text,text,text,boolean) from public;
grant execute on function public.submit_directory_request(text,text,text,text,text,text,boolean) to anon, authenticated;


-- Cleanup runs independently of visits. Keep the public promise accurate:
-- records older than 12 months are removed on the next daily run.
create or replace function private.cleanup_expired_records()
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.analytics_events where created_at < now()-interval '12 months';
  delete from public.feedback_submissions where created_at < now()-interval '12 months';
  delete from public.submissions where created_at < now()-interval '12 months';
  delete from public.change_requests where created_at < now()-interval '12 months';
  delete from private.write_budgets where bucket < now()-interval '35 days';
end;
$$;
revoke all on function private.cleanup_expired_records() from public,anon,authenticated;
create extension if not exists pg_cron;
select cron.schedule('poh-daily-privacy-cleanup','17 4 * * *','select private.cleanup_expired_records();');
commit;
