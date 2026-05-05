# Security review -- study-ia-cleanup Phase 2

issues_found: 2

## SEC-1 (minor) -- `?tab=` allowlist is enforced server-side; bogus values silently fall back

`apps/study/src/lib/program/default-tab.ts` `parseProgramTab` returns `null` for any value not in `PROGRAM_TAB_VALUES`. The `+page.server.ts` then falls through to `parent.defaultTab`. No path injection vector -- the value is never used to build a URL fragment that escapes the allowlist.

A more conservative posture is to 400 on a malformed `?tab=` so client misuse surfaces loud. But SH-23 (study-home WP) chose silent fallback for `?tab=` on `/study`; this WP mirrors that precedent. Consistent.

No fix.

## SEC-2 (nit) -- 4 new `PAGE_EXPLAINER_KEYS` registered; closed allowlist still enforced

`libs/constants/src/study-home.ts` adds `PROGRAM_QUALS`, `PROGRAM_GOAL`, `PROGRAM_PLAN`, `PROGRAM_COVERAGE`. The `apps/study/src/routes/api/page-explainer/+server.ts` validator (Phase 1) refines pageKey via `isPageExplainerKey`, so the new keys take effect automatically without endpoint changes. Defense-in-depth still holds.

No fix.
