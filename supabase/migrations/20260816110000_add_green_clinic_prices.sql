alter table public.lab_catalog_items
  add column green_clinic_code text,
  add column price_rub integer,
  add column material text,
  add column duration text;

create index lab_catalog_items_green_clinic_code_idx on public.lab_catalog_items (green_clinic_code);
