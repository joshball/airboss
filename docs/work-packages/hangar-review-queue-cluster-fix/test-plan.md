---
id: hangar-review-queue-cluster-fix
type: test-plan
created: 2026-05-08
---

# Test plan: Hangar Review Queue e2e Cluster Fix

The bug was discovered by the e2e suite, so the regression test bar IS the e2e suite. This plan layers automation + a real-browser manual pass on top.

## Automated

| Suite                                                       | Pass criterion                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `bun run test e2e --project=hangar-review-queue`            | 24/24 specs pass on first attempt                                                                                               |
| `bun run test e2e --project=hangar-review-queue-unauthed`   | All currently-passing specs stay green                                                                                          |
| `bun run check all`                                         | 0 errors, 0 warnings (in particular `scripts/check-browser-globals.ts` clean)                                                   |
| `tests/e2e/browser-hydration-smoke.spec.ts` (after phase 1) | New assertions for `/review`, `/review/wp_spec/<id>`, `/review/wp_spec/<id>/walker` - no `Buffer is not defined` console errors |

## Manual (real browser)

Per [CLAUDE.md](../../../CLAUDE.md): **Vitest passing is not browser-correct.** Verify in Chrome before claiming done.

1. Boot the hangar app: `bun scripts/dev.ts clean && bun --cwd apps/hangar run dev`
2. Open Chrome devtools (Console panel)
3. Navigate to `http://localhost:9603/review` - expect zero console errors
4. Click any board card (a wp_spec with seeded review_item rows) - expect zero console errors, page renders the spec view with tabs
5. Click into the test-plan walker tab - expect zero console errors, walker renders progress aside
6. Open the docs reader at `/docs` - type "discovery-first pedagogy" - expect popover renders search hits
7. Open `/docs/CLAUDE.md` - expect article renders (or, if the test was retargeted in phase 3, confirm the new target works)
8. Submit a malformed predicate at `/review/admin/buckets/new` - expect inline validation error renders
9. Submit a new ad-hoc task at `/review/tasks/new` with empty title - expect "title is required" inline error

A pass on automation + a pass on manual = done.

## Regression bar

The browser-hydration-smoke spec MUST grow to cover the affected hangar routes. The /memory crash family taught us that any route ungated by the smoke spec is a route where a Buffer leak ships silently. Phase 1 adds `/review`, `/review/wp_spec/<id>`, `/review/wp_spec/<id>/walker` to the smoke list. If a future commit reintroduces the leak, that spec fails in <30s, not in a 24-spec cascade.
