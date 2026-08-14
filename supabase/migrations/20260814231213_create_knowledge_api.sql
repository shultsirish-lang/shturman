create table public.knowledge_cards (
  id text primary key,
  module text not null default '',
  kind text not null default '',
  title text not null,
  quick text not null default '',
  patient_answer text not null default '',
  urgency text not null default '',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  search_tsv tsvector not null default ''::tsvector
);

create table public.knowledge_meta (
  key text primary key,
  value text not null default ''
);

create index knowledge_cards_module_idx on public.knowledge_cards (module);
create index knowledge_cards_kind_idx on public.knowledge_cards (kind);
create index knowledge_cards_urgency_idx on public.knowledge_cards (urgency);
create index knowledge_cards_search_tsv_idx on public.knowledge_cards using gin (search_tsv);

create function public.update_knowledge_card_search_tsv()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_tsv := to_tsvector(
    'russian',
    concat_ws(' ', new.title, new.quick, new.patient_answer, new.module, new.kind, new.data::text)
  );
  return new;
end;
$$;

create trigger knowledge_cards_search_tsv_trigger
before insert or update of module, kind, title, quick, patient_answer, data
on public.knowledge_cards
for each row execute function public.update_knowledge_card_search_tsv();

revoke execute on function public.update_knowledge_card_search_tsv() from public, anon, authenticated;

alter table public.knowledge_cards enable row level security;
alter table public.knowledge_meta enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.knowledge_cards, public.knowledge_meta to anon, authenticated;

create policy "Public knowledge is readable"
on public.knowledge_cards for select to anon, authenticated using (true);

create policy "Public metadata is readable"
on public.knowledge_meta for select to anon, authenticated using (true);
