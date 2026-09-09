-- Run in the Supabase SQL editor as postgres. All test writes are rolled back.
begin;
insert into auth.users(id,aud,email) values
 ('a0000000-0000-4000-8000-000000000001','authenticated','security-a@example.invalid'),
 ('b0000000-0000-4000-8000-000000000002','authenticated','security-b@example.invalid');
insert into public.saved_opportunities(user_id,opportunity_id,status) values
 ('a0000000-0000-4000-8000-000000000001','security-test-a','applied'),
 ('b0000000-0000-4000-8000-000000000002','security-test-b','saved');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.saved_opportunities)<>1 then raise exception 'Account A can read other saves'; end if;
  if not exists(select 1 from public.saved_opportunities where opportunity_id='security-test-a') then raise exception 'Account A own save unavailable'; end if;
  begin
    insert into public.saved_opportunities(user_id,opportunity_id) values('b0000000-0000-4000-8000-000000000002','forged');
    raise exception 'Cross-account insert was allowed';
  exception when insufficient_privilege then null; end;
  update public.saved_opportunities set status='participated' where opportunity_id='security-test-b';
  if found then raise exception 'Cross-account update was allowed'; end if;
  delete from public.saved_opportunities where opportunity_id='security-test-b';
  if found then raise exception 'Cross-account delete was allowed'; end if;
  begin
    perform public.get_impact_summary();raise exception 'Nonowner read impact';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.impact_admins(user_id) values(auth.uid());raise exception 'Self promotion allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claims','{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.saved_opportunities)<>1 or not exists(select 1 from public.saved_opportunities where opportunity_id='security-test-b' and status='saved') then raise exception 'Account B isolation failed';end if;
end; $$;
reset role;
-- Existing owner can access aggregate totals using the same auth.uid check.
select set_config('request.jwt.claims',json_build_object('sub',(select user_id from public.impact_admins limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  if not public.is_impact_admin() then raise exception 'Owner membership failed'; end if;
  perform public.get_impact_summary();
end; $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
  begin perform public.get_impact_summary();raise exception 'Anonymous impact read allowed';exception when insufficient_privilege then null;end;
  begin perform 1 from public.feedback_submissions;raise exception 'Raw feedback read allowed';exception when insufficient_privilege then null;end;
  begin perform 1 from public.saved_opportunities;raise exception 'Anonymous saves read allowed';exception when insufficient_privilege then null;end;
  begin
    perform public.submit_feedback('c0000000-0000-4000-8000-000000000003','student',5,5,true,null,null,null);
    raise exception 'NULL consent allowed';
  exception when invalid_parameter_value then null;end;
  begin
    perform public.submit_directory_request('c0000000-0000-4000-8000-000000000003','new',null,'Test','https://example.org','A sufficiently long test description.',null);
    raise exception 'NULL confirmation allowed';
  exception when invalid_parameter_value then null;end;
  perform public.submit_feedback('c0000000-0000-4000-8000-000000000003','student',5,5,true,null,'Rollback-only test',true);
  perform public.submit_directory_request('c0000000-0000-4000-8000-000000000003','correction',null,'Test correction','https://example.org','A sufficiently long test description.',true);
end; $$;
reset role;
-- Prove changing session IDs cannot get around the global cap.
insert into private.write_budgets(scope,bucket,used) values('feedback:hour',date_trunc('hour',now() at time zone 'utc') at time zone 'utc',20)
on conflict(scope,bucket) do update set used=20;
set local role anon;
do $$ begin
  begin
    perform public.submit_feedback('d0000000-0000-4000-8000-000000000004','student',5,5,true,null,null,true);
    raise exception 'Global rate limit bypassed' using errcode='XX000';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'Too many requests. Please try again later.' then raise;end if;
  end;
end; $$;
reset role;
-- Exercise actual cleanup, but roll the entire transaction back afterward.
insert into public.analytics_events(pseudonymous_id,event_name,created_at) values('retention-test','site_visit',now()-interval '13 months');
insert into public.feedback_submissions(pseudonymous_id,audience,helpfulness,ease,would_recommend,created_at)
values('e0000000-0000-4000-8000-000000000005','student',3,3,true,now()-interval '13 months');
select private.cleanup_expired_records();
do $$ begin
  if exists(select 1 from public.analytics_events where pseudonymous_id='retention-test') then raise exception 'Event cleanup failed';end if;
  if exists(select 1 from public.feedback_submissions where pseudonymous_id='e0000000-0000-4000-8000-000000000005') then raise exception 'Feedback cleanup failed';end if;
  if not exists(select 1 from cron.job where jobname='poh-daily-privacy-cleanup' and active) then raise exception 'Cleanup schedule missing';end if;
end; $$;
select 'PASS: two-account RLS, owner access, anonymous denial, no self-promotion, consent validation, real submissions, global rate cap and scheduled retention' as security_result;
rollback;
