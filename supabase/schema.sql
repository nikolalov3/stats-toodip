-- toodip stats — schema. Wklej w Supabase -> SQL Editor -> Run.

-- Strony (klienci). Jeden user moze miec wiele, ale front na darmowym planie limituje do 1.
create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);
alter table public.websites enable row level security;

drop policy if exists "websites owner all" on public.websites;
create policy "websites owner all" on public.websites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Wejscia (page views). Zapisywane przez funkcje /api/collect (service key, omija RLS).
create table if not exists public.events (
  id bigint generated always as identity primary key,
  website_id uuid not null references public.websites(id) on delete cascade,
  ts timestamptz not null default now(),
  path text,
  referrer text,
  country text
);
alter table public.events enable row level security;

-- Czytac moze tylko wlasciciel danej strony (dashboard). Zapis idzie service-keyem.
drop policy if exists "events read own" on public.events;
create policy "events read own" on public.events
  for select using (
    exists (select 1 from public.websites w
            where w.id = events.website_id and w.user_id = auth.uid())
  );

create index if not exists events_website_ts_idx on public.events (website_id, ts desc);
