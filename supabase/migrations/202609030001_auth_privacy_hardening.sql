-- Lock every browser-accessible table behind explicit row-level policies.
alter table public.organizations enable row level security;
alter table public.opportunities enable row level security;
alter table public.eligibility_rules enable row level security;
alter table public.taxonomy_nodes enable row level security;
alter table public.opportunity_taxonomy enable row level security;
alter table public.source_records enable row level security;
alter table public.profiles enable row level security;
alter table public.saved_opportunities enable row level security;
alter table public.reminders enable row level security;
alter table public.submissions enable row level security;
alter table public.change_requests enable row level security;
alter table public.organization_claims enable row level security;
alter table public.source_channels enable row level security;
alter table public.import_batches enable row level security;
alter table public.moderation_events enable row level security;
alter table public.analytics_events enable row level security;

-- The public catalog is bundled with the site, so a saved ID does not require a
-- duplicate database opportunity row.
alter table public.saved_opportunities
  drop constraint if exists saved_opportunities_opportunity_id_fkey;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.opportunities to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_opportunities to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert on public.submissions to authenticated;
grant select, insert on public.change_requests to authenticated;
grant select, insert on public.organization_claims to authenticated;

drop policy if exists "public reads published opportunities" on public.opportunities;
create policy "public reads current published opportunities"
  on public.opportunities for select to anon, authenticated
  using (published_at is not null and status in ('open','ongoing','upcoming'));

drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);
create policy "users create student profile" on public.profiles for insert to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id and role = 'student');
create policy "users update student profile" on public.profiles for update to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() = user_id and role = 'student');
create policy "users delete own profile" on public.profiles for delete to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "users manage own saves" on public.saved_opportunities;
create policy "users read own saves" on public.saved_opportunities for select to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);
create policy "users create own saves" on public.saved_opportunities for insert to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);
create policy "users update own saves" on public.saved_opportunities for update to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "users delete own saves" on public.saved_opportunities for delete to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "users manage own reminders" on public.reminders;
create policy "users manage own reminders" on public.reminders for all to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "users read own submissions" on public.submissions;
drop policy if exists "anyone submits pending" on public.submissions;
create policy "users read own submissions" on public.submissions for select to authenticated
  using (auth.uid() is not null and auth.uid() = submitter_user_id);
create policy "users submit pending items" on public.submissions for insert to authenticated
  with check (
    auth.uid() is not null and auth.uid() = submitter_user_id
    and moderation_status = 'pending' and reviewer_notes is null and reviewed_at is null
  );

create policy "users read own change requests" on public.change_requests for select to authenticated
  using (auth.uid() is not null and auth.uid() = requester_user_id);
create policy "users create own pending change requests" on public.change_requests for insert to authenticated
  with check (auth.uid() is not null and auth.uid() = requester_user_id and moderation_state = 'pending' and reviewed_at is null);

create policy "users read own organization claims" on public.organization_claims for select to authenticated
  using (auth.uid() is not null and auth.uid() = claimant_user_id);
create policy "users create own pending organization claims" on public.organization_claims for insert to authenticated
  with check (auth.uid() is not null and auth.uid() = claimant_user_id and status = 'pending' and verified_at is null);

-- Deleting the auth user cascades through account-owned tables. The function
-- has no user-supplied ID, so a user can delete only their own account.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
