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
    (select min(created_at) from public.analytics_events);
$$;

revoke all on function public.get_impact_summary() from public;
grant execute on function public.get_impact_summary() to anon, authenticated;

comment on function public.get_impact_summary() is
  'Returns aggregate project-impact counts only; never returns user or event records.';
