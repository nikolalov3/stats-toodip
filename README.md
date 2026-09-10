# toodip · stats

Minimalny, własny (first-party) system statystyk wejść. Skrypt na stronie klienta →
funkcja `/api/collect` → Supabase → dashboard za loginem. Multi-user, każdy widzi
tylko swoje dane (RLS). Darmowy plan: 1 strona na konto.

Stack: **Vercel** (dashboard + funkcja) + **Supabase** (Postgres + Auth).

## Pliki
- `s.js` — skrypt śledzący (wklejany na stronie klienta).
- `api/collect.js` — kolektor (zapis wejścia do bazy, service-key).
- `index.html` — dashboard (login + statystyki).
- `supabase/schema.sql` — tabele + RLS.
- `vercel.json` — nagłówki dla `s.js`.

## Setup (raz)
1. **Supabase**: załóż projekt → SQL Editor → wklej `supabase/schema.sql` → Run.
2. Settings → API, skopiuj: **Project URL**, **anon public key**, **service_role key** (sekret!).
3. W `index.html` uzupełnij `CONFIG.url` i `CONFIG.anon` (anon jest publiczny — RLS chroni dane).
4. **Vercel**: zaimportuj repo (Framework Preset: *Other*, brak buildu). W *Settings → Environment
   Variables* dodaj:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (NIE anon)
5. Podłącz domenę **stats.toodip.pl** w Vercel (Add Domain) i ustaw DNS wg wskazówek Vercela.
6. Supabase → Authentication → URL Configuration: **Site URL** = `https://stats.toodip.pl`
   (dodaj też `http://localhost:*` do Redirect URLs na czas testów).

## Jak używać
1. Wejdź na `stats.toodip.pl`, zaloguj się linkiem z maila.
2. Dodaj stronę (nazwa + domena) → dostajesz gotowy `<script>` z `data-id`.
3. Wklej ten skrypt przed `</head>` na stronie klienta.
4. Wejścia zaczynają lecieć od razu; dashboard pokazuje: dziś / 7 / 30 dni / łącznie,
   14-dniowy wykres i najczęstsze ścieżki.

## Co dołożymy później
Unikalni użytkownicy, urządzenia/kraje, źródła ruchu, więcej stron per konto (plan płatny),
eksport, publiczny link do raportu, rate-limiting kolektora.

## Uwaga
To jest uczciwy, sprawdzalny system — skrypt leci z Twojej domeny i naprawdę zbiera ruch.
Klientowi mówisz wprost: „to nasze narzędzie do statystyk".
