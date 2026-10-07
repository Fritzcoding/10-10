begin;
select plan(15);
select has_table('public','relationship_milestones','milestones table exists');
select has_function('public','set_featured_milestone',array['uuid'],'countdown selection is atomic and membership checked');
select ok(not has_function_privilege('anon','public.set_featured_milestone(uuid)','EXECUTE'),'anonymous users cannot select a countdown');
select has_function('public','broadcast_relationship_milestone_changes',array[]::text[],'milestone changes are broadcast by a trigger');
select ok(exists(select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='Couple members receive milestone broadcasts'),'broadcast channels require couple membership');
select ok((select relrowsecurity from pg_class where oid='public.relationship_milestones'::regclass),'milestones enforce RLS');
select ok(not has_table_privilege('anon','public.relationship_milestones','SELECT'),'anon cannot read milestones');
insert into auth.users (id,email) values
 ('00000000-0000-4000-8000-000000008611','milestone-a@example.test'),
 ('00000000-0000-4000-8000-000000008612','milestone-b@example.test'),
 ('00000000-0000-4000-8000-000000008613','milestone-outside@example.test');
insert into public.couples (id) values ('00000000-0000-4000-8000-000000008621'),('00000000-0000-4000-8000-000000008622');
insert into public.couple_members (couple_id,user_id,member_slot) values
 ('00000000-0000-4000-8000-000000008621','00000000-0000-4000-8000-000000008611',1),
 ('00000000-0000-4000-8000-000000008621','00000000-0000-4000-8000-000000008612',2),
 ('00000000-0000-4000-8000-000000008622','00000000-0000-4000-8000-000000008613',1);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008611',true);
insert into public.relationship_milestones(couple_id,title,category,milestone_date,annual) values ('00000000-0000-4000-8000-000000008621','Anniversary','anniversary','2026-10-10',true);
select is((select count(*)::integer from public.relationship_milestones where couple_id='00000000-0000-4000-8000-000000008621'),1,'member can create and read a couple milestone');
select public.set_featured_milestone((select id from public.relationship_milestones where couple_id='00000000-0000-4000-8000-000000008621'));
select ok((select featured from public.relationship_milestones where couple_id='00000000-0000-4000-8000-000000008621'),'member can choose the shared countdown');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008612',true);
select is((select count(*)::integer from public.relationship_milestones),1,'partner sees shared milestone');
update public.relationship_milestones set title='Our anniversary' where couple_id='00000000-0000-4000-8000-000000008621';
select is((select title from public.relationship_milestones where couple_id='00000000-0000-4000-8000-000000008621'),'Our anniversary','partner can edit milestone');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000008613',true);
select is((select count(*)::integer from public.relationship_milestones),0,'unrelated member cannot read milestone');
select throws_ok($$insert into public.relationship_milestones(couple_id,title,milestone_date) values ('00000000-0000-4000-8000-000000008621','Intrusion','2026-12-01')$$,'42501',null,'unrelated member cannot insert into another couple');

select throws_ok($$insert into public.relationship_milestones(couple_id,title,milestone_date) values ('00000000-0000-4000-8000-000000008622',' ','2026-12-01')$$,'23514',null,'blank titles are rejected');
select throws_ok($$insert into public.relationship_milestones(couple_id,title,category,milestone_date) values ('00000000-0000-4000-8000-000000008622','Bad category','invalid','2026-12-01')$$,'23514',null,'unknown categories are rejected');
reset role;
select * from finish();
rollback;

