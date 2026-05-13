---
id: bug-flightbag-library-smoke-pre-existing
title: "Flightbag library Playwright smoke ERR_INVALID_REDIRECT -- pre-existing untriaged"
product: flightbag
severity: minor
status: open
discovered_pr: null
discovered_date: 2026-05-13
fix_pr: null
fix_wp: null
tags:
  - flightbag
  - playwright
  - e2e
  - pre-existing
---

# Flightbag library Playwright smoke `ERR_INVALID_REDIRECT` -- pre-existing untriaged

## Context

`tests/e2e/browser-hydration-smoke.spec.ts` covers a handful of authenticated routes against the study + flightbag dev servers, asserting no `node:fs externalized` / `Buffer is not defined` / `postgres` client-bundle leaks.

During the Phase 3 palette work (2026-05-11 / 2026-05-12), one of the smoke routes -- `/library` -- consistently failed with `ERR_INVALID_REDIRECT`. The agent investigating the Buffer leak verified this failure reproduces on `origin/main` (so not caused by Phase 3) and labelled it "pre-existing, unrelated."

I never followed up to actually verify or fix it.

## Repro (claim)

1. `bun scripts/dev.ts study flightbag` in the parent repo with `.env` populated
2. `bunx playwright test tests/e2e/browser-hydration-smoke.spec.ts --grep "library"` (or whatever grep pattern targets the `/library` route case in the smoke spec)
3. Expect: `ERR_INVALID_REDIRECT` from chromium when hitting the route

## What "untriaged" means here

I don't actually know:

- Whether the smoke spec's `/library` route is still in the route list (Phase 2 of WP-flightbag-reader-ux retired study `/library/*` with 301 redirects -- the smoke may be hitting a stale route that bounces between origins)
- Whether the redirect chain is what's failing or whether the destination is what's failing
- Whether it's a chromium quirk vs a real bug

## Triage steps

1. Open `tests/e2e/browser-hydration-smoke.spec.ts` and find the `/library` test case
2. Verify what URL it actually hits and what's expected
3. Run the spec in isolation against the parent repo with `.env` populated
4. If the redirect chain is the issue: check `apps/flightbag/src/routes/library/+server.ts` (or equivalent) for the redirect target
5. If it's a stale route: update the smoke spec to hit a current URL
6. If it's a real bug: file a follow-up, fix in a small PR

## Severity

Minor -- the smoke is a regression net for `node:fs` / `Buffer` hydration leaks (already serving its purpose for those). One failing route doesn't blind the rest. But: untriaged failures in a regression suite erode trust in the suite over time. Fix when convenient.

## Related

- WP-flightbag-reader-ux (PR #841) -- introduced the `/library/*` retirement that may have invalidated the smoke route
- `docs/agents/debug-playbooks/browser-hydration.md` -- the playbook the smoke spec backs up
