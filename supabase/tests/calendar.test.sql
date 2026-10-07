begin;
select plan(14);
select has_table('public','relationship_events','shared calendar events table exists');
select ok((select relrowsecurity from pg_class where oid='public.relationship_events'::regclass),'calendar events enforce RLS');
select ok(not has_table_privilege('anon','public.relationship_events','SELECT'),'anon cannot read shared plans');
select has_function('public','validate_relationship_event',array[]::text[],'event trigger validates timezone and related records');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000007611','calendar-a@example.test'),
 ('00000000-0000-4000-8000-000000007612','calendar-b@example.test'),
 ('00000000-0000-4000-8000-000000007613','calendar-outside@example.test');
insert into public.couples(id) values ('00000000-0000-4000-8000-000000007621'),('00000000-0000-4000-8000-000000007622');
insert into public.couple_members(couple_id,user_id,member_slot) values
 ('00000000-0000-4000-8000-000000007621','00000000-0000-4000-8000-000000007611',1),
 ('00000000-0000-4000-8000-000000007621','00000000-0000-4000-8000-000000007612',2),
 ('00000000-0000-4000-8000-000000007622','00000000-0000-4000-8000-000000007613',1);
insert into public.relationship_milestones(id,couple_id,title,milestone_date,created_by) values
 ('00000000-0000-4000-8000-000000007631','00000000-0000-4000-8000-000000007621','Couple milestone','2026-12-05','00000000-0000-4000-8000-000000007611'),
 ('00000000-0000-4000-8000-000000007639','00000000-0000-4000-8000-000000007622','Other milestone','2026-12-05','00000000-0000-4000-8000-000000007613');
insert into public.bucket_list_items(id,couple_id,title) values
 ('00000000-0000-4000-8000-000000007632','00000000-0000-4000-8000-000000007621','Couple idea'),
 ('00000000-0000-4000-8000-000000007638','00000000-0000-4000-8000-000000007622','Other idea');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007611',true);
insert into public.relationship_events(couple_id,title,timezone,all_day,event_date) values ('00000000-0000-4000-8000-000000007621','Weekend trip','Asia/Taipei',true,'2026-12-05');
insert into public.relationship_events(couple_id,title,timezone,all_day,starts_at) values ('00000000-0000-4000-8000-000000007621','Dinner','Asia/Taipei',false,'2026-12-05 11:00:00+00');
insert into public.relationship_events(couple_id,title,timezone,all_day,event_date,milestone_id,wishlist_item_id) values ('00000000-0000-4000-8000-000000007621','Linked plan','UTC',true,'2026-12-05','00000000-0000-4000-8000-000000007631','00000000-0000-4000-8000-000000007632');
select throws_ok($$insert into public.relationship_events(couple_id,title,timezone,all_day,event_date,milestone_id) values('00000000-0000-4000-8000-000000007621','Wrong link','UTC',true,'2026-12-05','00000000-0000-4000-8000-000000007639')$$,'P0001','Milestone must belong to this couple','event trigger rejects unrelated milestone references');
select throws_ok($$insert into public.relationship_events(couple_id,title,timezone,all_day,event_date,wishlist_item_id) values('00000000-0000-4000-8000-000000007621','Wrong idea','UTC',true,'2026-12-05','00000000-0000-4000-8000-000000007638')$$,'P0001','Wishlist item must belong to this couple','event trigger rejects unrelated wishlist references');
select is((select count(*)::integer from public.relationship_events),3,'couple can create all-day and timed plans');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007612',true);
select is((select count(*)::integer from public.relationship_events),3,'partner can read calendar plans');
update public.relationship_events set title='Anniversary dinner' where title='Dinner';
select is((select title from public.relationship_events where title='Anniversary dinner'),'Anniversary dinner','partner can edit plans');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007613',true);
select is((select count(*)::integer from public.relationship_events),0,'unrelated user cannot read events');
select throws_ok($$insert into public.relationship_events(couple_id,title,timezone,all_day,event_date) values('00000000-0000-4000-8000-000000007621','Intrusion','UTC',true,'2026-12-01')$$,'42501',null,'unrelated user cannot write to another couple calendar');
select throws_ok($$insert into public.relationship_events(couple_id,title,timezone,all_day,event_date) values('00000000-0000-4000-8000-000000007622','Bad zone','Not/AZone',true,'2026-12-01')$$,'P0001','Timezone is invalid','invalid timezone rejected');
select throws_ok($$insert into public.relationship_events(couple_id,title,timezone,all_day,event_date,starts_at) values('00000000-0000-4000-8000-000000007622','Bad all day','UTC',true,'2026-12-01',now())$$,'23514',null,'all-day rows cannot include a timestamp');
select ok(exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='Couple members receive calendar broadcasts'),'calendar broadcasts are couple-private');
reset role;
select * from finish();
rollback;


