ALTER TABLE public.bucket_list_items
  ADD COLUMN category text NOT NULL DEFAULT 'date' CHECK (category IN ('date','place','food','gift','trip')),
  ADD COLUMN note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  ADD COLUMN link text NOT NULL DEFAULT '' CHECK (length(link) <= 2048 AND (link = '' OR link ~* '^https?://')),
  ADD COLUMN saved boolean NOT NULL DEFAULT false;
GRANT INSERT (couple_id, title, category, note, link) ON public.bucket_list_items TO authenticated;
GRANT UPDATE (title, completed, category, note, link, saved) ON public.bucket_list_items TO authenticated;
