---
type: walkthrough-rollup
sessions: 25
first_rolled: 2026-05-17T21:02:21Z
last_rolled: 2026-05-18T03:10:00Z
consumed:
  - 0160f787-1218-43bd-8d38-56fb67570489
  - 20260515-180643-56167
  - 20260515-180930-60283
  - 20260515-181752-71057
  - 20260515-181801-71712
  - 20260515-223922-1639
  - 80d9ef12-fb09-413b-8ec5-22edba98423c
  - 9d89e07b-d64e-478c-bf06-b7658c4674b5
  - afc4eeb6-67f0-4d4e-b34e-5401e4a18613
  - ba6a23ad-37e1-49b3-ad2e-e11bdee12068
  - cd16e567-1d20-4267-86c4-750e4beac0fb-tests-validator
  - cd16e567-1d20-4267-86c4-750e4beac0fb
  - d83e4218-eda8-4ec0-bb92-2faf2f55eddc
  - 17883a4e-b98f-46fb-9528-2749da908b71
  - 20260517-145336-25547
  - 20260517-155020-81423
  - 20260517-160100-94636
  - 20260517-163554-26560
  - 9b64fd7c-3daa-4190-a412-0f87197e476e
  - e76c9f78-a389-4c89-8c61-10fc4ee1e108
  - 20260517-212403-79769
  - 20260517-212610-82094
  - 20260517-215641-9754
  - 20260517-222752-41597
  - 5756488e-807a-478e-91ad-f15964f9d39e
---

# Walkthrough -- Rollup

Consolidated manual-test entry points from 25 wind-down sessions across 2 days. Grouped by surface. URLs are as recorded by each session (dev hosts vary -- `localhost:5173`, `localhost:9600`, `study.airboss.test`; substitute your running dev host).

## Aviation weather products reference

- **Index**: `http://study.airboss.test/reference/wx/products` -- 25 products, grouped by category, status badges.
- **Detail**: `/reference/wx/products/<slug>` (metar, taf, airmet, sigmet, pirep, ...). Frontmatter sidebar, decode tables, real archived example bulletins, cross-links to related products + knowledge nodes.
- **Nav**: `/reference` landing page now shows a "Weather products" card.

## weather-comprehensive course

- **Landing**: `http://study.airboss.test/courses/weather-comprehensive`
- **Sections**: `/courses/weather-comprehensive/s1` .. `/s11.*` -- section-intro prereq framing, `:::phase` directives, chart embeds, scenario panels, wiki-links (now dual-linked to both knowledge nodes and product reference pages).

## Knowledge graph

- **Learn pages**: `/reference/knowledge/<id>/learn` -- e.g. `wx-reading-metars`, `wx-reading-tafs`, `wx-product-pireps`, `wx-icing-types-and-avoidance`, `airspace-vfr-weather-minimums`. `:::cards` practice directive.
- **Node detail**: `/reference/knowledge/<id>` -- e.g. `wx-reading-metars`, `wx-reading-tafs` (per-product nodes from PR #973), plus the 3 new nodes `wx-outflow-boundary`, `wx-subsidence-inversion`, `wx-mixing-height`.

## flightbag app

- **Reader**: catalog + `/handbook/[slug]/[edition]` + AIM / CFR / ACS / AC readers; section pages `/handbook/phak/[edition]/[chapter]/[section]`.
- Rich reader: highlight / card-draft / inline-composer flows (anonymous smoke only -- authenticated e2e is deferred).
- **Production build boot**: `bunx vite build` in `apps/flightbag` (and `apps/study`) then `bun ./build/index.js` -- the adapter-node prod server boots clean (flightbag HTTP 200, study 303). Before PR #1064 this crashed at boot with `z.coerce.boolean().meta is not a function` (zod 3/4 skew vs better-auth).

## study app -- other surfaces

- **Notes**: `/notes`, `/notes/new`, `/notes/[id]` (per-surface "+ Note" panels on goal / course / knowledge-node).
- **Library**: `/library`, `/library/cert/private|instrument|cfi` -- four spines.
- **Command palette**: Cmd+K from any authenticated page -- knowledge-node / glossary / doc results.
- **Memory / reps**: `/memory`, `/memory/drafts`, `/reps`, `/study/learn`.

## Theme -- deepInk contrast tokens (PR #1067)

- Status pills / banners / toasts / badges on tinted (wash) backgrounds now use `--signal-X-deep-ink` instead of `--signal-X-ink` -- a darker text-on-wash variant. Visible across study status chips and hangar ingest-review badges. The theme contrast-matrix test went 81 passed / 38 skipped -> 119 passed / 0 skipped.

## CLI / tooling

- `bun run test integration [--help|list|--book <name>|--full]` -- flightbag coverage sweep dispatcher. `--help` renders friendly help; `list` prints a per-book tree plan and exits 0; `--book <name>` runs one book (builds flightbag once, caches after); default runs a per-book sample (209 URLs, live progress dashboard). `--full` is the ~3484-URL prod-build sweep. Artefacts under `tests/integration/.out/`.
- `bun run test all` -- unit + e2e + integration in sequence.
- `bun run sources report` (+ `--strict`) -- FAA source-corpus drift report.
- `bun run sources download --corpus=ac` -- fetches the catalogued ACs incl. AC 00-45H.
- `bun run sources discover-errata` -- scans 14 handbooks (0 failures after the URL fixes).
- `bun scripts/db/classify-card-tier.ts` -- interactive card question_tier classification.
- `bun run track generate` -- regenerate SHIPPED.md / BOARD.md.
- `bun run track format` -- idempotent markdown table-alignment + fence/heading rules; `bun run check` runs it scoped to touched files.

## Durable walkthrough docs (authored, in the repo)

These per-feature walkthroughs are the authoritative manual-test sources:

- `docs/work/walkthroughs/20260513-flight/01-cert-dashboard.md` .. `06-command-palette.md`
- `docs/work/walkthroughs/2026-05-13-command-palette.md`
- `docs/work/walkthroughs/2026-05-16-*-walkthrough.md` -- wx-engine, course-tree-arbitrary-depth, card-question-tier, weather-comprehensive (4 scaffolds awaiting the user's manual run)
- `docs/work-packages/faa-documentation-navigation/test-plan.md` -- 13 FDN scenarios

## Per-session walkthrough sources

| Session | Date | Surface |
|----------------------------------------|------------|---------|
| 0160f787                               | 2026-05-15 | knowledge-node `:::cards` directive |
| 20260515-180643-56167                  | 2026-05-15 | platform hygiene + palette (PRs #945-#980) |
| 20260515-180930-60283                  | 2026-05-15 | flight-reading walkthrough set (PR #967) |
| 20260515-181752-71057                  | 2026-05-15 | OOS extraction (no user-facing artifact) |
| 20260515-181801-71712                  | 2026-05-15 | flightbag rich reader + notes primitive |
| 20260515-223922-1639                   | 2026-05-15 | command palette Phase 1 + design |
| 80d9ef12                               | 2026-05-15 | weather-comprehensive course + per-product nodes |
| 9d89e07b                               | 2026-05-15 | vitest test-DB isolation + seed fixes |
| afc4eeb6                               | 2026-05-15 | browser-hydration leak fix (PR #925) |
| ba6a23ad                               | 2026-05-15 | command-palette WP build-out |
| cd16e567-tests-validator               | 2026-05-15 | test-suite + validator + contrast work |
| cd16e567                               | 2026-05-15 | bookkeeping (PR #966 close-out) |
| d83e4218                               | 2026-05-15 | test-runner logging |
| 17883a4e                               | 2026-05-17 | flightbag coverage (PRs #981, #999, #1005) |
| 20260517-145336-25547                  | 2026-05-17 | palette Phase 1 loose-ends (PR #1013) |
| 20260517-155020-81423                  | 2026-05-17 | Navigating FAA Documentation course |
| 20260517-160100-94636                  | 2026-05-17 | wx products reference + source-corpus drift check |
| 20260517-163554-26560                  | 2026-05-17 | WP review + sign-off prep |
| 9b64fd7c                               | 2026-05-17 | unit-test repair (PR #1018) |
| e76c9f78                               | 2026-05-17 | content census + catalog coverage |
| 20260517-212403-79769                  | 2026-05-17 | integration coverage sweep rework dispatcher |
| 20260517-212610-82094                  | 2026-05-17 | e2e + md-format tooling (PRs #1034-#1049) |
| 20260517-215641-9754                   | 2026-05-17 | project-wide 10x review (10 PRs, #1050-#1063) |
| 20260517-222752-41597                  | 2026-05-17 | zod-4 prod-build boot + integration dispatcher |
| 5756488e-807a-478e-91ad-f15964f9d39e   | 2026-05-17 | zod-4 alignment + dispatcher fix + branch triage (PRs #1064/#1065/#1067) |
