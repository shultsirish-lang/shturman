alter table public.lab_catalog_items
  add column if not exists method text,
  add column if not exists prep text;
