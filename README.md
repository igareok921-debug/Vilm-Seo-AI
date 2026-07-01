# VILM SEO AI

Dashboard SaaS SEO construit cu Next.js 15, TypeScript, Tailwind CSS și App Router.

## Rulare locală

```bash
npm install
npm run dev
```

Aplicația va fi disponibilă la `http://localhost:3000`.

## Integrări viitoare

### Supabase

1. Creează un proiect în Supabase.
2. Rulează `supabase/migrations/001_initial_schema.sql` în SQL Editor.
3. Rulează `supabase/migrations/002_crawler_schema.sql` în SQL Editor.
4. Rulează `supabase/migrations/003_ai_recommendations.sql` în SQL Editor.
5. Rulează `supabase/migrations/004_google_search_console.sql` în SQL Editor.
6. Rulează `supabase/migrations/005_keyword_research.sql` în SQL Editor.
7. Rulează `supabase/migrations/006_generated_pages.sql` în SQL Editor.
8. Rulează `supabase/migrations/007_assistant_copilot.sql` în SQL Editor.
9. Rulează `supabase/seed.sql` pentru datele demo.
10. Creează `.env.local` pe baza fișierului `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=cheia_anon_sau_publishable
SUPABASE_SERVICE_ROLE_KEY=cheia_service_role
OPENAI_API_KEY=sk-...
```

`SUPABASE_SERVICE_ROLE_KEY` este utilizată doar în server-side route handlers și nu trebuie expusă în componente client sau trimisă în browser.

Dacă variabilele Supabase lipsesc sau conexiunea eșuează, pagina `/websites` folosește automat datele demo locale. Fără `OPENAI_API_KEY`, tabul Recomandări AI rămâne vizibil, dar analiza este dezactivată.

## Crawler SEO

Crawler-ul este pornit prin `POST /api/crawl` și salvează progresul în Supabase.

```json
{
  "websiteId": "UUID_DIN_TABELUL_WEBSITES",
  "url": "https://carocakes.md"
}
```

Progresul poate fi citit prin:

```text
GET /api/crawl?id=UUID_CRAWL
```

Testare din interfață:

1. Deschide `/crawl`.
2. Selectează `Caro Cakes` și confirmă URL-ul `https://carocakes.md`.
3. Apasă `Scanează Website`.
4. Repetă pentru `VILM Group` și `https://vilmgroup.md`.
5. Deschide `/websites/[id]` și verifică taburile `Rezumat`, `Pagini`, `Audit SEO` și `Probleme`.

Crawler-ul urmărește doar linkurile interne, scanează maximum 500 de pagini, aplică un timeout de 10 secunde per cerere și două reîncercări. Adresele locale și rețelele private sunt blocate.

## OpenAI SEO Assistant

1. Rulează un crawl pentru website.
2. Deschide `/websites/[id]?tab=ai`.
3. Selectează o pagină crawl-uită.
4. Apasă `Analizează cu AI`.

Rezultatul este salvat în `ai_recommendations`, împreună cu modelul `gpt-5.4-mini`, tokenii utilizați și costul estimat.

## Google Search Console

Etapa 5 conectează VILM SEO AI la Google Search Console prin OAuth, ca aplicația să poată afișa date reale pentru website-urile monitorizate.

Ce a fost implementat:

- integrare Google OAuth pentru conectarea contului Google;
- tabel Supabase `integrations` pentru salvarea tokenurilor Google;
- criptarea tokenurilor cu AES-256-GCM înainte de salvare;
- fallback demo dacă Google nu este conectat sau nu există tokenuri;
- API routes pentru site-uri, performanță, pagini și interogări;
- pagină dedicată `/websites/[id]/search-console`;
- card de conectare când Google Search Console nu este conectat;
- afișare metrici reale: clicks, impressions, CTR și poziție medie;
- liste pentru top cuvinte cheie, top pagini, pagini cu scădere și oportunități SEO.

Fișiere importante:

- `supabase/migrations/004_google_search_console.sql`
- `lib/google/config.ts`
- `lib/google/token-crypto.ts`
- `lib/google/search-console.ts`
- `lib/google/demo-data.ts`
- `app/api/search-console/connect/route.ts`
- `app/api/search-console/callback/route.ts`
- `app/api/search-console/sites/route.ts`
- `app/api/search-console/performance/route.ts`
- `app/api/search-console/pages/route.ts`
- `app/api/search-console/queries/route.ts`
- `app/(platform)/websites/[id]/search-console/page.tsx`

Rulează în Supabase SQL Editor:

```text
supabase/migrations/004_google_search_console.sql
```

Apoi configurează `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/search-console/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=
```

În Google Cloud:

1. Activează Google Search Console API.
2. Configurează OAuth consent screen.
3. Creează un OAuth Client de tip Web application.
4. La `Authorised JavaScript origins`, adaugă `http://localhost:3000`.
5. La `Authorised redirect URIs`, adaugă exact `http://localhost:3000/api/search-console/callback`.
6. În `Audience`, adaugă contul tău Google la `Test users` dacă aplicația este în modul `Testing`.

Generează local o cheie de criptare:

```bash
openssl rand -base64 32
```

Tokenurile Google sunt criptate AES-256-GCM înainte de salvarea în tabelul `integrations`.
Pagina de date este disponibilă la `/websites/[id]/search-console`.

Testare în aplicație:

1. Pornește aplicația pe portul 3000 cu `npm run dev`.
2. Deschide `http://localhost:3000/websites`.
3. Apasă `Vezi detalii` pentru `Caro Cakes` sau `VILM Group`.
4. Apasă butonul `Search Console`.
5. Apasă `Conectează Google Search Console`.
6. Acceptă permisiunile Google.
7. După redirect, pagina trebuie să afișeze date Search Console sau fallback demo dacă proprietatea nu este găsită.

Pentru test rapid:

```text
http://localhost:3000/websites/c0000000-0000-4000-8000-000000000001/search-console
http://localhost:3000/websites/c0000000-0000-4000-8000-000000000002/search-console
```

## Keyword Research + Content Plan AI

Etapa 6 generează keyword research, clustere SEO și plan editorial AI pentru fiecare website.

Ce a fost implementat:

- agent OpenAI pentru keyword research în `lib/openai/keyword-agent.ts`;
- API route `POST /api/keywords/generate`;
- API route `POST /api/content/plan`;
- migrare Supabase `supabase/migrations/005_keyword_research.sql`;
- tabelele `keyword_research`, `keyword_clusters` și `content_plans`;
- UI interactiv pe `/keywords` cu select website, filtre și tabel;
- UI pe `/content` cu secțiunea `Plan editorial AI`;
- fallback demo pentru Caro Cakes și VILM Group dacă OpenAI sau Supabase nu sunt configurate.

Rulează în Supabase SQL Editor:

```text
supabase/migrations/005_keyword_research.sql
```

Rutele API:

```text
POST /api/keywords/generate
POST /api/content/plan
```

Input:

```json
{
  "websiteId": "UUID_DIN_TABELUL_WEBSITES"
}
```

Testare în aplicație:

1. Pornește aplicația cu `npm run dev`.
2. Deschide `/keywords`.
3. Selectează `Caro Cakes` sau `VILM Group`.
4. Apasă `Generează cuvinte cheie cu AI`.
5. Verifică tabelul, filtrele și cardurile de clustere.
6. Deschide `/content`.
7. Selectează website-ul.
8. Apasă `Generează plan editorial AI`.
9. Verifică lista de idei, keyword-ul țintă, tipul de conținut, prioritatea, outline-ul și statusul.

## AI Landing Page Generator

Generatorul creează landing pages complete din keyword-urile generate în `/keywords`.

Ce a fost implementat:

- migrare Supabase `supabase/migrations/006_generated_pages.sql`;
- tabel `generated_pages`;
- agent OpenAI în `lib/openai/landing-page-agent.ts`;
- API route `POST /api/content/generate-page`;
- API route `PATCH /api/content/generated/[id]`;
- buton `Generează Pagina` pentru fiecare keyword din `/keywords`;
- pagină editabilă `/content/generated`;
- preview complet pentru pagina generată;
- editare înainte de publicare pentru title, meta title, meta description, slug, H1, introducere, secțiuni, CTA și status;
- afișare FAQ schema.org și internal linking suggestions;
- fallback demo dacă OpenAI sau Supabase nu sunt configurate.

Rulează în Supabase SQL Editor:

```text
supabase/migrations/006_generated_pages.sql
```

Flux de testare:

1. Deschide `/keywords`.
2. Selectează website-ul.
3. Apasă `Generează Pagina` pe un keyword.
4. După generare, aplicația te duce la `/content/generated`.
5. Editează câmpurile paginii.
6. Schimbă statusul în `În review`, `Aprobat` sau `Publicat`.
7. Apasă `Salvează editările`.

## VILM AI SEO Copilot

Etapa 7 adaugă consultantul SEO AI care răspunde pe baza datelor reale din platformă, nu ca chat generic.

Ce a fost implementat:

- pagină `/assistant`;
- link `AI SEO Copilot` în sidebar;
- API streaming `POST /api/assistant/chat`;
- context SEO automat înainte de fiecare răspuns;
- salvare conversații, mesaje și snapshoturi de context;
- istoric conversații;
- selector website activ;
- panou `Context utilizat`;
- sidebar dreapta cu SEO Score, pagini indexate/neindexate, keyword principal, ultimul crawl și ultimul audit;
- întrebări rapide;
- Markdown, code blocks, loading, abort, retry și copiere răspuns;
- acțiuni rapide în răspuns: `Rulează Crawl`, `Generează Pagină`, `Optimizează`, `Vezi Keyword`, `Deschide Audit`;
- acțiuni reale contextuale pentru website-ul selectat:
  - `Rulează Crawl` pornește `POST /api/crawl` și afișează progres în chat;
  - `Generează Pagină` folosește keyword-ul recomandat/contextual și salvează pagina în `generated_pages`;
  - `Optimizează` deschide editorul `/content/generated` pentru website-ul curent;
  - `Vezi Keyword` deschide `/keywords?websiteId=...`;
  - `Deschide Audit` deschide `/audit?websiteId=...`;
- fallback demo dacă OpenAI sau Supabase nu sunt disponibile.

Rulează în Supabase SQL Editor:

```text
supabase/migrations/007_assistant_copilot.sql
```

Tabele noi:

- `assistant_conversations`
- `assistant_messages`
- `assistant_context_snapshots`

Copilotul citește automat:

- website-ul selectat;
- ultimele crawl-uri;
- audituri SEO;
- probleme SEO;
- keyword research;
- pagini generate;
- AI recommendations;
- Google Search Console;
- Google Analytics când va exista;
- activity logs;
- scoruri SEO și statusuri.

Testare:

1. Pornește aplicația cu `npm run dev`.
2. Deschide `/assistant`.
3. Selectează `Caro Cakes` sau `VILM Group`.
4. Apasă o întrebare rapidă, de exemplu `Ce probleme SEO am?`.
5. Verifică streaming-ul răspunsului.
6. Testează `Stop`, `Retry` și `Copiază`.
7. Testează acțiunile reale: `Rulează Crawl`, `Generează Pagină`, `Optimizează`, `Vezi Keyword`, `Deschide Audit`.
8. Verifică în Supabase tabelele `assistant_conversations`, `assistant_messages` și `assistant_context_snapshots`.
