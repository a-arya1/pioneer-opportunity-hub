# Pioneer Opportunity Hub

A mobile-first, local opportunity directory for Pioneer High School students. It imports the supplied Excel inventory, keeps provenance and unknown values intact, classifies Exact/Likely/Near matches before ranking, and runs without production credentials.

## Run locally

```bash
pnpm install
pnpm import:opportunities ann-arbor-high-school-opportunity-inventory.xlsx
pnpm dev
```

Open `http://localhost:5173`. Without an account, saves remain in browser storage. When Supabase is configured, passwordless email sign-in and private cross-device save syncing are enabled.

## Verify

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

Importer dry run:

```bash
pnpm import:opportunities ann-arbor-high-school-opportunity-inventory.xlsx --dry-run
```

The importer finds the `Opportunities` sheet, locates and validates its header, trims whitespace, converts blank cells to `null`, canonicalizes URLs, removes common tracking parameters, normalizes status, generates stable slugs, detects duplicate organization/title/source tuples, rejects malformed rows without aborting, records the workbook hash and source row, and excludes closed/verify records from publication. Re-running produces the same generated dataset instead of duplicates. In production, use `import_batches.content_hash` and upsert by workbook ID.

## Production database and deployment

1. Create a Supabase project and run every SQL file in `supabase/migrations` in filename order with the Supabase CLI or SQL editor.
2. Copy `.env.example` to `.env.local`; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project API settings.
3. In Supabase Auth URL configuration, add the localhost, Firebase Hosting, GitHub Pages, and Vercel roots as permitted redirect URLs. Keep leaked-password protection on and configure CAPTCHA before a broad public launch.
4. Add the same two public values as GitHub Actions secrets and Vercel environment variables, then rebuild both deployments. The Firebase mirror reads the values during its local production build.
5. Test sign-in, cross-device saves, global sign-out, account deletion, and cross-account isolation before sharing accounts publicly.

Never expose a service-role key to Vite/client code. The browser uses only the project URL and publishable key; database row-level security remains the authorization boundary. Admin mutations must use a server/edge function that independently verifies authorization.

The repository also includes `firebase.json` and `.firebaserc` for the no-cost Firebase Hosting mirror. Build with the public Supabase URL and publishable key, then deploy with `firebase deploy --only hosting`. The single-page rewrite keeps direct links such as `/opportunities` and `/impact` working.

### Privacy-safe impact measurement

Set `VITE_ANALYTICS_ENABLED=true` to offer visitors an optional anonymous measurement choice. No analytics are recorded before consent. The browser sends only an allowlisted event name, a temporary random session ID, an optional opportunity ID, and a coarse page category—never an email address, search text, or selected filters. Raw events are blocked from browser reads, retained for 12 months, and exposed publicly only through aggregate counts on `/impact`.

Signed-in students can privately mark a saved opportunity as applied or participated. Row-level security keeps those records account-scoped; the public dashboard receives combined totals only. Treat the dashboard as a transparent project estimate rather than audited evidence because consent choices, multiple devices, and voluntary outcome reporting can undercount or overcount activity.

The feedback form does not request a name or email address. Ratings, audience type, recommendation choice, and optional comments are stored privately for 12 months; only combined response counts and ratings appear on `/impact`. Listing suggestions and correction reports follow the same private 12-month retention rule. Review them in the Supabase dashboard rather than exposing raw responses through the public API.

Published listings show a visible freshness state based on `lastVerified`: recently checked through 45 days, review soon from 46–90 days, and needs rechecking after 90 days. Stale listings remain clearly marked and link directly to a prefilled correction report.

## Architecture and data dictionary

- `src/data/opportunities.json`: generated local repository with workbook provenance.
- `scripts/import-opportunities.ts`: idempotent, row-tolerant Excel importer and report.
- `src/lib/matching.ts`: tri-state requirement evaluation and versioned explanations.
- `src/pages`: public directory, detail, saved, feedback, submission/correction, impact, policy, auth, admin-denied, and 404 states.
- `supabase/migrations`: PostgreSQL schema, indexes, and initial row-level security.
- `src/lib/retention.ts`: single source of truth for retention defaults and analytics redaction.

Core database tables cover organizations, opportunities, eligibility rules, taxonomy, source records, profiles, private saves/reminders, submissions, change requests, organization claims, source channels, imports, moderation events, and privacy-minimal analytics. Exact addresses are never requested for students; public venue coordinates only belong on opportunities.

## Matching

Hard filters evaluate `PASS`, `FAIL`, or `UNKNOWN`. Unknown is never pass; closed listings fail regardless of keyword relevance. Exact/Likely/Near/Explore classification happens before soft ranking. Explanations retain passed, failed, unknown, matched, and relaxed constraints plus algorithm version. The demo implements the core fields available in the workbook; production can expand structured `eligibility_rules` without rewriting ranking.

## Moderation and ingestion policy

Prefer API, RSS, iCal, export, or partner submission; then permitted public monitoring or manual review. Check terms, robots rules, and rate limits before automation. Never bypass authentication, scrape student systems, publish private contacts, or copy long provider text. Store concise factual summaries and the official source. Provider and public submissions cannot self-publish. Verify badges require a method and date; stale or ambiguous records leave default results.

The public web cannot establish a complete current Pioneer club roster. Current club coverage must remain labeled as a verified public subset until counseling, advisers, or club leaders confirm the official roster.

## Security, backup, and privacy checklist

- Enforce RLS and server-side admin authorization; test cross-account isolation before launch.
- Add rate limiting, bot protection, CSP/secure headers, URL validation, schema validation, audit logging, dependency scanning, and restricted upload types at the deployment edge.
- Keep secrets in hosting configuration. Rotate keys after suspected disclosure.
- Enable Supabase point-in-time recovery or daily backups. Quarterly: restore into an isolated project, run integrity checks, document timing, then destroy the test project.
- Defaults: security logs 30 days, pseudonymous analytics 12 months, anonymous feedback and unverified submissions 12 months, deleted active account data within 30 days, backups about 90 days.
- Complete school/district, legal, minors/privacy, accessibility, vendor, and incident-response review before an official launch. No compliance claim is made here.

## Known limitations

- Authentication requires a configured Supabase project. Server-side moderation, reminders, analytics, and monitoring still require separate production services.
- Demo filtering covers the strongest structured fields available in the workbook; precise ages, transit time, accessibility, fee bounds, and hours need provider-confirmed structured data.
- The workbook is a point-in-time source dated 2026-08-25. Closed and “verify” rows are retained for review but hidden by default.
- An official current Pioneer club roster and provider ownership confirmations are still required.
