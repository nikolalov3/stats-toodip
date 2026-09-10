-- toodip stats — schema (idempotentny, mozna puszczac wielokrotnie).
-- Wklej w Supabase (projekt toodip) -> SQL Editor -> Run.

-- Strony (klienci).
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

-- Wejscia (page views) — sygnal 1: ludzie (JS).
create table if not exists public.stats_events (
  id bigint generated always as identity primary key,
  website_id uuid not null references public.stats_websites(id) on delete cascade,
  ts timestamptz not null default now(),
  path text,
  referrer text,
  country text
);
-- kolumny dokladane migracyjnie:
alter table public.stats_events add column if not exists source  text;   -- ai / search / social / direct / other
alter table public.stats_events add column if not exists ai_name text;   -- ChatGPT / Perplexity / Gemini / Claude / Copilot / ...
alter table public.stats_events add column if not exists title   text;
alter table public.stats_events add column if not exists device  text;   -- mobile / desktop
alter table public.stats_events add column if not exists lang    text;
alter table public.stats_events enable row level security;
drop policy if exists "stats_events read own" on public.stats_events;
create policy "stats_events read own" on public.stats_events
  for select using (exists (select 1 from public.stats_websites w
    where w.id = stats_events.website_id and w.user_id = auth.uid()));
create index if not exists stats_events_website_ts_idx on public.stats_events (website_id, ts desc);

-- Odwiedziny botow AI — sygnal 2: czy AI CZYTA strone (serwer / middleware).
create table if not exists public.stats_bot_hits (
  id bigint generated always as identity primary key,
  website_id uuid not null references public.stats_websites(id) on delete cascade,
  ts timestamptz not null default now(),
  bot text,      -- GPTBot / OAI-SearchBot / PerplexityBot / ClaudeBot / CCBot / Google-Extended / ...
  path text
);
alter table public.stats_bot_hits enable row level security;
drop policy if exists "stats_bot read own" on public.stats_bot_hits;
create policy "stats_bot read own" on public.stats_bot_hits
  for select using (exists (select 1 from public.stats_websites w
    where w.id = stats_bot_hits.website_id and w.user_id = auth.uid()));
create index if not exists stats_bot_website_ts_idx on public.stats_bot_hits (website_id, ts desc);
