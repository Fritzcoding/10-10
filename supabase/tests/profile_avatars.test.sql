begin;
select plan(15);

select is((select count(*)::integer from storage.buckets where id='profile-avatars'), 1, 'private avatar bucket exists');
select ok((select not public from storage.buckets where id='profile-avatars'), 'avatar bucket is private');
select is((select file_size_limit::bigint from storage.buckets where id='profile-avatars'), 5242880::bigint, 'avatar upload size is capped at 5 MiB');
select ok((select allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp'] from storage.buckets where id='profile-avatars'), 'avatar bucket accepts JPEG PNG and WebP');
select has_function('private', 'can_read_profile_avatar', array['uuid'], 'avatar reads use a relationship-scoped helper');
select ok(exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname='profile avatar owner insert'), 'only the owner can create an avatar object');
select ok(exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname='profile avatar owner update'), 'only the owner can replace an avatar object');
select ok(exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname='profile avatar owner delete'), 'only the owner can delete an avatar object');
select ok(exists(select 1 from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname='profile avatar owner and connections read'), 'owners and connected people can read avatars');

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000901', 'avatar-one@example.test'),
  ('00000000-0000-4000-8000-000000000902', 'avatar-friend@example.test'),
  ('00000000-0000-4000-8000-000000000903', 'avatar-outsider@example.test'),
  ('00000000-0000-4000-8000-000000000904', 'avatar-partner-one@example.test'),
  ('00000000-0000-4000-8000-000000000905', 'avatar-partner-two@example.test');
insert into public.friend_requests(requester_id,recipient_id,status,request_type)
values ('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000902','accepted','friend');
insert into public.couples(id) values ('00000000-0000-4000-8000-000000000906');
insert into public.couple_members(couple_id,user_id,member_slot) values
  ('00000000-0000-4000-8000-000000000906','00000000-0000-4000-8000-000000000904',1),
  ('00000000-0000-4000-8000-000000000906','00000000-0000-4000-8000-000000000905',2);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id='profile-avatars') THEN
    INSERT INTO storage.objects(id,bucket_id,name,owner,owner_id,metadata) values
      ('00000000-0000-4000-8000-000000000911','profile-avatars','00000000-0000-4000-8000-000000000901/avatar','00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000901','{"mimetype":"image/png","size":32}'),
      ('00000000-0000-4000-8000-000000000912','profile-avatars','00000000-0000-4000-8000-000000000905/avatar','00000000-0000-4000-8000-000000000905','00000000-0000-4000-8000-000000000905','{"mimetype":"image/png","size":32}');
  END IF;
END $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000901',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars' and name='00000000-0000-4000-8000-000000000901/avatar'),1,'owner can read their avatar');
update storage.objects set metadata='{"mimetype":"image/webp","size":64}' where bucket_id='profile-avatars' and name='00000000-0000-4000-8000-000000000901/avatar';
select is((select metadata->>'mimetype' from storage.objects where bucket_id='profile-avatars' and name='00000000-0000-4000-8000-000000000901/avatar'),'image/webp','owner can replace their avatar at the stable path');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000902',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars' and name='00000000-0000-4000-8000-000000000901/avatar'),1,'an accepted friend can read the avatar');
update storage.objects set metadata='{"mimetype":"image/jpeg","size":32}' where bucket_id='profile-avatars' and name='00000000-0000-4000-8000-000000000901/avatar';
select is((select metadata->>'mimetype' from storage.objects where bucket_id='profile-avatars' and name='00000000-0000-4000-8000-000000000901/avatar'),'image/webp','a friend cannot replace another avatar');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000903',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars' and name='00000000-0000-4000-8000-000000000901/avatar'),0,'an unrelated user cannot read the avatar');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000904',true);
select is((select count(*)::integer from storage.objects where bucket_id='profile-avatars' and name='00000000-0000-4000-8000-000000000905/avatar'),1,'a partner can read the avatar');

select * from finish();
rollback;
