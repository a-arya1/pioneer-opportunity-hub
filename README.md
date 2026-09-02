# Pioneer Opportunity Hub

A mobile-first, local opportunity directory for Pioneer High School students. It imports the supplied Excel inventory, keeps provenance and unknown values intact, classifies Exact/Likely/Near matches before ranking, and runs without production credentials.

## Run locally

```bash
pnpm install
pnpm import:opportunities ann-arbor-high-school-opportunity-inventory.xlsx
pnpm dev
```

Open `http://localhost:5173`. Local saves use browser storage. Sign-in, cloud sync, and email are visibly disabled until configured; the app never claims an email was sent.

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

1. Create a Supabase project and run `supabase/migrations/202608250001_initial.sql` with the Supabase CLI or SQL editor.
2. Copy `.env.example` to `.env.local`; set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_EMAIL_ALLOWLIST`.
3. Configure magic-link authentication and redirect URLs. Require MFA for allowlisted administrators.
4. Import the workbook, commit generated source data or replace the local repository adapter with Supabase queries, then deploy with Vercel (`pnpm build`, output `dist`).
5. Add a transactional email provider only for requested reminders. Until then, use local/in-app saves and calendar export; do not set a provider value.
6. Configure first-party/cookieless analytics only after privacy review. Nonessential analytics remain off by default.

Never expose the service-role key to Vite/client code. Admin mutations must use a server/edge function that verifies both the authenticated user and allowlist role. Public submissions always enter `pending` moderation state.

## Architecture and data dictionary

- `src/data/opportunities.json`: generated local repository with workbook provenance.
- `scripts/import-opportunities.ts`: idempotent, row-tolerant Excel importer and report.
- `src/lib/matching.ts`: tri-state requirement evaluation and versioned explanations.
- `src/pages`: public directory, detail, saved, submission, policy, auth, admin-denied, and 404 states.
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
- Defaults: security logs 30 days, pseudonymous analytics 12 months, anonymous unverified submissions 12 months, deleted active account data within 30 days, backups about 90 days.
- Complete school/district, legal, minors/privacy, accessibility, vendor, and incident-response review before an official launch. No compliance claim is made here.

## Known limitations

- Production authentication, server-side moderation, reminders, analytics, and monitoring require real credentials and deployment functions.
- Demo filtering covers the strongest structured fields available in the workbook; precise ages, transit time, accessibility, fee bounds, and hours need provider-confirmed structured data.
- The workbook is a point-in-time source dated 2026-08-25. Closed and “verify” rows are retained for review but hidden by default.
- An official current Pioneer club roster and provider ownership confirmations are still required.
