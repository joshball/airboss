---
title: 'WP-MTN -- test plan'
type: test-plan
status: in-progress
---

# Test plan

## Automated

- **Locator regex**: positive case for `tips-mountain-flying/mtn-2003`. Negative case held by existing edition-malformed test.
- **Registry tests** (handbooks-extras smoke): `faa-mtn-tips` shows up in YAML iteration and DOC_ID_TO_FRIENDLY lookup.
- **Seed integration** (existing `seed-references-from-manifest.test.ts` covers the whole-doc path; no new test required unless the new manifest exposes a gap).

## Manual

- `bun run db reset --force && bun run db seed`. No errors.
- Visit `/library` (logged in as Abby). Locate the *Tips on Mountain Flying* card. Card shows "Read in-app".
- Click through. The body renders.
- Cross-check: card appears in topic spine for each of `performance`, `weather`, `emergencies`. Does NOT appear under any specific cert spine (cert-agnostic).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
