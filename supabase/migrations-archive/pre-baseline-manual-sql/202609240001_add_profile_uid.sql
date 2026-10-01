alter table public.profiles
  add column if not exists uid text;

create or replace function public.generate_profile_uid()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  position integer;
begin
  loop
    candidate := '';
    for position in 1..8 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
      if position = 4 then
        candidate := candidate || '-';
      end if;
    end loop;

    exit when not exists (select 1 from public.profiles where uid = candidate);
  end loop;

  return candidate;
end;
$$;

alter table public.profiles
  alter column uid set default public.generate_profile_uid();

update public.profiles
set uid = public.generate_profile_uid()
where uid is null;

alter table public.profiles
  alter column uid set not null;

create unique index if not exists profiles_uid_key on public.profiles (uid);

comment on column public.profiles.uid is 'Human-friendly unique identifier used for friend discovery.';
