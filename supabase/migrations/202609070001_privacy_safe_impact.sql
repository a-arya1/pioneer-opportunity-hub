-- Aggregate, consent-based impact measurement. Raw events remain inaccessible
-- to browser roles; only validated writes and combined counts are exposed.
alter table public.analytics_events
  add column if not exists event_day date not null default ((now() at time zone 'utc')::date);

create unique index if not exists analytics_event_dedupe_idx
  on public.analytics_events (
    pseudonymous_id,
    event_name,
    coalesce(opportunity_id,''),
    coalesce(coarse_page,''),
    event_day
  );

update public.saved_opportunities
  set status='saved'
  where status is null or status not in ('saved','applied','participated');

alter table public.saved_opportunities
  drop constraint if exists saved_opportunities_status_check;
alter table public.saved_opportunities
  add constraint saved_opportunities_status_check
  check (status in ('saved','applied','participated'));

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
  if p_event_name not in (
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

  delete from public.analytics_events
    where created_at < now()-interval '12 months';

  insert into public.analytics_events(
    pseudonymous_id,event_name,opportunity_id,coarse_page,category,event_day
  ) values (
    p_session_id,
    p_event_name,
    left(nullif(p_opportunity_id,''),120),
    p_coarse_page,
    left(nullif(p_category,''),80),
    (now() at time zone 'utc')::date
  ) on conflict do nothing;
end;
$$;

revoke all on function public.record_impact_event(text,text,text,text,text) from public;
grant execute on function public.record_impact_event(text,text,text,text,text) to anon, authenticated;

-- Feedback and directory reports are private moderation inputs. Browser roles
-- can use validated functions but can never read or write the raw tables.
create table if not exists public.feedback_submissions(
  id bigint generated always as identity primary key,
  pseudonymous_id uuid not null,
  audience text not null check (audience in ('student','counselor','educator','parent','community')),
  helpfulness smallint not null check (helpfulness between 1 and 5),
  ease smallint not null check (ease between 1 and 5),
  would_recommend boolean not null,
  missing_text text,
  comments text,
  feedback_day date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;
revoke all on public.feedback_submissions from anon, authenticated;
create unique index if not exists feedback_one_per_session_day_idx
  on public.feedback_submissions(pseudonymous_id,feedback_day);

alter table public.submissions
  add column if not exists pseudonymous_id uuid,
  add column if not exists request_day date not null default ((now() at time zone 'utc')::date);
alter table public.change_requests
  add column if not exists pseudonymous_id uuid,
  add column if not exists request_day date not null default ((now() at time zone 'utc')::date);
alter table public.change_requests
  drop constraint if exists change_requests_opportunity_id_fkey;
revoke insert on public.submissions, public.change_requests from authenticated;

create unique index if not exists submission_session_dedupe_idx
  on public.submissions(pseudonymous_id,request_day,coalesce(organization_name,''))
  where pseudonymous_id is not null;
create unique index if not exists change_request_session_dedupe_idx
  on public.change_requests(pseudonymous_id,request_day,coalesce(opportunity_id,''))
  where pseudonymous_id is not null;

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
  if not p_consent then raise exception 'Consent required' using errcode='22023'; end if;
  if p_session_id is null or p_session_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Invalid anonymous session' using errcode='22023';
  end if;
  if p_audience not in ('student','counselor','educator','parent','community') then
    raise exception 'Unsupported audience' using errcode='22023';
  end if;
  if p_helpfulness not between 1 and 5 or p_ease not between 1 and 5 then
    raise exception 'Ratings must be between 1 and 5' using errcode='22023';
  end if;
  if length(coalesce(p_missing,''))>500 or length(coalesce(p_comments,''))>1500 then
    raise exception 'Feedback is too long' using errcode='22023';
  end if;

  delete from public.feedback_submissions where created_at<now()-interval '12 months';
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
  if not p_confirmed then raise exception 'Confirmation required' using errcode='22023'; end if;
  if p_session_id is null or p_session_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Invalid anonymous session' using errcode='22023';
  end if;
  if p_kind not in ('new','correction','expired','claim','missing-club') then
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

  delete from public.submissions where created_at<now()-interval '12 months';
  delete from public.change_requests where created_at<now()-interval '12 months';

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

create or replace function public.get_impact_summary()
returns table(
  accounts_created bigint,
  students_with_saves bigint,
  account_saves bigint,
  applications_reported bigint,
  participation_reported bigint,
  anonymous_sessions bigint,
  page_views bigint,
  opportunity_views bigint,
  save_actions bigint,
  official_source_clicks bigint,
  sign_in_links_requested bigint,
  feedback_responses bigint,
  average_helpfulness numeric,
  would_recommend_count bigint,
  reports_received bigint,
  corrections_completed bigint,
  measurement_started_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select
    (select count(*) from auth.users),
    (select count(distinct user_id) from public.saved_opportunities),
    (select count(*) from public.saved_opportunities),
    (select count(*) from public.saved_opportunities where status in ('applied','participated')),
    (select count(*) from public.saved_opportunities where status='participated'),
    (select count(distinct pseudonymous_id) from public.analytics_events where event_name='site_visit' and created_at>=now()-interval '12 months'),
    (select count(*) from public.analytics_events where event_name='page_view' and created_at>=now()-interval '12 months'),
    (select count(*) from public.analytics_events where event_name='opportunity_view' and created_at>=now()-interval '12 months'),
    (select count(*) from public.analytics_events where event_name='opportunity_saved' and created_at>=now()-interval '12 months'),
    (select count(*) from public.analytics_events where event_name='official_source_click' and created_at>=now()-interval '12 months'),
    (select count(*) from public.analytics_events where event_name='magic_link_requested' and created_at>=now()-interval '12 months'),
    (select count(*) from public.feedback_submissions where created_at>=now()-interval '12 months'),
    (select round(avg(helpfulness),1) from public.feedback_submissions where created_at>=now()-interval '12 months'),
    (select count(*) from public.feedback_submissions where would_recommend and created_at>=now()-interval '12 months'),
    ((select count(*) from public.submissions where created_at>=now()-interval '12 months')+
      (select count(*) from public.change_requests where created_at>=now()-interval '12 months')),
    (select count(*) from public.change_requests where moderation_state in ('accepted','approved','completed') and reviewed_at is not null and created_at>=now()-interval '12 months'),
    (select min(created_at) from public.analytics_events);
$$;

revoke all on function public.get_impact_summary() from public;
grant execute on function public.get_impact_summary() to anon, authenticated;

comment on function public.get_impact_summary() is
  'Returns aggregate project-impact counts only; never returns user or event records.';
