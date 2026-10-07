begin;
select plan(12);
select has_column('public','bucket_list_items','category','wishlist ideas have categories');
select has_column('public','bucket_list_items','note','wishlist ideas have notes');
select has_column('public','bucket_list_items','link','wishlist ideas have optional links');
select has_column('public','bucket_list_items','saved','wishlist ideas have a saved state');
select ok((select relrowsecurity from pg_class where oid='public.bucket_list_items'::regclass),'wishlist items remain protected by RLS');
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000009611','wishlist-a@example.test'),
 ('00000000-0000-4000-8000-000000009612','wishlist-b@example.test'),
 ('00000000-0000-4000-8000-000000009613','wishlist-outside@example.test');
insert into public.couples(id) values ('00000000-0000-4000-8000-000000009621'),('00000000-0000-4000-8000-000000009622');
insert into public.couple_members(couple_id,user_id,member_slot) values
 ('00000000-0000-4000-8000-000000009621','00000000-0000-4000-8000-000000009611',1),
 ('00000000-0000-4000-8000-000000009621','00000000-0000-4000-8000-000000009612',2),
 ('00000000-0000-4000-8000-000000009622','00000000-0000-4000-8000-000000009613',1);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009611',true);
insert into public.bucket_list_items(couple_id,title,category,note,link) values('00000000-0000-4000-8000-000000009621','Night market','food','Try the dumplings','https://example.com');
select is((select count(*)::integer from public.bucket_list_items where category='food' and note='Try the dumplings'),1,'member can add categorized ideas, notes, and links');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009612',true);
select is((select count(*)::integer from public.bucket_list_items where category='food'),1,'partner reads the shared wishlist');
update public.bucket_list_items set category='trip', note='Book a weekend', saved=true, completed=true where couple_id='00000000-0000-4000-8000-000000009621';
select ok((select category='trip' and note='Book a weekend' and saved and completed from public.bucket_list_items where couple_id='00000000-0000-4000-8000-000000009621'),'partner edits, saves, and completes an item');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000009613',true);
select is((select count(*)::integer from public.bucket_list_items),0,'unrelated user cannot read wishlist items');
select throws_ok($$insert into public.bucket_list_items(couple_id,title) values('00000000-0000-4000-8000-000000009621','Intrusion')$$,'42501',null,'unrelated user cannot write into another couple wishlist');
select throws_ok($$insert into public.bucket_list_items(couple_id,title,category) values('00000000-0000-4000-8000-000000009622','Bad category','unknown')$$,'23514',null,'invalid category rejected');
select throws_ok($$insert into public.bucket_list_items(couple_id,title,link) values('00000000-0000-4000-8000-000000009622','Bad link','javascript:alert(1)')$$,'23514',null,'unsafe link rejected in database');
reset role;
select * from finish();
rollback;
