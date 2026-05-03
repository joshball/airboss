# ADR 023: Flightbag as canonical references reader app

## Status

Accepted, 2026-05-03.

## Context

Today, all FAA reference content (handbooks, AIM, CFR, ACs, ACS) renders inside `apps/study/` via routes under `/library/...`. Citation chips elsewhere in study link there. As airboss grows additional consumer apps (sim, FIRC, avionics, eventually a public web surface), each would either:

1. Build its own reader — different URL per app for the same content
2. Link to study's URLs — cross-app dependency

Both options break a core property of citations: **the URL for a reference must be the same regardless of which app surface a user reaches it from.** A pilot reading a sim debrief that mentions PHAK §2.3 should get the same URL as a study card citing the same section. That URL should be copy-paste portable across apps and eventually a public web context.

The user articulated the requirement plainly: "you couldn't share a URL from one platform to another (of the same reference) without having access to both platforms. Hence the need for [a single] library app."

## Decision

Stand up `apps/flightbag/` as the canonical reader for FAA reference content. Other apps (study, sim, hangar, future FIRC) link to flightbag URLs from their citation chips. Hangar continues to own admin/management of references; flightbag stays admin-free.

### Naming: flightbag

Aviation-authentic, matches what every pilot literally carries (handbooks, charts, regs, plates, ACs, ACS — exactly the airboss reference corpus). Distinct in the domain; readable as URL (`flightbag/handbook/phak/...`).

### Architecture

| Concern | Lives in |
|---------|-----------|
| Reader app | `apps/flightbag/` |
| Reference rendering primitives (`<RenderedSection>`, `<CitationChip>`) | `libs/library/` |
| URL string templates | `libs/constants/src/routes.ts` (`ROUTES.FLIGHTBAG_*`) |
| URI-to-URL bridge (`urlForReference(uri)`) | `libs/sources/` (next to existing resolvers) |
| Data layer (manifests, registry, URI scheme) | `libs/sources/` (existing, unchanged) |

URL templates go in `libs/constants/` (not in `libs/library/`) because:
- Every other route in airboss already lives there (project rule, no inline path strings)
- Constants is leaf in the dependency graph — any lib or app can import it
- `libs/library/` should own RENDERING knowledge, not URL formatting

The bridge helper goes in `libs/sources/` (not in `libs/library/`) because:
- It takes an `airboss-ref:` URI as input — URI scheme is owned by `libs/sources/`
- Output is built via `ROUTES.FLIGHTBAG_*` constants
- `libs/sources/` already calls `libs/constants/`; this just adds another helper

### Admin separation

Reference admin (TOC validation, force-reingest, per-reference health checks) lives in `apps/hangar/admin/references/` — NOT in flightbag.

Reasons:
- Hangar already has admin auth + audit log + content-authoring mission
- Flightbag is public-facing (or eventually); admin UI doesn't belong there
- Hangar already handles other admin surfaces (audit, users, invitations)

### URL shape examples

```text
flightbag/handbook/phak/8083-25C/2/3              # PHAK Ch 2 §3
flightbag/aim/4/3/2                                # AIM 4-3-2
flightbag/cfr/14/91/103                            # 14 CFR §91.103
flightbag/ac/61-65/j                               # AC 61-65J
flightbag/acs/ppl-airplane/area-1/task-A           # PPL ACS Area I Task A
```

The `airboss-ref:` URI scheme (ADR 019) maps to flightbag URLs via `urlForReference(uri)`.

## Consequences

### Positive

- **Cross-app citation deep-linking**: any app can link to any reference via `urlForReference()`; user copy-pastes URLs across surfaces; stable.
- **Future-proofs public web**: when airboss goes external, flightbag is the natural public-facing surface.
- **Clean separation of concerns**: reader vs admin vs authoring all distinct apps; data layer shared.
- **No magic strings**: URLs go through constants per project rule.

### Negative

- **Migration cost**: existing study `/library/...` routes need to move to `apps/flightbag/`; citation chips need to rewire to use `urlForReference()`. Tracked as a separate WP.
- **Cross-domain link possibility**: if flightbag deploys at a separate hostname (e.g. `flightbag.airboss.dev`), citation links from study leave the SPA. Acceptable for a reader; it's a destination not a workflow surface.
- **One more app to maintain**: another deploy target. Mitigated by flightbag being mostly-static (read-only, no admin).

### Neutral

- **Hangar stays the references admin home**, not flightbag. Some teams might expect "library" to include admin; we explicitly don't.

## Alternatives considered

### A: Reader stays in study; sim/FIRC/etc. link to study's URLs

Rejected: cross-app dependency on study's deployment + URL scheme.

### B: Each app builds its own reader

Rejected: duplicate URLs for the same content; copy-pasted citations don't work across surfaces.

### C: `libs/library/` includes both rendering AND a route module

Rejected: mixes concerns. `libs/library/` should render. `apps/flightbag/` owns routes. `libs/constants/` owns URL strings. Three different concerns, three locations.

## Sequencing

This ADR ratifies the architecture. The implementation lands across multiple WPs:

1. **Flightbag scaffold** (in flight) — `apps/flightbag/` + `libs/library/` + `urlForReference()` + `ROUTES.FLIGHTBAG_*`. Routes are placeholders; data flows end-to-end.
2. **Section-tree promotions** (in flight, parallel) — every reference becomes section-tree before flightbag becomes the source of truth.
3. **Citation migration** ([WP-CITATION-CHIPS-TO-FLIGHTBAG](../../work-packages/wp-citation-chips-to-flightbag/)) — study citation chips link to flightbag.
4. **Hangar admin dashboard** ([WP-HANGAR-REFS](../../work-packages/wp-hangar-references-dashboard/)) — references admin in hangar.
5. **Deprecate study `/library/...`** — once citations migrated and flightbag has feature parity.

## References

- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md)
- [docs/platform/REFERENCES_ROADMAP.md](../../platform/REFERENCES_ROADMAP.md)
- [docs/products/flightbag/VISION.md](../../products/flightbag/VISION.md)
- [ADR 019 — `airboss-ref:` URI scheme](../019-reference-identifier-system/decision.md)
- CLAUDE.md "no inline path strings" rule
