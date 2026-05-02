# Now

Single entry point for "what should I work on?" in airboss. Refresh date: 2026-05-02 (WP-SUB plan ratified + Cluster H closure WP authored + sources-review fixer wave in flight).

## Just shipped (2026-05-02 -- WP-SUB ratified, Cluster H closure, sources-review fixer wave begins)

- **[library-substrate (WP-SUB) shipped end-to-end (PR #393 plan + PR #396 implementation)](../work-packages/library-substrate/spec.md).** Foundation WP for [library-completeness](../work-packages/library-completeness/spec.md) sequence step #1. Plan ratified via PR #393 (2026-05-01 23:28 UTC); implementation landed via PR #396 (2026-05-01 23:05 UTC -- in fact merged 23 minutes ahead of its own plan). 33 files changed: schema rename (`handbook_section` -> `reference_section` + figure + errata), schema relax (handbook-shaped CHECK constraints dropped; `section_schema` + `metadata` jsonb + `depth` added), seeder generalization (`scripts/db/seed-references-from-manifest.ts` dispatches between [section-tree](../../libs/bc/study/src/seeders/section-tree.ts) + [whole-doc](../../libs/bc/study/src/seeders/whole-doc.ts) seeders), `getReadableReferenceIds()` rewritten against `content_md`. Acceptance criterion met: all 9 handbooks seed (3 sectioned at full chapter trees + 6 whole-doc at depth 0). **Unblocks** sequence items 2-12: WP-MTN, WP-AIM, WP-CFR-V, WP-AC-V, WP-ACS-V, WP-CC, WP-NTSB-ALJ, WP-SAFO, WP-INFO, WP-AC-FULL, WP-O8900-V5, WP-SAFETY-BRIEF.
- **[promotion-batches-persistence WP authored -- Cluster H closure (PR #404)](../work-packages/promotion-batches-persistence/spec.md).** Closes the 2026-05-01 sources-content-pipeline review's Cluster H finding: `promotion_batches` + `EDITIONS` are in-memory Maps; audit trail wipes on every restart. Spec + tasks + test-plan + design authored, with W5/W6 reconciliation notes so those build to the persistent contract instead of an in-memory contract that has to be partially undone. Build sequenced after W5/W6 land.
- **Sources fixer wave begins -- 2026-05-01 review closure.** Six fixer PRs merged so far (out of 141 review findings across 9 reviewers). Cache-root consolidation (#402) closes the `defaultCacheRoot()` 5x-duplication finding. Atomic tmp+rename writes (#403) close the partial-write finding across all source/derivative writers. AIM ingest manifest read + AC dot-style URL builder (#401) close two correctness criticals. Test isolation + manifest schema + partial-dl log + readme update (#407). E2e credentials/PHAK pin fix (#400). Test alias + register-all stub (#399). Five additional fixer PRs in flight (#405 HTTP hardening, #408 backend criticals, #409 registry O(1) lookup, #413 retire `data/sources/` -- Cluster A closure, #414 prompt fence + idempotent writes).
- **Worktree cleanup (this session).** 3 stale worktrees + 7 leftover branches removed; local main fully synced; one self-caused PR-conflict resolved (PR #393 force-push to drop a misplaced WP-status-flip commit that landed via #394 instead).

## Just shipped (2026-05-01 -- library-by-cert taxonomy + completeness ratification)

- **library-by-cert taxonomy shipped end-to-end (PRs #386, #389, #390, #391, #392).** Four waves landed in one day. Wave 1 (#386): `reference.primary_cert` column + ratified value set (NULL = cert-agnostic; CHECK against `CERT_APPLICABILITY_VALUES`). Wave 2 (#389): backfilled `primary_cert` for every existing reference YAML (no more nullable orphans on shipped corpora). Wave 3a (#390): manifest schema accepts `carryover_cert` per-section + new BC primitives; retires `handbooks-overrides.yaml`. Wave 3b (#391): new route family at `/library/cert/[cert]`, `/library/topic/[topic]`, `/library/regulations`, `/library/handbook/[id]`; the prior `[doc]` shape is retired (redirected). Wave 4 (#392): vitest unit + Playwright e2e + orphan-check script. **Spec at [library-by-cert/spec.md](../work-packages/library-by-cert/spec.md), `status: shipped` (closes #383).**
- **library-completeness ratified through v3 (PRs #385, #387, #388).** v1 (#385) recommended `library_entry` projection table; review.md argued the projection ships a workaround over a root-cause fix. v2 (#387) replaced §1 with the substrate rename. v3 (#388) cleaned up post-merge inconsistencies + answered ratification 2.B (the seed check found `kind: whole-doc` manifests fail handbook schema, so WP-EX-Verify folded into WP-SUB). Final spec at [library-completeness/spec.md](../work-packages/library-completeness/spec.md) with full ratification table; sequence #1-#12 captured.
- **handbooks-extras ingestion pipeline shipped (PR #384).** 6 additional handbooks now register: risk-management (252K), aviation-instructor (784K), IFH (2.0M), IPH (1.2M), AMT-general (3.5M), AMT-powerplant (2.5M). New `handbooks-extras register` subcommand; URI prefix kept consistent with the existing `handbooks` corpus. Closes gap 5 from the broad-extraction survey.
- **CFR walker fix (PR #382).** Walker accepts `<DIV5 TYPE="PART">` root in addition to `<DIV1 TYPE="TITLE">` for filtered titles; numeric entity decoding (`&#xA7;` -> `§`) enabled. Closes a CFR-49 ingestion blocker.
- **Library + content cleanups (PR #379).** ACS slug mapping (5/5 ingested), AFH duplicate-errata cleanup (605 dup lines removed), IDEAS.md sweep timestamp.
- **WP status reconciliation (PR #394).** `hangar-users-editing` flipped to `shipped` (PR #371 closed it). `evidence-kind-data-layer`, `hangar-invite-flow`, `extract-provenance-and-signoff` flipped to `read` (specs accepted, queued for build sequencing).

## Just shipped (2026-04-30 -- scheduled-jobs + library rename + cleanups)

- **[scheduled-jobs skill bootstrapped (PR #378)](../../scripts/scheduler/README.md).** Local launchd-driven scheduler for repo-scoped scheduled work, installed from the [scheduled-jobs skill](~/src/_me/ai/agent-skills/skills/scheduled-jobs/SKILL.md). Each job runs in an isolated git worktree branched from main; the user's main checkout is never touched. Wired in: `scripts/scheduler/` (manager), `scripts/scheduled-jobs/` (jobs root), CLAUDE.md pointer, 5 `schedule:*` package.json aliases. Two airboss jobs registered with launchd: `now-md-drift` (daily 09:00, log-only -- writes a drift report when WPs marked `status: shipped` are still in NOW.md's "In flight"), and `cert-goals-drop-trigger-watch` (nightly 02:00, open-pr -- polls `bun run db check engine-targeting-source --window=14d`, ships the staged migration when 14 consecutive days hit). Both smoke-tested end-to-end.
- **`/handbooks` -> `/library` rename (PR #376).** Reader subject grouping + every reference kind exposed. `/handbooks` becomes a `[...rest]` redirect for inbound link compatibility; `/library` is the canonical home.
- **`/admin/audit-ping` retired (PR #375).** Route gone; the `audit-ping` enum value stays per ADR 004 (audit-log enum is append-only). Closed by [`retire-audit-ping`](../work-packages/retire-audit-ping/) WP (`status: shipped`).
- **Hangar user editing (PR #371).** First admin-write surface in hangar -- role / ban / session revoke. Composes on the audit explorer (#365).
- **Identity menu close-on-outside-pointerdown fix (PR #373).** Small UX fix to the study layout's identity menu.
- **Library + content cleanups -- gaps 2 + 6 + IDEAS.md sweep (PR #379).** Three file-disjoint cleanups: ACS slug mapping for the four cached PDFs that were detecting fine but skipping at register time (now `scanned=5 ingested=5 skipped=0`, 5 publications / 53 areas / 276 tasks / 1576 elements); AFH duplicate-errata cleanup (605 lines of duplicated content removed across 6 files where MOSAIC errata had been applied multiple times); IDEAS.md sweep timestamp (2026-04-30 marker, no triage performed -- ~50 active ideas across 7 sections, funnel healthy).
- **Postgres pool drain on script exit (PR #380).** `bun run db reset --force` and 10 other `scripts/db/*` entrypoints were hanging ~20s after their work because `libs/db/src/connection.ts` opens a pool on import and Bun keeps the event loop alive until the pool's idle timeout. Added `await client.end()` in `.finally()` for 11 scripts. Force-exit scripts skipped (drain irrelevant); non-DB scripts skipped.
- **Provenance + signoff WP authored (PR #374).** Extract-provenance-and-signoff spec on disk; `status: unread`. Plus a fresh CFR Title 14 ingest. Closes the second half of the library-broad-extraction-survey work.
- **Hangar invite flow WP authored (PR #377).** Spec + tasks + test-plan + design on disk; `status: draft`. The next admin-write surface after user-editing.

## Just shipped (2026-04-30 -- hangar admin audit explorer)

- **[hangar-audit-explorer](../work-packages/hangar-audit-explorer/spec.md) shipped (PR #365).** Cross-cutting audit explorer at `/admin/audit` + `/admin/audit/[id]`. Pure read consumer of `audit.audit_log`. New BC reads (`listAuditEntries`, `getAuditEntry`, `searchActorIds`) cursor-paginate / join the actor / typeahead. Filter bar UI (actor, target type/id, op, time-window chips), side-by-side jsonb panes on the detail page. Hangar dashboard's System -> Audit tile retargeted; audit-ping retirement is a separate follow-up cleanup WP. Spec frontmatter `status: shipped`.
- **CockpitPanel promoted to `libs/activities/cockpit-panel/` (PR #364).** Sim is the second consumer; matches the PFD promotion pattern from #328. 10 components moved (Altimeter, AnnunciatorStrip, Asi, AttitudeIndicator, CockpitPanel, HeadingIndicator, Tachometer, TurnCoordinator, Vsi, plus a `cluster/` subdir).
- **Encoded-text family kicked off (PR #369).** New `course/weather/` and `course/notams/` skeletons + the wx scenario engine vision. Both anchor the broader encoded-text pedagogy ladder (decode -> understand -> triage) called out in memory: `project_encoded_text_family.md`. PRDs at `docs/vision/products/pre-flight/notam-triage/` + `weather-scenario-engine/`.
- **WP `status:` frontmatter flips.** Three WPs whose code shipped without a spec-status flip: `evidence-kind-gating` (#361), `engine-goal-cutover` (#353), `cert-syllabus-and-goal-composer` (#248/254/264/270/274). All flipped to `status: shipped`.

## Just shipped (2026-04-30 -- doc + audit reconciliation)

- **Citations pattern doc refreshed** ([`docs/agents/reference-citations-pattern.md`](../agents/reference-citations-pattern.md)). Six stale refs corrected against current main: migration repointed from the retired `drizzle/0004_content_citations.sql` to the consolidated `drizzle/0000_initial.sql`; five `:line` references updated where files moved during intervening refactors. PR #358.
- **Magic-strings audit reconciled** ([`docs/work/reviews/20260424-magic-strings-audit.md`](reviews/20260424-magic-strings-audit.md)). Triaged ~20 items against current main; only the lifecycle literals in `libs/bc/study/src/knowledge.ts` (`lifecycleFromContent` return type + `?? 'skeleton'` fallback) were genuinely open. Replaced with `NODE_LIFECYCLES.{SKELETON,STARTED,COMPLETE}`. Audit doc gets a `Reconciliation 2026-04-30` table at the bottom showing each item's disposition (closed by PR #312, closed by post-pivot taxonomy migration, closed by ADR 014, closed by z-index tokens, closed by this PR, deliberately left). One item left: `SLICE_HELP_SECTION` value literals are help-fragment IDs that shadow `SESSION_SLICES.*` values by convention; coupling them would conflate two parallel vocabularies. PR #360.
- **`canonicalize` opt-in unordered-array keys** ([`libs/bc/study/src/deck-spec.ts`](../../libs/bc/study/src/deck-spec.ts)). Lifted hardcoded `if (last === 'tags')` to a module-scope `UNORDERED_ARRAY_KEYS` set so future deck-spec fields opt in without growing new branches. Behaviour for `tags` unchanged. PR #358.

## Just shipped (2026-04-30 -- section-extraction-contract-v2 WP closed)

- **[section-extraction-contract-v2](../work-packages/section-extraction-contract-v2/spec.md) shipped end-to-end.** Five phases, ten PRs. v1 baseline (559 entries with 11/17 truncated chapters) -> v4 production (911 entries with structured disagreement signal feeding back to the TOC parser). PR #366 is the production phak run under contract v4: 911 LLM section-tree entries + 357 disagreements across 14 chapters (chs 4, 11, 12 fully agree). Disagreements file format documented in the contract; loader at [`load_chapter_disagreements`](../../tools/handbook-ingest/ingest/sections_via_sidecar.py); aggregated in the compare report. **Resumption path captured at [RESUMING.md](../work-packages/section-extraction-contract-v2/RESUMING.md)** -- TOC parser improvements deferred indefinitely; the 357 disagreements are persistent training data when someone returns. PRs #332 #335 #342 #355 #356 #359 #363 #366 plus closure PR.

## Just shipped (2026-04-30 -- evidence-kind-gating WP)

- **[evidence-kind-gating](../work-packages/evidence-kind-gating/spec.md) shipped.** Per-cert triad mapping (`TRIAD_EVIDENCE_REQUIREMENTS` keyed by `CertApplicability`) + `requires_teaching` flag on `syllabus_node` + new `mastery.ts` BC primitive (`getNodeEvidenceState`, `isLeafMastered`, `aggregateLeafKindStates`). Rollups in `getCredentialMastery`, `acsLens`, and `domainLens` now decompose mastery per `AssessmentMethod` and surface `missingKinds` so the cert dashboard can render "you have recall down but need a scenario" without re-walking. Hard cutover: existing `mastered: boolean` keeps name + meaning; new fields are additive. Achievable scope shipped: `recall` and `scenario` gates compute against the live schema; `calculation`, `demonstration`, and `teaching` return `not_applicable` until backing data ships (no `card.kind`, no `scenario.assessment_methods`, no `teaching-exercise` SESSION_ITEM_KIND today -- richer partition is a follow-on data WP). YAML element schema now accepts `requires_teaching: true`; CFI ACS-25 transcription stays incremental.

## Just shipped (2026-04-30 -- FAR navigation course Weeks 3-10 + 2 sibling capstones)

- **FAR navigation course is content-complete.** All 10 weeks authored. All 4 sibling capstone orals authored. Authored across one work package PR (#349, merged) and one content PR (#350, the omnibus). Authoring approach: parallel sub-agents per week, exclusive directory ownership, phased dispatch.
  - Week 3 -- Part 61 CFI (subpart H, endorsements, FOI): 6 files (5 lessons + overview) + drills + oral (~1,931 lines)
  - Week 4 -- Part 91 general + flight rules: 7 files (6 lessons + overview) + drills + oral (Week 4 lessons 03-06 + drills + oral authored inline by the dispatcher after content-filter blocks on the sub-agent return path)
  - Week 5 -- Part 91 equipment + maintenance: 6 files (5 lessons + overview) + drills + oral (~2,863 lines, "very deep" treatment)
  - Week 6 -- Part 91 special ops + integration: 6 files (5 lessons + overview) + drills + oral (~1,911 lines)
  - Week 7 -- Parts 141/135: 5 files (4 lessons + overview) + drills + oral (~1,244 lines, "cursory" literacy treatment)
  - Week 8 -- Companion documents (AIM, AC, Chief Counsel, 49 CFR): 6 files (5 lessons + overview) + drills + oral (~1,839 lines)
  - Week 9 -- Enforcement + NTSB Part 830: 7 files (6 lessons + overview) + drills + oral (~2,738 lines)
  - Week 10 -- Capstone + 2 new sibling capstone orals (`friend-flight-review.md`, `ppl-applies-for-ir.md`): 4 files (3 lessons + overview) + drills + oral + 2 capstones (~691 lines + 59KB capstones). Two existing capstone orals (`gear-up-night-ifr.md` from Week 1 era, `night-ifr-passenger.md` from #235) bring the total to 4/4 sibling capstones.
  - All citations use `airboss-ref:` URI syntax per ADR 019. Validator (`bun scripts/references.ts validate`) clean, 0 errors.
  - CHANGELOG status table flipped to "Authored" for all 10 weeks; capstones flipped to 4/4.

## Just shipped (2026-04-29 -- chapter-source-ingestion WP closed, ADR 022)

- **[chapter-source-ingestion](../work-packages/chapter-source-ingestion/spec.md) shipped.** YAML-driven source config, chapter-PDF download path, AIM HTML extraction, and `bun run sources verify-urls` / `inventory` commands. PHAK regenerated under chapter-PDF mode + contract v3 in PR #355: **913 LLM section-extraction entries across 17 chapters** (up from the v1 baseline of 559). PRs #337 (main feature), #338 (cleanup), #339 (HTML idempotency), #340 (handbooks-extras URL audit), #341 (chapter-filter fix), #342 (contract v2 + truncation fix), #343 (PHAK regen), #355 (contract v3 + production phak run). [ADR 022](../decisions/022-chapter-source-ingestion/decision.md) records the design.
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

- **[promotion-batches-persistence](../work-packages/promotion-batches-persistence/spec.md) (2026-05-02).** Cluster H closure WP authored via PR #404. Replaces the in-memory `promotion_batches` + `EDITIONS` Maps in `libs/sources/src/registry/` with Postgres-backed tables; freezes the audit-row contract from ADR 019 §2.4. **W5 (PR #409 -- registry index) + W6 (PR #403 -- atomic in-memory writes) both shipped 2026-05-02; build gate now lifted.** Ready for build sequencing.
- **[evidence-kind-data-layer](../work-packages/evidence-kind-data-layer/spec.md) (2026-04-30).** Authored to close the `not_applicable` shims that `evidence-kind-gating` (#361) shipped: today `calculation`, `demonstration`, and `teaching` gates return `not_applicable` because there's no `card.kind`, no `scenario.assessment_methods`, and no `teaching-exercise` `SESSION_ITEM_KIND`. WP plans the schema + seeds + assessment-method writes that make the four-kind partition real. Spec authored (#367); `status: read`, queued for build sequencing.
- **[hangar-invite-flow](../work-packages/hangar-invite-flow/spec.md) (2026-04-30).** Spec + tasks + test-plan + design authored via PR #377. `status: read`. Next admin-write surface after user-editing (shipped #371). Queued for build sequencing.
- **[extract-provenance-and-signoff](../work-packages/extract-provenance-and-signoff/spec.md) (2026-04-30).** Spec authored via PR #374. `status: read`. Closes the back half of the library-broad-extraction-survey -- captures who/when/how content was extracted + a signoff workflow. Queued for build sequencing.
- **[library-broad-extraction-survey](../work-packages/library-broad-extraction-survey/spec.md) (2026-04-30).** Survey-shaped WP authored via PR #374; no `status:` frontmatter. Read-only inventory of what's in the library + what extraction quality looks like across corpora.

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

### Follow-on 3 -- Engine cutover to goal-derived filters (shipped)

**Status (2026-04-30):** shipped via PR #353. The dual-read helper [`getEngineTargeting`](../../libs/bc/study/src/engine-targeting.ts) reads cert / focus / skip from the user's primary goal when present and falls back to legacy `study_plan` columns when not, with structured-log telemetry per `previewSession` call. Plan UI redirects to the goal composer; `createPlan` / `updatePlan` reject non-empty cert input via `PlanCertGoalsDeprecatedError`. The staged drop migration sits in the WP directory and lands after `bun run db check engine-targeting-source --window=14d` reports `READY TO DROP` (14 consecutive days with zero legacy reads).

**Spec:** [`engine-goal-cutover`](../work-packages/engine-goal-cutover/spec.md) (PR #345 spec, PR #353 implementation).

**Out of scope of this cutover (now or never):**

- Per-leaf evidence-kind gating -- shipped separately as [`evidence-kind-gating`](../work-packages/evidence-kind-gating/spec.md).
- Multi-goal targeting (the engine reads the primary goal only; multi-goal weighting is its own design problem when it earns its keep).

## Suggested next-up sequencing

| Order | Item                                                                  | Reason                                                                         |
| ----- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1     | Manual test passes on the cert-syllabus surfaces (#321 / #323 / #324) | The build pushed merges ahead of testing; close the loop before adding more.   |
| 2     | Confirm engine-cutover telemetry trigger fires (`READY TO DROP`)      | Triggers the `study_plan.cert_goals` column drop migration follow-up to #353.  |
| 3     | Follow-ons 1 + 2 deferred until a real walkthrough surfaces friction  | Doing them speculatively risks wrong shape; let usage drive.                   |

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

2. **Drop `study_plan.cert_goals` after the engine-cutover telemetry trigger fires.** PR #353 shipped the dual-read; the staged drop migration sits in [`engine-goal-cutover/`](../work-packages/engine-goal-cutover/spec.md) and lands when `bun run db check engine-targeting-source --window=14d` reports `READY TO DROP`.

3. **Decide CFR XML storage.** Open question in [`reference-extraction-pipeline/tasks.md`](../work-packages/reference-extraction-pipeline/tasks.md): commit, LFS, or external? ADR-shaped product call.

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
