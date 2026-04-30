# Now

Single entry point for "what should I work on?" in airboss. Refresh date: 2026-04-30 (FAR navigation course content-complete).

## Just shipped (2026-04-30 -- FAR navigation course Weeks 3-10 + 2 sibling capstones)

- **FAR navigation course is content-complete.** All 10 weeks authored. All 4 sibling capstone orals authored. Authored across one work package PR (#349, merged) and one content PR (#350, the omnibus). Authoring approach: parallel sub-agents per week, exclusive directory ownership, phased dispatch.
  - Week 3 -- Part 61 CFI (subpart H, endorsements, FOI): 5 lessons + drills + oral (~1,931 lines)
  - Week 4 -- Part 91 general + flight rules: 6 lessons + drills + oral (Week 4 lessons 03-06 + drills + oral authored inline by the dispatcher after content-filter blocks on the sub-agent return path)
  - Week 5 -- Part 91 equipment + maintenance: 5 lessons + drills + oral (~2,863 lines, "very deep" treatment)
  - Week 6 -- Part 91 special ops + integration: 5 lessons + drills + oral (~1,911 lines)
  - Week 7 -- Parts 141/135: 4 lessons + drills + oral (~1,244 lines, "cursory" literacy treatment)
  - Week 8 -- Companion documents (AIM, AC, Chief Counsel, 49 CFR): 5 lessons + drills + oral (~1,839 lines)
  - Week 9 -- Enforcement + NTSB Part 830: 6 lessons + drills + oral (~2,738 lines)
  - Week 10 -- Capstone + 2 new sibling capstone orals (`friend-flight-review.md`, `ppl-applies-for-ir.md`): 3 lessons + drills + oral + 2 capstones (~691 lines + 59KB capstones)
  - All citations use `airboss-ref:` URI syntax per ADR 019. Validator (`bun scripts/references.ts validate`) clean, 0 errors.
  - CHANGELOG status table flipped to "Authored" for all 10 weeks; capstones flipped to 4/4.

## Just shipped (2026-04-29 -- chapter-source-ingestion WP closed, ADR 022)

- **[chapter-source-ingestion](../work-packages/chapter-source-ingestion/spec.md) shipped.** YAML-driven source config, chapter-PDF download path, AIM HTML extraction, and `bun run sources verify-urls` / `inventory` commands. PHAK regenerated under chapter-PDF mode (~559 LLM section-extraction prompt entries across 17 chapters). PRs #337 (main feature), #338 (cleanup), #339 (HTML idempotency), #340 (handbooks-extras URL audit), #341 (chapter-filter fix), #342 (contract v2 + truncation fix), #343 (PHAK regen). [ADR 022](../decisions/022-chapter-source-ingestion/decision.md) records the design.
- **Source cache flat naming** ([ADR 021](../decisions/021-source-cache-flat-naming/decision.md)) shipped via PR #327. Cache layout standardized to `~/Documents/airboss-handbook-cache/handbooks/<slug>/<edition>/...` per ADR 018's storage policy.

## Just shipped (2026-04-29 -- PFD promoted to libs/activities, sim is second consumer)

- **[extract-sim-instruments](../work-packages/extract-sim-instruments/spec.md) closed.** PFD component set (`AttitudeIndicator`, `AirspeedTape`, `AltitudeTape`, `HeadingIndicator`, `VsiIndicator`, `Pfd`, `PfdInputs`, `PfdKeyboardLegend`, `pfd-tick.svelte.ts`, `airspeed-arcs.ts`, `pfd-types.ts`) `git mv`'d from `apps/avionics/src/lib/pfd/` to `libs/activities/src/pfd/`. Avionics rewired to import from `@ab/activities/pfd/Pfd.svelte`; sim mounted the Glass PFD demo at `/glass-pfd` (`ROUTES.SIM_GLASS_PFD`) as the second consumer that triggered the move. No barrel; subpath imports follow the existing `crosswind-component/` convention. PR #328.
- **FAR navigation course Week 2 (Part 61 deep) authored.** Three new lessons (~1,065 lines added): §61.56 flight-review deep-dive + four equivalents, §61.57(c-e) IFR currency state machine + safety-pilot rules, §61.23 + Part 67 + BasicMed two-cycle structure. CHANGELOG and NOW.md drift fixed. PR #329.
- **`PageHeader` / `EmptyState` / `ScoreCard` adopted across 27 routes.** Mechanical adoption pass on top of the primitives PR #315 shipped. Net -507 lines (785 deletions of duplicated header/empty/stat blocks, 278 insertions of primitive imports + snippet wiring). Inventory at `docs/work-packages/route-style-extraction/INVENTORY.md` documents every mechanical migration and ~30 documented Skip residuals (each with a structural reason -- structured badges below title, tab-strips inside header, runner-chrome distinct from PageHeader). [route-style-extraction](../work-packages/route-style-extraction/spec.md) WP trigger sharpened to name the residual classes; stays deferred for the dashboard refresh.

## Just shipped (2026-04-28 -- ADR 016 phases 7-9: cert-syllabus surface complete)

- **Cert dashboard (phase 7).** New `/credentials` index, `/credentials/[slug]` detail with mastery rollup + prereq snippet + supplemental syllabi, and `/credentials/[slug]/areas/[areaCode]` drill with K/R/S element badges, citations, and linked knowledge nodes. Edition pinning honoured via `?edition=`. Pure read-only consumer of `@ab/bc-study`. PR #321.
- **Lens UI (phase 8).** New `/lens/handbook` (index + doc view + chapter view with citing knowledge nodes from `getNodesCitingSection`) and `/lens/weakness` (severity buckets via `getWeakAreas`, normalised score / 3, thresholds severe 0.70 / moderate 0.40 / mild 0.15). Domain-level v1; node-level ranking with miscalibration / overdue / low_accuracy / never_attempted reasons documented as a follow-on if the domain rollup is insufficient in real use. PR #323.
- **Goal composer (phase 9).** New `/goals` index, `/goals/new` create, and `/goals/[id]` detail with `?edit=1` toggle. Ten form actions (update / setStatus / makePrimary / archive / addSyllabus / removeSyllabus / setSyllabusWeight / addNode / removeNode / setNodeWeight). Inline syllabus + node pickers (from `listNodesWithFacets`); modal-with-filter-chips picker captured as a follow-on if the inline scales poorly. PR #324.
- **Magic-strings sweep PR shipped earlier in the same session.** Help routes + 17 domainLabel sites + 5 MS_PER_DAY stragglers. PR #312.

## Just shipped (2026-04-28 -- avionics surface)

- **Avionics surface born end-to-end -- 9 PRs in one session.** New `apps/avionics/` SvelteKit app on port 9630 (`avionics.airboss.test`), `libs/bc/avionics/` BC, full route set (`/`, `/pfd`, `/mfd`, `/scan`, `/aircraft`), five SVG PFD instruments (Attitude, Airspeed tape, Altitude tape, Heading, VSI) driven by sliders + keyboard with rAF-eased rendering, V-speeds sourced from the selected aircraft's FDM (C172 today, PA28 plumbed via the aircraft selector), avionics theme tokens for both light and dark, polished MFD/Scan placeholders. PRs #288 (WP docs), #291 (Wave 1 contract), #292 (extract-sim-instruments rewrite), #293 (theme tokens), #294 (app shell), #295 (themes pre-hydration fix surfaced mid-build), #297 (Wave 3 surface), #301 (Wave 4 instruments), #303 (Wave 5 polish + review_status flip). Also wired into `bun run dev` (no-arg parallel mode + single-app), `bun run check`, `bun run setup` /etc/hosts probe, and the shared theme-picker server.
- **Avionics WP closed.** All five docs at `docs/products/avionics/work-packages/avionics-app-scaffold/` flipped `status: done` after manual smoke (PFD verified visually).

## Just shipped (2026-04-28 sweep)

- **Five Wave-1 work packages from the 2026-04-27 12-axis review now closed.** Consolidated and shipped:
  - [extract-hangar-bc](../work-packages/extract-hangar-bc/spec.md) -- shipped via PR #284. ~2,400 lines moved into `libs/bc/hangar/`; routes are now thin shells; `@ab/db` is infra-only.
  - [bc-citations-coupling](../work-packages/bc-citations-coupling/spec.md) -- shipped via PR #278 (option 2: folded into `bc-study`). Speculative-extracted citations BC retired; functions now under `libs/bc/study/src/citations/`.
  - [card-state-fk-tightening](../work-packages/card-state-fk-tightening/spec.md) -- shipped via PR #284. Composite ownership FKs on `card_state` and `session_item_result`.
  - [scenario-options-relational](../work-packages/scenario-options-relational/spec.md) -- shipped via PR #284. `scenario.options` JSONB promoted to `study.scenario_option` table; `chosen_option` re-keyed to FK.
  - [auth-rate-limit](../work-packages/auth-rate-limit/spec.md) -- shipped via PR #284. `createAuth` now configures DB-backed rate limit; login passes real client headers; account lockout policy in place.
- **Sim scenario routes unblocked (cockpit / horizon / dual / window).** PR #295 (themes pre-hydration `.js` shadowed the `.ts` module on bare imports) and PR #298 (postgres driver no longer leaking into client bundles) together fixed the 500/blank renders on the four sim scenario pages.

## Just shipped (2026-04-25 -> 2026-04-27 sweep)

The week was dominated by the reference identifier system (ADR 019, **phases 1-9 all on main**), the cert-syllabus data layer (ADR 016, **all 24 WP phases shipped across PRs #248, #254, #264, #270, #274**), and the post-pivot documentation reset.

- **ADR 019 phases 1-9 fully shipped.** `@ab/sources` lib + validator (#241), registry + `--fix` (#246), CFR ingestion (#247, #260), renderer runtime (#249), versioning + diff job (#250), handbook corpus (#251), AIM corpus + live PDF pipeline (#252, #268), AC corpus (#261), ACS PPL-ASEL slice (#266), lesson migration (#276). Phase 10 (irregular corpora) is demand-driven; per-corpus triggers documented in [adr-019-rollout.md](plans/adr-019-rollout.md#phase-10----reference-irregular-corpora-).
- **Cert-syllabus + goal composer WP done end-to-end.** PRs #248 (contract + schema, phases 0-7), #254 (BC + ACS resolver, phases 8-13), #264 (seed + transcription + WP P17 reference migration, phases 14-21), #270 (Gate A relevance live + Gate B YAML strip + study_plan -> goal migration, phase 22), #274 (final review pass via /ball-review-full + fixer, phases 23-24). ADR 016 phase table refreshed. Surface work (cert dashboard, lens UI, goal composer pages) is the remaining post-data-layer build.

- **ADR 019 reference-identifier system, phases 1-7 + Lane A (CFR structural index) on main.** New `@ab/sources` lib at `libs/sources/`. Validator, registry core + `--fix` mode, CFR bulk ingestion, renderer runtime, versioning + diff job, handbook corpus, AIM corpus. Lane A landed the CFR Title 14 (226 parts / 6,328 sections) + Title 49 aviation slice (parts 1552 + 830, 22 sections) structural index, plus the ADR 018 amendment formalizing the scale-tier exception (>1k derivatives -> commit `manifest.json` + `sections.json` only; bodies regenerate from cached XML). PRs #241, #246, #247, #249, #250, #251, #252, #260.
- **Shared PDF extractor + AC date-detection POC + unified ingest dispatcher.** `libs/sources/src/pdf/`, AC corpus date logic, single `bun run ingest <corpus>` entry point. PRs #257, #258, #259.
- **One-shot source-corpus downloader.** `bun run db sources:download` pulls every needed source PDF/XML into the ADR 018 cache with correct UA + auto-date + named files + HEAD-cache. PRs #253, #255.
- **ADR 016 phase 0 -- handbook ingestion + reader.** PHAK + AFH + AvWX ingested at section granularity (1,861 `handbook_section` rows). Reader UI under `/handbooks/...` with chapter/section views, read-state, heartbeat, suggestion banner. Bidirectional citation surface on knowledge node detail. ADR 020 (edition + amendment policy) shipped alongside. Figure dedup + Playwright e2e + Phase 16 docs as a same-day follow-up. PRs #242, #243.
- **ADR 016 phases 1-13 of the cert-syllabus + goal composer WP.** PR 1 of N shipped the contract + schema (phases 0-7 of the WP -- credential DAG, syllabus tables, syllabus_node_link, ACS triad scaffolding). PR 2 of N shipped the BC + ACS resolver (phases 8-13 -- relevance cache rebuild, goal table, GoalSyllabus + GoalNode rows). PRs #248, #254. Note: ADR 016's own phase table still needs refresh (see "Pending infra cleanup" below).
- **Knowledge graph refactor.** `relevance` array on every node retired in favour of `minimum_cert` + `study_priority`. PR #217. 16 new knowledge nodes authored to back the sim-card mapping, sim weakness wired into the spaced-rep scheduler. PRs #232, #233.
- **Sim push.** Four new VFR scenarios (ground reference, short-field, slow flight, crosswind), history dashboard, unauthenticated sign-in banner, `ControlInput.svelte` extracted for cross-surface reuse. PRs #212, #214, #215, #216.
- **Hangar surface bootstrapped.** Scaffold (#173), brand link + dashboard home (#225), read-only `/users` directory + per-user detail (#226). Hangar vision/PRD rewritten post-pivot, ADR 017 marks compliance surface dormant. PR #231.
- **Post-pivot doc sweep.** Archived FIRC-era platform/app docs under `.archive/`, rewrote live docs, marked superseded ADRs. PR #234. FIRC-era content restructured under `course/firc/`, FAR navigation course bootstrapped at `course/regulations/`. PR #235.
- **FAR navigation course Week 1 (architecture).** 4 lessons + 30 drills + Week 1 oral + gear-up-night-IFR capstone. PR #237. Weeks 2-10 outlined in `course/regulations/SYLLABUS.md`; per-week authoring is the slow burn.
- **Handbook ingestion strategies + community Q&A vision + ADR 020.** PR #236.
- **DB migration collapse.** 11 incremental drizzle migrations folded into a single `0000_initial.sql`; one-shot DDL files retired. PRs #222, #228.
- **Saved-decks rename + delete affordance, route group-by enums extracted (SvelteKit forbids non-load exports), citations agent reference doc, review-session resolver test coverage, InfoTip popover persistence fix.** PRs #218, #219, #220, #221, #211.
- **Sim-card mapping work package + 16 sim-mapped knowledge nodes.** Doc PR #213, content PR #232.

## In flight

- *(FAR navigation course Weeks 3-10 and 2 sibling capstones moved to "Just shipped 2026-04-30".)*

## ADR 016 status (post-2026-04-28 ship)

Phases 0-9 all on main. The ADR phase table in [decision.md](../decisions/016-cert-syllabus-goal-model/decision.md#migration-plan) reflects this. Only phase 10 -- ongoing iterative transcription of remaining ACS/PTS/endorsement syllabi -- remains as documented work, and it is by design not a single deliverable.

The three transparent scope decisions called out at ship time (PRs #321 / #323 / #324) live as named follow-ons below. Each has a build plan; each has a trigger; none survive as an undecided "future consideration" per CLAUDE.md.

## Follow-ons captured from the cert-syllabus surface ship (2026-04-28)

### Follow-on 1 -- Node-level weakness lens

**What shipped (PR #323):** `/lens/weakness` ranks at the domain level via the existing `getWeakAreas` BC. Three reason kinds (`card-accuracy`, `rep-accuracy`, `overdue`). Severity buckets via score-normalised thresholds.

**What's missing:** per-node ranking with four reason kinds (`miscalibration`, `overdue`, `low_accuracy`, `never_attempted`). The spec called this out as the ideal v2 shape.

**Trigger:** a real walkthrough where the domain row points at "weather" but the actionable gap is one specific node, and the user can't drill from domain -> node without leaving the lens.

**Plan when triggered:**

| Step | Work                                                                                                                                                                                                                                                                                                 | Where                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1    | New BC fn `getWeakNodes(userId, severity?, limit?, db?, now?) -> Promise<WeakNode[]>` (node-level analog)                                                                                                                                                                                            | `libs/bc/study/src/dashboard.ts`                |
| 2    | New types `WeakNode { nodeId, score, severity, reasons }` and `WeakNodeReason` discriminated union                                                                                                                                                                                                   | same file                                       |
| 3    | Reasons: `miscalibration` (per-node cal point delta vs target retention; from `confidence_calibration_point`); `overdue` (from `card_state.dueAt` join `card.nodeId`); `low_accuracy` (per-node card-rating roll-up); `never_attempted` (`knowledge_node` rows with no card or rep activity by user) | new SQL in `dashboard.ts`                       |
| 4    | Constants `WEAKNESS_NODE_SIGNAL_KINDS` + `WEAKNESS_NODE_SIGNAL_WEIGHTS` (defaults captured in lens-ui spec)                                                                                                                                                                                          | `libs/constants/src/credentials.ts`             |
| 5    | Refactor `/lens/weakness` to use `getWeakNodes` (domain rollup becomes a derived view from node-level)                                                                                                                                                                                               | `apps/study/src/routes/(app)/lens/weakness/...` |
| 6    | Severity-bucket page renders per-node rows with reason chips + drill-to-node CTA                                                                                                                                                                                                                     | same                                            |
| 7    | Vitest unit tests for `getWeakNodes` against seeded data (Abby's dev seed)                                                                                                                                                                                                                           | `libs/bc/study/src/dashboard.test.ts`           |
| 8    | Existing Playwright e2e in `tests/e2e/lens-ui.spec.ts` expanded with node-row assertions                                                                                                                                                                                                             | `tests/e2e/lens-ui.spec.ts`                     |

**Estimated scope:** medium. One BC function with four signal queries, one constants block, one page rewrite, tests. Roughly a day if the seed data exposes all four signal kinds; iterative if signals need shaping.

**Out of scope:** changing the existing `getWeakAreas` BC (kept as the dashboard fast-path); per-node calibration math beyond what `confidence_calibration_point` already exposes; goal-aware filters (deferred to follow-on 3).

### Follow-on 2 -- Modal node-picker for the goal composer

**What shipped (PR #324):** `/goals/[id]?edit=1` exposes an inline `<select>` listing up to 25 not-yet-added knowledge nodes from `listNodesWithFacets`. No filter chips, no search, no preview.

**What's missing:** the spec's preferred modal-with-filter-chips picker (a) for scaling beyond 25 candidates and (b) for matching the citation-picker idiom already used elsewhere.

**Trigger:** walkthrough friction. Specifically: the user can't find a node from the 25-candidate inline list, OR the user routinely scrolls past the dropdown to a different surface to copy a node id.

**Plan when triggered:**

| Step | Work                                                                                                                   | Where                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | Reuse `Dialog.svelte` (already used by ConfirmAction) for the modal shell                                              | -------------------------------------------------------- |
| 2    | New `NodePicker.svelte` -- left rail filter chips (Domain, Cert, Lifecycle), right rail results, top-bar text search   | `libs/ui/src/components/NodePicker.svelte` (new)         |
| 3    | Loader call uses `listNodesWithFacets({ domain?, cert?, lifecycle? })` already shipped; pagination via existing facets | same                                                     |
| 4    | Search debounced 200ms; client-side substring match on title (small graph, server filtering not needed yet)            | same                                                     |
| 5    | Wire `NodePicker` into the goal-detail edit mode in place of the current `<select>`                                    | `apps/study/src/routes/(app)/goals/[id]/+page.svelte`    |
| 6    | Form-action submit unchanged (`?/addNode` with `knowledgeNodeId`); the picker just produces the id                     | `apps/study/src/routes/(app)/goals/[id]/+page.server.ts` |
| 7    | Promote pattern for reuse if the lens-ui follow-on or the cert-dashboard ever needs the same picker                    | re-export `NodePicker` from `libs/ui`                    |
| 8    | E2E: open picker, type 3 chars, click first result, confirm row appears on goal                                        | `tests/e2e/goal-composer.spec.ts`                        |

**Estimated scope:** small to medium. The shape (filter chips + search + result list inside a Dialog) is well-trodden in the codebase via `CitationPicker`. Most of the work is wiring + styling. Roughly half a day.

**Out of scope:** server-side full-text search (the graph fits in memory for the foreseeable future); bulk multi-select (single-add per click matches v1; bulk earns its keep when batch-curating goals from a weak-areas walkthrough lands).

### Follow-on 3 -- Engine cutover to goal-derived filters (next ADR 016 phase)

**Status (2026-04-29):** in flight as WP [`engine-goal-cutover`](../work-packages/engine-goal-cutover/spec.md). The dual-read helper, telemetry, plan-UI redirect, and drop-migration are staged; the column drop ships in a follow-up PR after the 14-day telemetry trigger fires.

**What shipped (PRs #270, #324):** the goal model is the source of truth for "what the learner is pursuing." `study_plan.cert_goals` -> `goal_syllabus` migration ran. `getDerivedCertGoals(userId)` returns the cert-slug projection of the primary goal. `getGoalNodeUnion(goalId)` returns the union of nodes a goal targets.

**What's missing:** the session engine (`libs/bc/study/src/engine.ts`) still reads `study_plan.cert_goals` directly. The "primary" goal designation drives no rep selection; the dashboard reads goals but the rep loop does not.

**Trigger:** ready now (no walkthrough gating needed). The cutover unblocks the goal composer being usable for actual study sessions, not just bookkeeping.

**Plan:**

This deserves a proper work package authored via `/ball-wp-spec` rather than an inline plan, because it touches the engine's selection contract. Sketch:

| Phase | Scope                                                                                                                                                           | Key files                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1     | Spec WP `engine-goal-cutover` -- contract changes, dual-read window, telemetry, rollback plan                                                                   | `docs/work-packages/engine-goal-cutover/`               |
| 2     | New BC fn `getActiveTargetingFilters(userId)` returns `{ certGoals, focusDomains, skipDomains, depthPreference }` -- reads goal first, falls back to study_plan | `libs/bc/study/src/sessions.ts` or new `targeting.ts`   |
| 3     | Engine `pickContinue` / `pickStrengthen` / `pickExpand` / `pickDiversify` switch from reading `study_plan` to reading the targeting helper                      | `libs/bc/study/src/engine.ts`                           |
| 4     | Dual-read: when `getPrimaryGoal` returns non-null, prefer goal-derived; otherwise fall back to study_plan (compatibility)                                       | targeting helper                                        |
| 5     | Once a study_plan -> goal sync rule is decided, drop the `cert_goals` column read from the engine entirely (kept on the table for one release as a safety net)  | engine.ts                                               |
| 6     | Remove `cert_goals` column from `study_plan` after one stable release (deferred to a final cleanup PR)                                                          | drizzle migration                                       |
| 7     | Ports the existing engine test suite forward; adds new tests for the goal-driven path                                                                           | `libs/bc/study/src/engine.test.ts`                      |
| 8     | E2E: create goal -> add syllabus -> set primary -> start session -> verify scenario picks come from the goal's union                                            | `tests/e2e/goal-composer.spec.ts` extension OR new spec |

**Estimated scope:** medium to large. The engine selection logic is mature and well-tested; the cutover is a contract migration with a dual-read safety net rather than a green-field write. Carve into 2-3 PRs (BC helper + engine read + study_plan column drop). Roughly 3-5 days authored carefully.

**Out of scope of follow-on 3:**

- Per-leaf evidence-kind gating (ADR 016 mentions S leaves needing scenario evidence; that's a separate engine improvement, not this cutover).
- Plan UI changes -- `study_plan` rows stay; the user's plans page keeps working until the column drop in phase 6.
- Multi-goal targeting (the engine reads the primary goal only; multi-goal weighting is its own design problem).

## Suggested next-up sequencing

| Order | Item                                                                 | Reason                                                                              |
| ----- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1     | Manual test passes on the three new surfaces (#321 / #323 / #324)    | The build pushed merges ahead of testing; close the loop before adding more.        |
| 2     | Follow-on 3 (engine cutover) WP authored                             | Unlocks the goal composer for actual study, not just bookkeeping. Trigger is ready. |
| 3     | FAR navigation course Week 3 (CFI) authored                          | Slow burn; proceeds in parallel with the rest.                                      |
| 4     | Follow-ons 1 + 2 deferred until a real walkthrough surfaces friction | Doing them speculatively risks wrong shape; let usage drive.                        |

## Recently closed (no longer active)

- **Cluster G small-fixes** (items 2, 6, 17, 23) shipped via PR #106 ("small SMI walkthrough fixes -- badges, nav, question clarity, browse stats"). Source todo file [archived](.archive/todos/20260424-02-smi-walkthrough-feedback.md) lists all 17 closing PRs.
- **ADR 019 phases 1-9** all on main (see "Just shipped" above).
- **Cert-syllabus + goal composer WP** all 24 phases shipped across 5 PRs.

## Five draft work packages -- all shipped

Authored 2026-04-25 from the SMI walkthrough triage and originally listed as deferred. Verdict pass on 2026-04-28 (PR #311) found that every one of them had already shipped during the redesign sprint. Each spec now carries a `status: done` frontmatter and a verdict block citing the shipping PRs.

| Work package                                                                              | Cluster | Shipping evidence                                                                                           |
| ----------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| [review-flow-v2](../work-packages/review-flow-v2/spec.md)                                 | B       | Chicklets, two-line ratings, undo, confidence-adjust, help chicklet (PRs #138, #49, #169)                   |
| [snooze-and-flag](../work-packages/snooze-and-flag/spec.md)                               | C       | `card_snooze` + `card_feedback` tables, full BC, `SnoozeReasonPopover`, Browse `Removed` (PRs #135, #138)   |
| [review-sessions-url](../work-packages/review-sessions-url/spec.md)                       | D       | Resume + Redo + Share (`SharePopover`, deck-hash encoder, `memory_review_session`) (PRs #154, #159)         |
| [card-page-and-cross-references](../work-packages/card-page-and-cross-references/spec.md) | E       | Public `cards/[id]` route, `getPublicCard`, `getCardCrossReferences` panel (PR #128)                        |
| [content-citations](../work-packages/content-citations/spec.md)                           | F       | Polymorphic `study.content_citations` table + BC + picker; trigger fired via PRs #299, #309 (PR #127, #278) |

## Deferred work packages from the 2026-04-27 12-axis review

Captured as part of the review-fix PR. Each has an explicit trigger condition; none survives as an undecided "future consideration" per CLAUDE.md.

Wave 1 (5 packages) shipped 2026-04-28 via PRs #278 + #284 -- see "Just shipped" above. Remaining gated work:

| Work package                                                                          | Trigger                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [route-style-extraction](../work-packages/route-style-extraction/spec.md)             | Dashboard refresh (residuals: structured-badges-below-title, tab-strip-in-header, runner-chrome) |
| [sim-scenario-table](../work-packages/sim-scenario-table/spec.md)                     | When sim manifests move into hangar                                                              |
| [memory-review-load-as-action](../work-packages/memory-review-load-as-action/spec.md) | Folded into [review-flow-v2](../work-packages/review-flow-v2/spec.md)                            |

## Build Order

Original MVP build order (Steps 1-6) shipped between PRs #1-#16. The active build order today is:

| Step | Work                                                     | Status                                                                               |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 7    | Scale knowledge graph to ~500 nodes                      | Ongoing (16 sim-mapped nodes via #232; cumulative count not centrally tracked)       |
| 8    | Manual test passes (user zero) for the six MVP features  | Pending                                                                              |
| ---- | ADR 019 phases 1-9 (validator -> ingest -> migration)    | Shipped (PRs #241, #246, #247, #249, #250, #251, #252, #260, #261, #266, #268, #276) |
| ---- | ADR 019 phase 10 -- irregular corpora (NTSB, CC, etc.)   | Shipped (PRs #309, #316, #318, #322 -- 12 corpora resolved + seeded; asrs empty)     |
| ---- | ADR 019 §11 acceptance criteria audit                    | Shipped (PR #319 -- 13/13 boxes addressed)                                           |
| ---- | Cert-syllabus + goal composer WP (data layer)            | Shipped (PRs #248, #254, #264, #270, #274)                                           |
| ---- | Cert-syllabus surface work (dashboard + lens + composer) | Shipped (PRs #321, #323, #324 -- ADR 016 phases 7-9 complete)                        |
| ---- | FAR navigation course Weeks 3-10                         | Shipped (PRs #349 work-package, #350 content -- all 10 weeks + 4 capstones authored) |
| ---- | FIRC migration as `apps/firc/`                           | Deferred (post-MVP-proven)                                                           |

## Next

The original MVP roadmap is done in code; the human-side work and the post-MVP build-out are the active fronts.

1. **Manual test passes on every shipped feature.** CLAUDE.md's "nothing merges without a manual test plan" rule got overridden in the parallel-build velocity push. Six features sit on main without a user-zero walkthrough. Test plans live in each work package:

   - [spaced-memory-items/test-plan.md](../work-packages/spaced-memory-items/test-plan.md)
   - [decision-reps/test-plan.md](../work-packages/decision-reps/test-plan.md)
   - [calibration-tracker/test-plan.md](../work-packages/calibration-tracker/test-plan.md)
   - [knowledge-graph/test-plan.md](../work-packages/knowledge-graph/test-plan.md)
   - [study-plan-and-session-engine/test-plan.md](../work-packages/study-plan-and-session-engine/test-plan.md)
   - [learning-dashboard/test-plan.md](../work-packages/learning-dashboard/test-plan.md)

   The 2026-04-25 walkthrough plan at [`docs/work/walkthroughs/20260425/PLAN.md`](walkthroughs/20260425/PLAN.md) audited each test plan against current main and pruned dead steps; that's the doc to walk from, not the raw test plans.

2. **Author Week 2 of the regulations course (Part 61 deep)**, now unblocked by the `airboss-ref:` round-trip. The course and the graph reinforce each other and are best authored as a pair.

3. **Decide CFR XML storage.** Open question in [`reference-extraction-pipeline/tasks.md`](../work-packages/reference-extraction-pipeline/tasks.md): commit, LFS, or external? ADR-shaped product call.

4. **Engine cutover to goal-derived filters.** Now that the goal composer ships, route the session engine through `getGoalNodeUnion` + `getDerivedCertGoals` instead of reading `study_plan.cert_goals` directly.

## Pending infra cleanup

- **`review_status` flips** on each work package's `review.md` -- agent-controlled field that hasn't been flipped to `done` on the newer packages.
- **`wip/2026-04-25-safety-net` branch** -- check what's in it; keep or delete.
- **`.claude/worktrees/agent-*` paths** -- locked to live PIDs from other agents. Will release naturally as agents finish; run `/audit-worktrees` for the current inventory.

## Links

- [MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- surface-typed app architecture
- [PIVOT.md](../platform/PIVOT.md) -- why airboss exists
- [DESIGN_PRINCIPLES.md](../platform/DESIGN_PRINCIPLES.md) -- how we evaluate features
- [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md) -- knowledge graph learning system
- [ADR 016](../decisions/016-cert-syllabus-goal-model/decision.md) -- cert / syllabus / goal / lens model
- [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md) -- source artifact storage policy (amended for the scale-tier exception in #260)
- [ADR 019](../decisions/019-reference-identifier-system/decision.md) + [revisit.md](../decisions/019-reference-identifier-system/revisit.md) -- reference identifier system
- [ADR 020](../decisions/020-handbook-edition-and-amendment-policy.md) -- handbook editions + errata
- [IDEAS.md](../platform/IDEAS.md) -- idea intake (last review: 2026-04-07; due for a fresh pass)
- [VOCABULARY.md](../platform/VOCABULARY.md) -- naming standards
- [Product INDEX](../vision/INDEX.md) -- all 53 product ideas
- [Learning INDEX](../vision/learning/INDEX.md) -- the 14 aviation domains
- [Loose ends 2026-04-27](../loose-ends/2026-04-27.md) -- project-wide scan for forgotten / deferred work

## Relationship to airboss-firc

FIRC-specific code, content, and work stays in [airboss-firc](/Users/joshua/src/_me/aviation/airboss-firc) until the FIRC migration step. That repo has the 4 SvelteKit apps (sim, hangar, ops, runway), the FAA compliance pipeline, the 503 questions, and ongoing FIRC-specific work. Nothing new should be built in airboss-firc going forward.
