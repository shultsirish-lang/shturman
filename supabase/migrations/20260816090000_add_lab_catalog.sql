create table public.lab_catalog_items (
  id text primary key,
  provider text not null default 'Helix',
  code text not null,
  title text not null,
  specialty text not null default '',
  topics text[] not null default '{}',
  keywords text[] not null default '{}',
  source_name text not null default '',
  source_version text not null default '',
  source_pages integer[] not null default '{}',
  search_tsv tsvector not null default ''::tsvector,
  updated_at timestamptz not null default now(),
  unique (provider, code, title)
);

create index lab_catalog_items_code_idx on public.lab_catalog_items (code);
create index lab_catalog_items_specialty_idx on public.lab_catalog_items (specialty);
create index lab_catalog_items_topics_idx on public.lab_catalog_items using gin (topics);
create index lab_catalog_items_search_tsv_idx on public.lab_catalog_items using gin (search_tsv);

create function public.update_lab_catalog_search_tsv()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_tsv := to_tsvector(
    'russian',
    concat_ws(' ', new.code, new.title, new.specialty, array_to_string(new.topics, ' '), array_to_string(new.keywords, ' '), new.provider)
  );
  return new;
end;
$$;

create trigger lab_catalog_items_search_tsv_trigger
before insert or update of code, title, specialty, topics, keywords, provider
on public.lab_catalog_items
for each row execute function public.update_lab_catalog_search_tsv();

revoke execute on function public.update_lab_catalog_search_tsv() from public, anon, authenticated;

alter table public.lab_catalog_items enable row level security;
grant select on public.lab_catalog_items to anon, authenticated;

create policy "Public lab catalog is readable"
on public.lab_catalog_items for select to anon, authenticated using (true);
