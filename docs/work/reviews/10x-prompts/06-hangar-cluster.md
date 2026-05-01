# Chunk 6 -- Hangar cluster (app + jobs + sync + BC)

Paste the block below as the first message in a fresh Claude Code session.

---

```text
/ball-review-10x

Scope is locked. Do NOT re-negotiate it -- review exactly what is listed below.

## What to review
The hangar product and its supporting infrastructure -- authoring, admin, source ingest UI, job queue, TOML mirror sync.

- `apps/hangar/` -- entire app:
  - `apps/hangar/src/routes/(app)/{admin,api,glossary,jobs,sources,users}/`
  - `apps/hangar/src/routes/(app)/+layout.*`, `+page.*`
  - `apps/hangar/src/routes/(app)/login/`, `(app)/logout/`, `appearance/`, `theme/`
  - `apps/hangar/src/lib/` if present
  - `apps/hangar/src/hooks.*.ts`, `apps/hangar/svelte.config.js`, `apps/hangar/vite.config.ts`
- `libs/hangar-jobs/` -- generic job queue infra used by hangar
- `libs/hangar-sync/` -- TOML mirror sync engine (DB <-> seed files)
- `libs/bc/hangar/` -- entire BC, including:
  - Form schemas + helpers: `form-helpers.ts`, `form-schemas.ts`, `reference-form*.ts`, `source-form*.ts`, `user-write-schemas.ts`
  - User write surface: `user-writes.ts`, `user-writes.guards.test.ts`, `user-writes.test.ts`
  - Jobs: `jobs.ts`, `jobs-queries.ts`, `source-jobs.ts`
  - Audit: `audit-queries.ts`
  - Dashboard: `dashboard-queries.ts`
  - Edition stub: `edition-stub.ts`
  - Registry: `registry.ts`
  - Source fetch + upload: `source-fetch.ts`, `upload-handler.ts`, `upload-helpers.ts`
  - Schema: `schema.ts`
  - Users: `users.ts`
  - All co-located tests

## What is NOT in scope
- Per project memory, the FIRC-era hangar PRD is dormant (archived under `.archive/firc-era/products/hangar/` per ADR 017). Do NOT review or rebuild dormant features.
- `libs/sources/` -- source ingest pipeline. Chunk 4. Hangar consumes it; review the consumption boundary, not the pipeline itself.
- `libs/auth/`, `libs/audit/` -- chunk 3. Read for context if hangar wires into them.
- Other apps and BCs.

If hangar code calls into other libs, READ those files for context but do not raise findings outside the hangar cluster.

## Project context the reviewers must respect
- Read `CLAUDE.md` at repo root.
- Read ADR 017 (or check `.archive/firc-era/products/hangar/` for the dormancy boundary). FIRC compliance surface is dormant.
- Hard rules: Svelte 5 runes only, Drizzle ORM only (no raw SQL), no `any`, no magic strings, all routes through `ROUTES`, `@ab/*` aliases, IDs via `createId()`.
- This is the admin/authoring surface. Permissions and write boundaries are critical -- the security reviewer should examine `user-writes.ts`, `user-writes.guards.test.ts`, and the form-action / API endpoint authorization flows carefully.
- Job queue review: idempotency, retries, dead-letter behavior, observability, lock semantics.
- TOML sync review: round-trip correctness (DB <-> seed files), conflict resolution, atomic write semantics, what happens on partial sync.
- Upload handler review: file-type validation, size limits, path traversal, MIME sniffing, virus/macro risk.

## Reviewers to launch (floor -- detect stack and add more if appropriate)
Core: correctness, security, perf, architecture, a11y, patterns, testing, dx.
SvelteKit-specific: ux, svelte, backend.
Stack-specific: schema (hangar BC owns several tables; jobs lib likely owns a job table).
Skip: tauri/rust/dotnet/maui.

## Spec context
Check `docs/work-packages/` for hangar-, jobs-, sync-, source-ingest-related packages. Check `docs/decisions/` for ADRs 017, 018, and any others touching hangar, authoring, sync, jobs. Pass matching content to the relevant agents.

## Output
Each agent writes one review file to `docs/work/reviews/{YYYY-MM-DD}-hangar-cluster-{category}.md`. After all agents complete, build the summary table and report findings. Do NOT auto-fix -- present the punch list and await my call on `/ball-review-fix`. Critical findings in security (permissions, upload, write boundaries) and in job-queue / sync correctness should be flagged at the top of the summary.
```
