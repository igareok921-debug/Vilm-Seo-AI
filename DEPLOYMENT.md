# Deploy VILM SEO AI through GitHub

This project is ready to be deployed from a GitHub repository to Vercel, but production requires the database migrations and environment variables below.

## 1. Before pushing to GitHub

Do not commit local secrets.

Tracked:

- application code
- `supabase/migrations`
- `.env.example`
- `package-lock.json`

Ignored:

- `.env.local`
- `.env.*.local`
- `.next`
- `.next-dev`
- `node_modules`
- `.vercel`
- generated local PDFs in `public/reports`

## 2. Supabase

Run all migrations in order from `supabase/migrations`.

Required latest migrations include:

- `014_auth_multi_user.sql`
- `015_auth_rls_fix.sql`
- `016_website_ownership.sql`
- `017_ai_content_org_isolation.sql`
- `020_crawl_page_snapshots.sql`
- `021_usage_limits.sql`
- `022_app_language.sql`
- `023_website_status_values.sql`

For commercial deployment, avoid loading demo seed data unless you explicitly want demo accounts.

## 3. Vercel environment variables

Set these in Vercel Project Settings -> Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-production-domain.com/api/search-console/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed in client components.
- `GOOGLE_TOKEN_ENCRYPTION_KEY` should be a strong 32-byte base64 value.
- `NEXT_PUBLIC_APP_URL` must match the production domain.

Generate a Google token encryption key locally:

```bash
openssl rand -base64 32
```

## 4. Supabase Auth URLs

In Supabase Authentication settings, configure:

- Site URL: `https://your-production-domain.com`
- Redirect URL: `https://your-production-domain.com/auth/callback`

For local development keep:

- `http://localhost:3000/auth/callback`

## 5. Google Search Console OAuth

In Google Cloud Console:

- enable Google Search Console API
- add production domain to authorized JavaScript origins
- add `https://your-production-domain.com/api/search-console/callback` to authorized redirect URIs

## 6. PDF generation on Vercel

Reports use HTML + Puppeteer. Local development works with `puppeteer`.

For Vercel/serverless, full Puppeteer can be heavy. The generator already attempts to load `@sparticuz/chromium` when `VERCEL` is set. Before production PDF testing on Vercel, install and test:

```bash
npm install @sparticuz/chromium
```

Then run:

```bash
npm run build
```

If Vercel still fails during report generation, move PDF generation to a background worker or a larger Node runtime.

## 7. Final checks before deploy

Run locally:

```bash
npm run lint
npm run build
```

Manual smoke test:

- register/login with Google
- add a new website
- run crawl
- run audit
- generate keywords
- generate content
- generate PDF report
- delete report
- delete website
- verify a second user cannot see the first user's website

## 8. GitHub push

After Git is initialized:

```bash
git add .
git commit -m "Prepare VILM SEO AI for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

Then import the repository in Vercel and set the environment variables above.
