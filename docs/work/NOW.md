# Now

Single entry point for "what should I work on?" in airboss. Refresh date: 2026-04-28.

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

- **Cert-syllabus surface work (post-data-layer).** Cert dashboard (ACS lens, ADR 016 phase 7), handbook + weakness lens UI (phase 8), personal goal composer (phase 9). The data layer is done; these are SvelteKit page chunks.
- **FAR navigation course Weeks 2-10.** Per `course/regulations/CHANGELOG.md`, Week 1 is fully authored; Weeks 2 (Part 61 deep), 3 (CFI), 4-6 (Part 91), 7 (141 + 135), 8 (companion docs), 9 (enforcement), 10 (capstone) await authoring. Two sibling capstones (friend-flight-review, ppl-applies-for-ir) deferred until they can be authored against `airboss-ref:` syntax in one pass. Now unblocked since `airboss-ref:` lessons round-trip cleanly through the validator + renderer.
- **Magic-strings fix PR.** Audit catalogued 30+ literals + 40+ enum-bypassing strings against existing `@ab/constants` exports. Pure mechanical swaps. Audit at [`docs/work/reviews/20260424-magic-strings-audit.md`](reviews/20260424-magic-strings-audit.md). Hasn't shipped; still applicable.
- **[extract-sim-instruments](../work-packages/extract-sim-instruments/spec.md)** -- the avionics surface now exists (PRs #291, #294, #297) and the PFD components live in `apps/avionics/src/lib/pfd/`. WP rewritten in PR #292 to track the new trigger ("second consumer of the PFD set"). Lib promotion to `libs/activities/pfd/` has not happened yet; on watch, ready to fire when the second consumer materialises.

## Recently closed (no longer active)

- **Cluster G small-fixes** (items 2, 6, 17, 23) shipped via PR #106 ("small SMI walkthrough fixes -- badges, nav, question clarity, browse stats"). Source todo file [archived](.archive/todos/20260424-02-smi-walkthrough-feedback.md) lists all 17 closing PRs.
- **ADR 019 phases 1-9** all on main (see "Just shipped" above).
- **Cert-syllabus + goal composer WP** all 24 phases shipped across 5 PRs.

## Five draft work packages -- now deferred

Authored 2026-04-25 from the SMI walkthrough triage. As of 2026-04-28, all five flipped to `status: deferred` with explicit triggers in their frontmatter (per CLAUDE.md "no undecided considerations for future work"). Each will be re-spec'd via `/ball-wp-spec` when its trigger fires.

| Work package                                                                              | Cluster | Trigger                                                                   |
| ----------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| [review-flow-v2](../work-packages/review-flow-v2/spec.md)                                 | B       | Next walkthrough re-raises items 7-9, 12-13, 16 (review-screen friction)  |
| [snooze-and-flag](../work-packages/snooze-and-flag/spec.md)                               | C       | review-flow-v2 unblocks AND a walkthrough re-raises items 10, 11          |
| [review-sessions-url](../work-packages/review-sessions-url/spec.md)                       | D       | A user actually loses a session and asks for resume / share / redo        |
| [card-page-and-cross-references](../work-packages/card-page-and-cross-references/spec.md) | E       | A user wants to share a single card publicly OR cited-by surface blocks   |
| [content-citations](../work-packages/content-citations/spec.md)                           | F       | ADR 019 phase 10 expands beyond ACS OR cert-syllabus needs polymorphic    |

## Deferred work packages from the 2026-04-27 12-axis review

Captured as part of the review-fix PR. Each has an explicit trigger condition; none survives as an undecided "future consideration" per CLAUDE.md.

Wave 1 (5 packages) shipped 2026-04-28 via PRs #278 + #284 -- see "Just shipped" above. Remaining gated work:

| Work package                                                                          | Trigger                                                               |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [route-style-extraction](../work-packages/route-style-extraction/spec.md)             | Next major UI overhaul                                                |
| [sim-scenario-table](../work-packages/sim-scenario-table/spec.md)                     | When sim manifests move into hangar                                   |
| [memory-review-load-as-action](../work-packages/memory-review-load-as-action/spec.md) | Folded into [review-flow-v2](../work-packages/review-flow-v2/spec.md) |

## Build Order

Original MVP build order (Steps 1-6) shipped between PRs #1-#16. The active build order today is:

| Step | Work                                                     | Status                                                                               |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 7    | Scale knowledge graph to ~500 nodes                      | Ongoing (16 sim-mapped nodes via #232; cumulative count not centrally tracked)       |
| 8    | Manual test passes (user zero) for the six MVP features  | Pending                                                                              |
| --   | ADR 019 phases 1-9 (validator -> ingest -> migration)    | Shipped (PRs #241, #246, #247, #249, #250, #251, #252, #260, #261, #266, #268, #276) |
| --   | ADR 019 phase 10 -- irregular corpora (NTSB, CC, etc.)   | Demand-driven; ACS PPL-ASEL slice shipped (#266); rest deferred per trigger          |
| --   | Cert-syllabus + goal composer WP (data layer)            | Shipped (PRs #248, #254, #264, #270, #274)                                           |
| --   | Cert-syllabus surface work (dashboard + lens + composer) | Pending (ADR 016 phases 7-9)                                                         |
| --   | FAR navigation course Weeks 2-10                         | Pending (Week 1 shipped #237; now unblocked by airboss-ref: round-trip)              |
| --   | FIRC migration as `apps/firc/`                           | Deferred (post-MVP-proven)                                                           |

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

2. **Cert-syllabus surface work.** ADR 016 phases 7-9 (cert dashboard, lens UI, goal composer pages). Data layer is done; this is the SvelteKit page chunk.

3. **Ship the magic-strings sweep PR.** Punch list at [`docs/work/reviews/20260424-magic-strings-audit.md`](reviews/20260424-magic-strings-audit.md). Pure mechanical swaps against existing `@ab/constants` exports.

4. **Author Week 2 of the regulations course (Part 61 deep)**, now unblocked by the `airboss-ref:` round-trip. The course and the graph reinforce each other and are best authored as a pair.

5. **Decide CFR XML storage.** Open question in [`reference-extraction-pipeline/tasks.md`](../work-packages/reference-extraction-pipeline/tasks.md): commit, LFS, or external? ADR-shaped product call.

## Pending infra cleanup

- **`review_status` flips** on each work package's `review.md` -- agent-controlled field that hasn't been flipped to `done` on the newer packages.
- **`wip/2026-04-25-safety-net` branch** -- check what's in it; keep or delete.
- **`.claude/worktrees/agent-*` paths** -- belong to other agents, all locked to live PIDs. Will release naturally as agents finish; run `/audit-worktrees` if you want the inventory.

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
