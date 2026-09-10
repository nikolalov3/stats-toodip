-- toodip stats — schema. Wklej w Supabase (istniejacy projekt toodip) -> SQL Editor -> Run.
-- Tabele maja prefiks stats_ zeby nie kolidowac z tabelami aplikacji SaaS.
-- Auth jest wspolny -> logujesz sie tym samym kontem co do toodip.

-- Strony (klienci). Jeden user moze miec wiele; front na darmowym planie limituje do 1.
create table if not exists public.stats_websites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);
alter table public.stats_websites enable row level security;

drop policy if exists "stats_websites owner all" on public.stats_websites;
create policy "stats_websites owner all" on public.stats_websites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Wejscia (page views). Zapis przez /api/collect (service key, omija RLS).
create table if not exists public.stats_events (
  id bigint generated always as identity primary key,
  website_id uuid not null references public.stats_websites(id) on delete cascade,
  ts timestamptz not null default now(),
  path text,
  referrer text,
  country text
);
alter table public.stats_events enable row level security;

-- Czytac moze tylko wlasciciel danej strony (dashboard). Zapis idzie service-keyem.
drop policy if exists "stats_events read own" on public.stats_events;
create policy "stats_events read own" on public.stats_events
  for select using (
    exists (select 1 from public.stats_websites w
            where w.id = stats_events.website_id and w.user_id = auth.uid())
  );

create index if not exists stats_events_website_ts_idx on public.stats_events (website_id, ts desc);
