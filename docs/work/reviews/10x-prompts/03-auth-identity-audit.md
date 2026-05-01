# Chunk 3 -- Auth, identity, audit

Paste the block below as the first message in a fresh Claude Code session.

---

```text
/ball-review-10x

Scope is locked. Do NOT re-negotiate it -- review exactly what is listed below.

## What to review
The cross-cutting identity and audit surface. This is the security-critical chunk -- give it weight.

- `libs/auth/src/` -- entire directory:
  - `auth.ts`, `client.ts`, `server.ts`, `index.ts`
  - `cookies.ts`, `logout.ts`
  - `queries.ts`, `rate-limit.test.ts`
  - `columns.ts` (identity column helpers)
  - `schema.ts` (identity schema)
  - `email/` (whatever lives there -- magic links, verification, etc.)
  - co-located tests: `auth.test.ts`, `queries.test.ts`, `rate-limit.test.ts`
- `libs/audit/` -- entire library (audit_log schema, write helpers, query surface).
- Any login/logout SvelteKit endpoints in `apps/study/src/routes/(app)/login/`, `apps/study/src/routes/(app)/logout/`, `apps/hangar/src/routes/(app)/login/`, `apps/hangar/src/routes/(app)/logout/` -- include these because auth is meaningless without the wiring at the route boundary.
- `apps/*/src/hooks.server.ts` -- session loading hook is auth-adjacent.

## What is NOT in scope
- `libs/bc/study/credentials.ts` -- pilot credentials (different concept from auth credentials). Reviewed in chunk 2.
- General app routes outside login/logout. Reviewed in chunks 1 and 6.
- Dev-seed setup scripts unless they touch auth schema directly.

## Project context the reviewers must respect
- Read `CLAUDE.md` at repo root.
- Hard rules: no raw SQL (Drizzle only), no `any`, no magic strings, IDs via `createId()` from `@ab/utils`, all routes through `ROUTES` constant, `@ab/*` aliases.
- This is the security-critical chunk. The security reviewer should be exhaustive: session token lifecycle, cookie flags (HttpOnly, Secure, SameSite), CSRF posture for form actions, rate-limit coverage, password/magic-link flow, timing-attack resistance, log-injection in audit writes, PII handling, email-template injection.
- Memory note: per project memory, all seeded test data owns to `abby@airboss.test`. If you see special-cased dev users in production code paths, flag.

## Reviewers to launch (floor -- detect stack and add more if appropriate)
Core: correctness, security, perf, architecture, patterns, testing, dx.
Stack-specific: schema (auth + audit tables), backend (route-level wiring).
Skip: ux, svelte (minimal UI here), a11y (login/logout pages should still be a11y-checked -- include a11y if those pages are in scope).
Include a11y for the login/logout pages only.

## Spec context
Check `docs/work-packages/` for any auth- or session-related packages. Check `docs/decisions/` for ADRs touching auth, sessions, audit, identity. Pass any matching `spec.md` and ADR `decision.md` content to the relevant agents.

## Output
Each agent writes one review file to `docs/work/reviews/{YYYY-MM-DD}-auth-identity-audit-{category}.md`. After all agents complete, build the summary table and report findings. Do NOT auto-fix -- present the punch list and await my call on `/ball-review-fix`. Critical findings in security should be flagged at the top of the summary regardless of count.
```
