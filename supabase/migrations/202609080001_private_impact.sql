create table if not exists public.impact_admins(
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.impact_admins enable row level security;
revoke all on public.impact_admins from anon, authenticated;

create or replace function public.is_impact_admin()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null and exists(
    select 1 from public.impact_admins where user_id=auth.uid()
  );
$$;

revoke all on function public.is_impact_admin() from public;
grant execute on function public.is_impact_admin() to authenticated;

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
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not exists(
    select 1 from public.impact_admins where user_id=auth.uid()
  ) then
    raise insufficient_privilege using message='Impact dashboard access denied';
  end if;

  return query select
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
end;
$$;

revoke all on function public.get_impact_summary() from public, anon, authenticated;
grant execute on function public.get_impact_summary() to authenticated;

comment on function public.get_impact_summary() is
  'Returns aggregate project-impact counts only to explicitly designated impact administrators.';
