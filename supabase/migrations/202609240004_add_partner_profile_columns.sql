alter table public.profiles
  add column if not exists partner_id uuid;

alter table public.profiles
  add column if not exists partner_name text;

notify pgrst, 'reload schema';
