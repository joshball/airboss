# Flightbag

The canonical reader for FAA reference material in airboss. Where any pilot, instructor, sim user, FIRC student, or future external visitor goes to read a handbook, regulation, AC, ACS, AIM section, or any other reference cited in airboss content.

> **Name origin:** every pilot's flightbag holds the same things — handbooks, charts, regs, ACs, ACS, plates. The app's name reflects what it contains.

## What flightbag is

A SvelteKit app at `apps/flightbag/` whose only job is to render FAA reference content beautifully and link-stably.

- **Read-only.** No authoring. No admin. (Authoring is hangar; admin is hangar.)
- **Section-tree native.** Every reference renders with chapter/section/paragraph drill-down. No whole-doc dumps.
- **Deep-linkable.** Every section has a stable URL that's safe to share, copy-paste between apps, embed in study cards, etc.
- **Cross-app citation target.** Study's citation chips link here. Sim's debrief cross-refs link here. FIRC's regulatory anchors link here.
- **Eventually public.** When the platform goes external, flightbag is the natural public-facing surface — the FAA reference library on airboss.dev.

## What flightbag is NOT

- **Not** an authoring app. Hangar owns content authoring + admin.
- **Not** a study tool. Study owns spaced repetition, scenarios, calibration.
- **Not** a sim. Sim owns physics + scenarios + grading.
- **Not** an admin dashboard. The references admin (TOC validation, force-reingest, health checks) lives in `apps/hangar/admin/references/`.

## URL shape

Every reference type has a deterministic URL pattern via `ROUTES.FLIGHTBAG_*` in `libs/constants/src/routes.ts`. Examples:

- `flightbag/handbook/phak/8083-25C/2/3` → PHAK Chapter 2 Section 3
- `flightbag/aim/4/3/2` → AIM 4-3-2
- `flightbag/cfr/14/91/103` → 14 CFR §91.103
- `flightbag/ac/61-65/j` → AC 61-65J
- `flightbag/acs/ppl-airplane/area-1/task-A` → PPL ACS Area I Task A

The `airboss-ref:` URI scheme (ADR 019) maps to flightbag URLs via `urlForReference(uri)` in `libs/sources/src/url-for-reference.ts`. Every other app calls that helper rather than constructing URLs inline (CLAUDE.md "no magic strings" rule).

## Architecture

| Layer                                                                 | Where it lives                                        |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| App                                                                   | `apps/flightbag/`                                     |
| Citation rendering primitives (`<RenderedSection>`, `<CitationChip>`) | `libs/library/`                                       |
| URL constants                                                         | `libs/constants/src/routes.ts` (`ROUTES.FLIGHTBAG_*`) |
| URI-to-URL bridge                                                     | `libs/sources/src/url-for-reference.ts`               |
| Data layer (resolvers, manifests, registry)                           | `libs/sources/` (existing)                            |
| Reference content (markdown bodies, manifests)                        | `handbooks/`, `aim/`, `ac/`, `acs/`, `regulations/`   |

## Reading model

Each reference renders as:

1. **Document landing page** — overview, ToC, metadata
2. **Chapter pages** — chapter-level navigation, prev/next chapter, link to parent doc
3. **Section pages** — the actual readable content; rendered markdown body; figures inline; tables inline; deep-link target

Cross-references inside section bodies (e.g. an AIM paragraph referencing 14 CFR §91.103) render as `<CitationChip>` — clickable, link to the target section in flightbag, hover preview.

## Future surfaces

- **Public web** at `flightbag.airboss.dev` (or similar) once the platform goes external. References are FAA-published, so public sharing is straightforward.
- **Embed** widgets — third parties (flight schools, blogs) could embed a citation chip that links back to flightbag.
- **Mobile-first reading** — pilots reading on phones in the cockpit before flight; layouts optimized for that.

## Anchors

- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md) — canonical reference list + architecture decision
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) — surface-typed app breakdown
- [ADR 019](../../decisions/019-reference-identifier-system/decision.md) — `airboss-ref:` URI scheme
- [docs/work-packages/flightbag-scaffold/](../../work-packages/flightbag-scaffold/) — initial scaffold WP
- [docs/work-packages/wp-citation-chips-to-flightbag/](../../work-packages/wp-citation-chips-to-flightbag/) — migration WP
