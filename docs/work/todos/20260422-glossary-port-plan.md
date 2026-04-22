# Glossary port plan — airboss-firc to airboss

Research date: 2026-04-22.

## TL;DR

airboss-firc already has a fully-built typed aviation glossary: 175 authoritative entries across 9 domains in `libs/constants/src/glossary/`, a validated schema, a GlossaryPage/EntryCard/Term/Filter/Sidebar Svelte component set, a Vite plugin for `[[id]]` wiki-link rewriting, a scanner CLI, and an FAA-Part-1 seed pipeline with ~292 un-triaged draft entries. The airboss side has none of this and currently ships a near-verbatim copy of the firc `VOCABULARY.md` that is still carrier-metaphor-heavy and FIRC-specific, plus a `course/L02-Knowledge/OUR-TERMS.md` that defines tick/intervention/scenario vocabulary inherited from the pre-pivot world. The port is mostly a lift-and-shift of the glossary infra plus a fresh pass at the `VOCABULARY.md` / platform-terminology layer to align with the post-pivot surface-typed architecture, spaced-memory / decision-reps / knowledge-graph vocabulary, and the broader PPL/IR/CPL/CFI scope.

## What exists in airboss-firc

### Canonical data and infra

| Path                                                                      | Scope                                                          | Quality                                                                                           | Relevance to airboss                                                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `airboss-firc/libs/constants/src/glossary/types.ts`                       | Platform infra (typed glossary schema)                         | Authoritative, tight, build-time-validated                                                        | High. Port verbatim. Schema already supports what we need.                                                   |
| `airboss-firc/libs/constants/src/glossary/domains.ts`                     | Domain + group taxonomy (9 domains, per-domain freeform groups) | Authoritative                                                                                     | High. Port verbatim.                                                                                         |
| `airboss-firc/libs/constants/src/glossary/registry.ts`                    | Lookup maps, by-id / by-term / by-domain / tag indices         | Authoritative                                                                                     | High. Port verbatim.                                                                                         |
| `airboss-firc/libs/constants/src/glossary/validation.ts`                  | Build-time validator (unique IDs, ref resolution, brief length) | Authoritative                                                                                     | High. Port verbatim.                                                                                         |
| `airboss-firc/libs/constants/src/glossary/index.ts`                       | Barrel + load-time validate                                    | Authoritative                                                                                     | High. Port verbatim.                                                                                         |
| `airboss-firc/libs/constants/src/glossary/entries/*.ts` (9 files, 175 entries total) | Aviation domain content                                | Authoritative. Hand-written, AIM/PHAK/CFR sourced, `source` field on each                          | High for aviation glossary. Port verbatim. Counts: aircraft 52, navigation 28, operations 27, atc 17, weather 14, training 13, regulations 12, safety 8, organizations 4. |
| `airboss-firc/libs/ui/src/components/glossary/GlossaryPage.svelte` (10 KB)  | Glossary index page                                            | Looks complete; authored with Svelte 5 runes                                                      | High. Port verbatim for the help/glossary UI.                                                                |
| `airboss-firc/libs/ui/src/components/glossary/GlossarySidebar.svelte` (9.9 KB) | Domain/group nav sidebar                                       | Looks complete                                                                                    | High. Port verbatim.                                                                                         |
| `airboss-firc/libs/ui/src/components/glossary/GlossaryEntryCard.svelte` (10 KB) | Per-entry card with expand, related links                      | Looks complete                                                                                    | High. Port verbatim.                                                                                         |
| `airboss-firc/libs/ui/src/components/glossary/GlossaryFilter.svelte` (4.9 KB) | Domain/tag/search filter                                       | Looks complete                                                                                    | High. Port verbatim.                                                                                         |
| `airboss-firc/libs/ui/src/components/glossary/GlossaryTerm.svelte` (2.0 KB) | Inline term tooltip component                                  | Looks complete                                                                                    | High. Port verbatim.                                                                                         |
| `airboss-firc/libs/ui/src/components/glossary/GlossaryText.svelte` (1.3 KB) | Body-text wrapper that auto-renders `[[id]]`                   | Looks complete                                                                                    | High. Port verbatim.                                                                                         |
| `airboss-firc/libs/ui/src/glossary/vite-plugin.ts`                         | Build-time `[[id]]` wiki-link processor                        | Looks complete                                                                                    | Medium-high. Worth porting; the airboss knowledge-graph phases already author prose that will want the same treatment. |
| `airboss-firc/scripts/glossary-scan.ts`                                    | CLI that flags bare acronyms in content files                  | Looks complete                                                                                    | Medium. Port after seed.                                                                                     |
| `airboss-firc/scripts/faa-ingest/commands/glossary.ts`                     | Extracts 14 CFR Part 1 abbreviations + definitions into JSON    | Looks complete                                                                                    | Medium. Keep-optional; use the JSON artifacts rather than re-running.                                        |
| `airboss-firc/scripts/faa-ingest/commands/seed-glossary.ts`                | Builds `draft-abbreviations.ts` / `draft-definitions.ts` skeleton TS from the JSON | Looks complete                                                       | Medium. Useful once for the backlog; keep as a dev dependency.                                               |
| `airboss-firc/scripts/faa-ingest/commands/pcg.ts`                          | Parses the AIM/ATC Pilot-Controller Glossary PDF into JSON     | Partial (extracted output is noisy; see quality note below)                                       | Low-medium. The parser needs work; don't port without a cleanup pass.                                        |
| `airboss-firc/data/faa/glossary/part1-abbreviations.json` (119 entries)   | 14 CFR §1.2 abbreviations, clean pairs                         | Authoritative raw source                                                                          | High as source data. 100 are genuinely new (19 overlap with the hand-written entries).                       |
| `airboss-firc/data/faa/glossary/part1-definitions.json` (192 entries)     | 14 CFR §1.1 definitions, full-text                             | Authoritative raw source                                                                          | High as source data.                                                                                         |
| `airboss-firc/data/faa/glossary/seed/draft-abbreviations.ts` (1309 lines) | Un-triaged TS entries from Part 1 (auto domain-guess)          | Draft; needs brief/detail/domain review                                                           | Medium. Useful as authoring scaffolding; do not copy into `entries/` as-is.                                  |
| `airboss-firc/data/faa/glossary/seed/draft-definitions.ts` (2505 lines)   | Un-triaged TS entries from Part 1 definitions                  | Draft                                                                                             | Medium. Same treatment.                                                                                      |
| `airboss-firc/data/faa/glossary/seed/review-manifest.md`                   | Tracks what's been reviewed                                    | Stale (mostly un-checked)                                                                         | Low. Rebuild fresh if we keep going down this path.                                                          |
| `airboss-firc/data/faa/pcg/pcg-terms.json` (238 entries, 204 KB)          | Pilot-Controller Glossary raw extract                          | Stale / low. Parser concatenated adjacent terms and polluted definitions (see `ABBREVIATED IFR FLIGHT PLANS`). | Low. Do not import as-is. The PCG PDF is the source of truth; re-ingest with a better parser if needed.      |

### Docs that define platform and course vocabulary

| Path                                                                      | Scope                                                          | Quality                                                                        | Relevance to airboss                                                                                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `airboss-firc/docs/platform/VOCABULARY.md`                                | FIRC-Boss platform + carrier-metaphor terminology bank         | Authoritative for firc; heavy carrier metaphor (LSO, Greenie Board, Trap, Bolter, Cat shot, NATOPS, Vulture's Row) | Low-medium. Airboss has a verbatim copy already (see below). Carrier metaphor is FIRC-identity; airboss pivoted away. Rewrite, don't port. |
| `airboss-firc/docs/.archive/work/research/APP_NAMING.md`                   | Origin research for hangar/sim/ops/runway + carrier terminology bank | Authoritative archive                                                    | Reference only. The vocabulary airboss kept (hangar/sim/ops/runway) came from here; cite as provenance.      |
| `airboss-firc/course/L02-Knowledge/OUR-TERMS.md`                           | Course-authoring language (Scenario, Tick, Intervention, Debrief, Module, Competency, Student model, etc.) with FAA-equivalent column | Authoritative for firc course work | Medium. Airboss has a verbatim copy; much of it survives the pivot (Scenario, Module, Competency, Knowledge check), some won't (Call the Ball, Case I/II/III, immersion tick). Reconcile. |
| `airboss-firc/docs/work/features/glossary/spec.md`                         | The glossary feature spec we're porting                        | Authoritative, recent                                                          | High. Read as the design source of truth for the infra port.                                                 |
| `airboss-firc/docs/work/features/glossary/tasks.md`                        | Task breakdown for the original build                          | Complete (the feature shipped)                                                 | Medium. Good template for the airboss port's task list; don't re-duplicate every step.                       |
| `airboss-firc/docs/work/features/glossary/design.md`                       | UI design for glossary page + tooltip                          | Authoritative                                                                  | Medium. Useful for the help-page skin.                                                                       |
| `airboss-firc/docs/work/features/glossary/test-plan.md`                    | Manual test plan                                               | Authoritative                                                                  | Medium. Reuse.                                                                                               |
| `airboss-firc/docs/work/reviews/2026-04-02-glossary-*.md` (9 files)        | 10-lens review of the built glossary                           | Authoritative feedback on the original build                                   | Low. Historical. Keep findable but don't port; the code already reflects the fixes.                          |
| `airboss-firc/docs/work/plans/2026-04-02-glossary-review-fixes.md`         | Post-review fix plan                                           | Historical                                                                     | Low.                                                                                                         |
| `airboss-firc/docs/work/plans/2026-04-03-glossary-seed-review.md`          | Plan for reviewing the ~292 draft entries                      | Partial (work was paused)                                                      | Medium. Useful blueprint if we decide to continue the FAA-source backfill.                                   |
| `airboss-firc/course/L02-Knowledge/A.*/` (13 core-topic directories)       | FIRC-specific research prose with heavy acronym use            | Varies                                                                         | Reference only. Individual research docs are candidate mining targets for terms we missed, but these are FIRC-scope. |

## What exists in airboss today

| Path                                                                      | What it is                                                               | How this work should treat it                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `airboss/docs/platform/VOCABULARY.md`                                     | Verbatim pre-pivot copy of firc's VOCABULARY.md (118 lines)               | Rewrite. Keep only the post-pivot-valid parts (hangar/sim/ops/runway future app names, Module, Competency, Release, Evidence packet). Drop carrier-metaphor feature names (Trap, Bolter, Greenie Board, Cat shot, NATOPS, LSO) unless we explicitly decide to keep them for the future FIRC surface. |
| `airboss/course/L02-Knowledge/OUR-TERMS.md`                               | Verbatim pre-pivot copy                                                  | Rewrite. Retain Scenario / Tick / Intervention / Debrief / Micro lesson / Knowledge check / Module / Student model / Competency / Core topic. Drop Call the Ball, Case I/II/III, immersion tick unless they come back with the scenario engine port. |
| `airboss/libs/constants/src/study.ts`                                     | 767-line platform-vocabulary-in-code. Domains, phases-of-flight, card states, FSRS ratings, knowledge phases, certs, Bloom levels, session modes/slices/skips, mastery thresholds. Extensively commented. | Read as a source. The JSDoc comments here are the authoritative current definitions for most platform terms. Much of the glossary will be seeded from these comments. |
| `airboss/docs/decisions/011-knowledge-graph-learning-system/decision.md`  | ADR for the knowledge graph                                              | Read as the source for KG / phase / edge-type / relevance / depth vocabulary. |
| `airboss/docs/work-packages/{spaced-memory-items,decision-reps,calibration-tracker,knowledge-graph,learning-dashboard,study-plan-and-session-engine}/PRD.md` | Per-feature PRDs that define their own jargon (SMI, rep, calibration, mastery ratio, dual gate, session mode, etc.) | Read as term sources. These define the product-side acronyms users see in the UI. |
| `airboss/docs/platform/INFORMATION_ARCHITECTURE.md`                       | L01-L05 framing; defines what those L-layers mean                        | Reference. The L01-L05 naming is airboss-specific and belongs in the platform glossary. |
| `airboss/apps/study/src/routes/(app)/dashboard/_panels/CtaPanel.svelte`   | Uses `Cta` in the component name; no definition anywhere user-reachable  | Source for the UI-term gap list below.                                       |
| `airboss/apps/study/src/routes/(app)/calibration/`                        | Calibration page exists                                                   | In-app surface where the help link will need to resolve.                     |
| No existing `GLOSSARY.md`, `/glossary` route, help page, or FAQ           | (Gap)                                                                    | This is what we're building.                                                 |

## Gaps (terms used in airboss with no definition accessible)

### Aviation

These are standard aviation acronyms the user will see in domain tags, card prompts, knowledge nodes, and UI copy. airboss-firc's `entries/` files already define most of these; the port brings them in.

- **Certificates / ratings:** PPL, IR (instrument rating), CPL, CFI, CFII, MEI, ATP, PIC, SIC, FIRC (in firc entries; retain)
- **Operations:** VFR, IFR, SVFR, MVFR, IMC, VMC, AGL, MSL, MDA, DA, DH, IAP, NOTAM
- **Navigation:** LOC, GS, ILS, VOR, NDB, DME, GPS, WAAS, RAIM, RNAV, RNP, LPV, CDI, OBS, HSI
- **Weather:** METAR, TAF, PIREP, SIGMET, AIRMET, ATIS
- **ATC / airspace:** TRACON, ARTCC, FSS, CTAF, UNICOM, TFR, Class A/B/C/D/E/G
- **Aircraft systems / speeds:** PFD, MFD, AHRS, ADI, Vx, Vy, Va, Vne, Vso, Vs1 (plus TAA — Technically Advanced Aircraft — used in the knowledge graph)
- **Safety / frameworks (also CFI pedagogy):** CFIT, LOC-I
- **Regulations / documents:** CFR, AC, ACS, PTS (historical, replaced by ACS), AIM, PHAK, FAR, POH, AFM, MEL
- **Organizations:** FAA, NTSB, TSA, ICAO, FAASTeam

### CFI pedagogy

These are instructor-specific frameworks. Mostly present in firc's `safety.ts` entries; needs verification.

- ADM (Aeronautical Decision Making)
- SRM (Single-Pilot Resource Management)
- CRM (Crew Resource Management)
- PAVE (Pilot / Aircraft / enVironment / External pressures)
- IMSAFE (Illness / Medication / Stress / Alcohol / Fatigue / Emotion-or-Eating)
- 3P / 5P (Perceive-Process-Perform; or five-P: Plan / Plane / Pilot / Passengers / Programming)
- DECIDE model
- Risk management matrices (likelihood × severity)
- Bloom's taxonomy levels (Remember / Understand / Apply / Analyze / Evaluate / Create) — airboss uses these per-relevance-entry in `study.ts`

### Platform / architecture

Airboss-native. None of these are in the firc glossary entries (they were platform-internal over there too); must be authored fresh.

- BC (bounded context) — used in CLAUDE.md, lib names (`libs/bc/study`), PRDs
- FSRS (Free Spaced Repetition Scheduler; the ts-fsrs engine in use) — used throughout `libs/bc/study/src/srs.ts` and `study.ts`
- SMI (spaced memory items) — name of a whole bounded-context feature, but never expanded user-facing
- KG (knowledge graph) — ADR 011 vocabulary
- DAG (directed acyclic graph) — used for the `requires` edge constraint
- ADR (architecture decision record) — used as a directory name under `docs/decisions/`
- ULID / `prefix_ULID` — ID format in `@ab/utils`
- L01 / L02 / L03 / L04 / L05 — information-architecture layers per `INFORMATION_ARCHITECTURE.md`
- Domain (in the study / KG sense, not the glossary's `GlossaryDomain`) — disambiguation needed; both exist
- Mastery, dual-gate, stability, difficulty (in FSRS sense), relearning, learning (card states)
- Slice / mode / reason code (session engine vocabulary from `study.ts`)
- Phase (knowledge-graph phase: Context / Problem / Discover / Reveal / Practice / Connect / Verify) — different from phase-of-flight
- Node / edge / relevance / node lifecycle (skeleton / started / complete) — KG model
- Discovery-first pedagogy — design principle
- Surface / surface-typed — platform architecture term (Option 7)
- `@ab/*` path aliases — monorepo convention

### UI / product

Airboss-specific UI shorthand that appears in filenames, prop names, and user-facing copy. Define in one place.

- CTA / CtaPanel (call to action)
- Reps (decision reps) — not aviation reps; a product noun
- Cards (spaced-memory items in the UI; same underlying entity, user-facing name)
- Reveal (post-confidence answer display)
- Phase (knowledge-graph phase; collides with phase-of-flight — disambiguate in glossary)
- Skeleton (node lifecycle state, also a UI loading pattern — disambiguate)
- Session mode labels: Continue / Strengthen / Mixed / Expand
- Session slice labels: Continue / Strengthen / Expand / Diversify
- Skip kinds: Today / Topic / Permanent
- Depth preferences: Surface / Working / Deep
- Confidence levels: Wild guess / Uncertain / Maybe / Probably / Certain
- Dashboard panels (weak areas, activity, backlog, calibration)
- Knowledge node lifecycle badges (skeleton / started / complete)

## Proposed structure for airboss

One typed data source, one in-app route, one human-readable companion doc. Keep the firc shape; evolve the content.

### Data: typed constants, unchanged from firc

- `libs/constants/src/glossary/types.ts` — `GlossaryDomain`, `GlossaryEntry`, `GLOSSARY_DOMAIN_*`
- `libs/constants/src/glossary/domains.ts` — per-domain group constants
- `libs/constants/src/glossary/registry.ts` — lookup maps
- `libs/constants/src/glossary/validation.ts` — build-time checks
- `libs/constants/src/glossary/entries/{aviation,cfi,platform,ui}.ts` — **new split** (see porting plan step 3)
- `libs/constants/src/glossary/index.ts` — barrel + load-time validate

Add a tenth domain to the existing 9 for airboss-specific content: `platform` (covers BC / FSRS / KG / session-engine terminology). Possibly an eleventh: `ui-product`. Decide before Step 3.

### UI: shared components

- `libs/ui/src/components/glossary/GlossaryPage.svelte`
- `libs/ui/src/components/glossary/GlossarySidebar.svelte`
- `libs/ui/src/components/glossary/GlossaryEntryCard.svelte`
- `libs/ui/src/components/glossary/GlossaryFilter.svelte`
- `libs/ui/src/components/glossary/GlossaryTerm.svelte`
- `libs/ui/src/components/glossary/GlossaryText.svelte`
- `libs/ui/src/glossary/vite-plugin.ts` (only if we commit to `[[id]]` authoring)

### App surface

- `apps/study/src/routes/(app)/glossary/+page.ts` + `+page.svelte` — renders `<GlossaryPage>` from the data
- `libs/constants/src/routes.ts` — add `GLOSSARY: '/glossary'` and `GLOSSARY_ANCHOR: (id: string) => ...`
- Navigation: add a "Glossary" link to the `(app)/+layout.svelte` header/sidebar
- The glossary page is also the user-facing **help page** (per the task brief). Title it "Glossary & help" or similar; one URL, one screen. If we want onboarding/tour/FAQ content later, add it as sections on the same page or a sibling route.

### Human-readable companion docs

- `docs/platform/VOCABULARY.md` — **rewrite** as a slim index of platform + product terms for developers. Cross-links to the in-app glossary for user-facing definitions. Drops carrier-metaphor features that aren't on the roadmap.
- `docs/platform/GLOSSARY.md` — **new**, but minimal: explains the glossary data shape, the `[[id]]` authoring convention, the domain/group taxonomy, and how to add an entry. The data is the source of truth; the MD is the guide to the data.
- `course/L02-Knowledge/OUR-TERMS.md` — **rewrite** to reflect post-pivot language (study / memory / reps / session / knowledge-node). Keep only the terms we still use.

## Porting plan (ordered steps)

Go one step at a time. Each is a discrete PR-sized chunk.

1. **Rewrite the two stale copy-paste docs.** `docs/platform/VOCABULARY.md` and `course/L02-Knowledge/OUR-TERMS.md` are currently verbatim copies of firc files whose content is partly post-pivot-invalid. Rewrite both to match current airboss reality. No content is copied wholesale; some is discarded (carrier-metaphor feature names that aren't on the roadmap), some is preserved (hangar/sim/ops/runway futures per `MULTI_PRODUCT_ARCHITECTURE.md`), some is added (surface-typed app taxonomy, study/memory/reps/session/KG vocabulary). This unblocks everything downstream because the rest of the work refers to these docs.

2. **Port the glossary infra verbatim.** Copy `libs/constants/src/glossary/{types.ts,domains.ts,registry.ts,validation.ts,index.ts}` from airboss-firc to airboss. Wire into `libs/constants/src/index.ts`. Add `ROUTES.GLOSSARY` and `ROUTES.GLOSSARY_ANCHOR` to `libs/constants/src/routes.ts`. `bun run check` must pass. No content changes; this is pure plumbing.

3. **Port and split the entries.** Copy the 9 `entries/*.ts` files (175 entries) from airboss-firc as-is — they're authoritative aviation content, most of which applies to all of PPL/IR/CPL/CFI, not just FIRC. Add two new entry files: `entries/platform.ts` and `entries/ui-product.ts` authored from scratch (pulling definitions from `study.ts` JSDoc, ADR 011, and the work-package PRDs). Decide on the new `GlossaryDomain` value(s) before coding — `platform` and `ui-product` are the proposed names. Verify no entries in the ported files are actually FIRC-only; prune anything that clearly won't survive the pivot (spot-check: `firc-reg`, `wings-reg`, `reed-reg` if present — all belong to the regulations file and are still valid at the FIRC surface, so retain but flag).

4. **Port the UI components verbatim.** Copy the 6 Svelte files under `libs/ui/src/components/glossary/` plus `libs/ui/src/glossary/{index.ts,vite-plugin.ts}`. These are Svelte 5 runes already. Wire exports into `libs/ui/src/index.ts`.

5. **Wire the study app route.** Create `apps/study/src/routes/(app)/glossary/+page.ts` + `+page.svelte`. Render `<GlossaryPage>` from ported data. Add the nav link in `(app)/+layout.svelte`.

6. **Author the new platform + ui-product entries.** This is the fresh-writing step. Mine `libs/constants/src/study.ts` JSDoc, ADR 011, and each work-package PRD. Target ~30-50 entries covering the platform/architecture and UI/product gap lists above. Each entry gets a `source` field pointing to the canonical airboss doc (PRD path, ADR path, or `study.ts` constant name).

7. **Rewrite VOCABULARY.md (developer-facing index) + author GLOSSARY.md (authoring guide).** Both short. GLOSSARY.md replaces the firc feature spec as the author's reference; VOCABULARY.md becomes the name-things-first bank for new features, cross-linked to the in-app glossary.

8. **(Optional) Port the Vite plugin and commit to `[[id]]` authoring.** Only worth doing if we intend to use wiki-links in knowledge-graph phase prose. If the authoring workflow stays plain markdown, skip the plugin entirely — the `<GlossaryTerm>` component on its own is enough for hand-placed UI usage.

9. **(Optional) Port the scanner CLI.** Only after seeding is settled. `scripts/glossary-scan.ts`. Useful for catching bare acronyms in knowledge-graph phase content.

10. **(Deferred) Back-fill from the CFR Part 1 draft pool.** airboss-firc has 292 auto-generated draft entries that need brief/detail authorship before they can ship. Don't port these now. If/when we want expanded coverage (esp. of obscure Part 1 defined terms), fork the seed-glossary script and run it here. Keep the raw JSON (`part1-definitions.json`, `part1-abbreviations.json`) as a data input; skip the PCG JSON until the parser is fixed.

**What doesn't port, and why:**

- The carrier-metaphor feature names (Trap, Bolter, Greenie Board, Cat shot, Tape, NATOPS, LSO-as-scoring, Case I/II/III, Air Plan). These are FIRC-Boss brand identity, not aviation knowledge. They may return when `apps/firc/` is migrated in, but they belong to that app's local vocabulary, not the platform glossary.
- The PCG extract (`pcg-terms.json`). The parser concatenated adjacent glossary entries and broke term boundaries. Unusable without a re-parse.
- The 10 glossary review docs from 2026-04-02. Historical; the code reflects the outcomes.

## Open questions for user

1. **Do we split the `GlossaryDomain` enum?** Firc's 9 domains are all aviation. Airboss needs `platform` and `ui-product` alongside. Are you OK with the glossary being a mixed aviation-plus-platform reference on one page, or should platform/UI definitions live in a separate developer-facing doc and not appear in the in-app glossary at all? Recommendation: one mixed glossary, because the user will see BC / SMI / reveal in the UI and needs the same affordance to look them up as for METAR.

2. **How literal should FAA regulatory definitions be?** The existing firc entries paraphrase CFR definitions in their `detail` field rather than quoting verbatim. Paraphrase stays readable and avoids CFR formatting cruft; verbatim is defensible and traceable. Recommendation: paraphrase with the `source` field pointing to the CFR section so the user can read the exact text if they want.

3. **Commit to `[[id]]` wiki-links in knowledge-graph phase content, or not?** If yes, we port the Vite plugin and adopt a convention across all phase-written prose (ADR 011). If no, we only use `<GlossaryTerm term="LOC">` inline in Svelte and the plain markdown stays plain. The wiki-link convention is powerful but imposes a build-time gate on all content. Recommendation: defer. Ship the glossary first; add wiki-links later if phase content actually wants them.

4. **One URL for glossary and help, or two?** The task brief says "user-facing help page." If help means "tour / FAQ / getting started," that's different content and deserves its own route. If help means "what does this acronym mean," the glossary is the help. Recommendation: one route (`/glossary`), one title ("Glossary & help"), with a header nav link. Add a `/welcome` or `/about` route later if the onboarding tour work surfaces.

## Estimated scope

| Bucket                                              | Count                                  | Effort                                                                   |
| --------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| Port wholesale (infra + content)                    | 5 constants files, 6 Svelte components, 175 entries | Mechanical. Single PR per file family. One-shot-able in a few sessions. |
| Rewrite (VOCABULARY.md, OUR-TERMS.md, authoring guide) | 3 markdown files                     | Small. One careful session per file; need user review on which carrier-metaphor terms to keep or drop. |
| Author fresh (platform + ui-product entries)        | 30-50 entries                          | Medium. Most definitions can be lifted from `study.ts` JSDoc and work-package PRDs. One session. |
| Deduplicate (`OUR-TERMS.md` vs glossary entries)    | ~10 overlapping terms (Scenario, Module, Competency, Tick, Debrief, etc.) | Small. Decide: author-facing language stays in OUR-TERMS.md, user-facing definition moves to the glossary data, cross-link. |
| Defer                                               | CFR Part 1 draft pool (292 entries), PCG extract (238, broken), scanner CLI, Vite plugin | Hours-to-days each when picked up; none are blockers.                    |
| First-order total                                   | Plumbing + 225-ish entries in the glossary + 3 rewritten docs + wired help page | Ship in 3-5 focused sessions if no surprises.                            |
