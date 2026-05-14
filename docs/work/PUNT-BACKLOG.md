# Punt backlog

Aggregated from session handoff dumps across many recent conversations. Source: pasted aggregate on 2026-05-13, audited same day against git log and current code state. This is a living index — close items by deleting them as PRs ship, add new ones as sessions punt. Not generated; hand-maintained.

**Last audit:** 2026-05-13. Items confirmed legit unless marked stale or removed.

Categories:

- [User-only walkthroughs owed](#user-only-walkthroughs-owed)
- [Real bugs + known issues](#real-bugs--known-issues)
- [Small mechanical follow-ups](#small-mechanical-follow-ups)
- [Phase 2 / continuation work](#phase-2--continuation-work)
- [New WPs to author (small, high-leverage)](#new-wps-to-author-small-high-leverage)
- [New WPs to author (large, primitives)](#new-wps-to-author-large-primitives)
- [Architectural decisions owed](#architectural-decisions-owed)
- [Out-of-scope deferred (gated)](#out-of-scope-deferred-gated)
- [Hygiene / process](#hygiene--process)
- [Documentation refresh](#documentation-refresh)
- [Tooling enhancements](#tooling-enhancements)

---

## User-only walkthroughs owed

These all sit at `human_review_status: pending` because only Joshua can flip them. Code is shipped; sign-off is the gate. Walkthroughs exist in the original aggregate dump (search `## Walkthrough` headings in session notes).

| WP                              | PRs        | Walkthrough exists |
| ------------------------------- | ---------- | ------------------ |
| cert-dashboard                  | #321       | Yes                |
| lens-ui                         | #323       | Yes                |
| goal-composer                   | #324       | Yes                |
| course-primitive                | —          | —                  |
| course-reader-and-editor        | —          | —                  |
| hangar-review-queue-cluster-fix | #740, #782 | Yes                |
| wp-notes-primitive              | —          | Yes (detailed)     |
| wp-flightbag-reader-ux          | —          | Yes (detailed)     |
| wp-flightbag-rich-reader        | —          | Yes (detailed)     |
| weather-comprehensive           | —          | Yes (detailed)     |
| wx-engine                       | many       | Yes (detailed)     |
| xc-viewer-v1                    | #829       | —                  |
| card-question-tier              | #855       | —                  |
| tracking-system-overhaul        | —          | Yes (90-min)       |
| V3.5 Library card surface       | #690+      | Yes                |

After each walk: `bun run wp set <slug> human-review signed-off`, then `bun run wp set <slug> status shipped` if not already.

---

## Real bugs + known issues

### Blocking / major

- **24 e2e failures flagged in NOW.md** — two root causes: Buffer hydration leak + Postgres crash on `hangar.docs_search_index`. Not investigated.
- **`bug-palette-fts-third-source`** (filed) — Palette FTS loader missing `study.course_step.body_md` as third source. Revisit after course-tree-arbitrary-depth WP stabilises.
- **`/library` Playwright smoke failure** — PR #951 retired the stale `library-by-cert.spec.ts` / `handbook-reader.spec.ts` / `handbook-amendment.spec.ts` specs and pins the redirect contract via `tests/e2e/library-redirects.spec.ts`. Smoke status post-PR #951 unverified; re-run the suite to confirm.
- **Flaky test at `libs/hangar-jobs/src/worker.test.ts:273`** — race on `hangar_job_log` row visibility under parallel load. Passes in isolation.

### Minor

- **Pin-to-today action** (detail pane) — disabled with clarified tooltip. Needs `mine.plan` "pin to today" API in `@ab/bc-study` which doesn't exist. Not yet filed as a bug.
- **Per-app missing palette routes** — 3 commands dropped honestly during Phase 4 palette work: sim "Start new sim" + "Resume last sim", hangar "New doc". Need ROUTE constants + handlers. Not yet filed.

### Hangar references migration tool

- **~~Knowledge citation migration script doesn't recognize AvWx (FAA-H-8083-28B)~~** → shipped as PR #946 (AvWx pattern in `HANDBOOK_PATTERNS`). Follow-up landed as PR #955 (parse chapter from `detail:` field so proposed rewrites pin the chapter, ADR-019). The 17-row review queue is now ready for human grind via `bun scripts/db/migrate-knowledge-citations.ts review` (see "Tooling enhancements" below).

---

## Small mechanical follow-ups

- **~~5 specless legacy WP directories~~ + ~~4 abandoned WPs~~** → shipped as PR #947 (archived 2 specless + 4 abandoned to `.archive/`). Resolved.
- **~~Deprecated `LIBRARY_*` route constants~~** → resolved 2026-05-14. 12 dead constants dropped (PR #976); the remaining 6 with live callers are scoped under WP [`flightbag-citation-url-migration`](../work-packages/flightbag-citation-url-migration/spec.md) (PR #979) — implementation deferred. Per CLAUDE.md "no legacy in airboss," not eligible for "@deprecated" lingering; tracked via WP instead.
- **WP 2 reader UX follow-ups** (flagged during agent work):
  - `<TOCRender mode="rail">` uses `onclickcapture` to intercept anchor clicks — worth refactoring
  - ACS subtree shared layout is chrome-only (area/task TOC has different shape)
  - Explicit `scrollIntoView({block:'nearest'})` on TOC active entry and `onnavigate` mobile auto-close not wired
- **~~`graph-index.md` auto-regen drift~~** — added to `.gitignore` + `git rm --cached` + sentinel banner updated to call out the git-ignored status. The file is purely derived (no build/runtime consumers) so the cleanest answer was to stop tracking it. Resolved.

---

## Phase 2 / continuation work

### card-question-tier WP

- **~~Phase 2: backfill ~245 cards~~** → shipped as PR #949 (inference-rule backfill for question_tier + source_authority + acs_codes). ~256 residue cards owed hand-classification; tool shipped as PR #954.
- **Phase 3: UI surfaces** — filter chips, FAA-vs-CFI side-by-side panel, ACS coverage lens, source-authority badges. Each is a separate follow-on WP per surface.
- **Hand-classification of question_tier for ~256 residue cards** — tool shipped as PR #954 (`classify-card-tier` interactive CLI). Run `bun scripts/db/classify-card-tier.ts` to grind through the queue; requires CFI judgement per card.

### Hangar /roadmap writebacks

- **Read-only /roadmap shipped as PR #700 (Phase 8 of tracking-system-overhaul).** Writebacks need a dedicated WP authored first — no `wp-hangar-roadmap-view` slug exists today. TOML-mirror writeback pattern from `libs/hangar-sync/` is the design path; not started. Promote to WP when ready (see "New WPs to author" below).

### Tracking system overhaul

- **~~Per-PR log auto-emission~~** → shipped as `bun run track ship-pr <pr>`. Wraps `gh pr merge --squash --delete-branch` + `bun run track log <pr>` in one step. Local-machine command rather than git hook (no CI to hook into; parsing the squash commit message in a `post-merge` hook is fragile). Manual fallback `bun run track log <pr>` still works after any other merge path.
- **Rolling-archive scheduled job** — `scripts/tracking/archive.ts` exists and is tested. Wiring into launchd scheduler deliberately deferred. Run manually with `bun run track archive --apply`.

### Command palette

- **~~Phase 5: Cmd+P quick-open with recents~~** → shipped as PR #942.
- **Phase 2 palette work re-running generator** — `bun scripts/generate-faa-doc-registry.ts` patched for code-vs-title fragmentation + length guard but never re-ran; emitted `faa-docs.ts` may not reflect patch.
- **~~REFERENCE_SOURCE_TYPES enum expansion~~** → shipped. `libs/constants/src/reference-tags.ts` now lists 24 source types (CFR, AIM, PCG, AC, ACS, PHAK, AFH, IFH, AVWX, IPH, RMH, AIH, HFH, GFH, BFH, POH, NTSB, GAJSC, AOPA, FAA_SAFETY, SOP, AUTHORED, DERIVED, SECTIONAL).
- **~~`expandSynonyms` flip from opt-in to default~~** → shipped. `libs/help/src/loaders/aviation-refs.ts` defaults `expandSynonyms: true`.
- **~~AIM not in palette registry~~** → shipped. `libs/help/src/loaders/aim-sections.ts` exists and is wired into `loaders/all.ts`.
- **Knowledge nodes, glossary terms, memory cards in palette** — knowledge nodes shipped via FTS in PR #936 (`fts-passages.ts` queries `study.knowledge_node.content_md`). Glossary terms + memory cards still not loaded. Partial.
- **~~External Tools list empty~~** → shipped. `libs/aviation/src/external-tools.ts` seeds 4 validated + 3 community (7 entries total).
- **Doc-picker empty-fragment behavior** (`FAA-H-` with no further chars) — Phase 3 ships alpha; recency-weighted later.

---

## New WPs to author (small, high-leverage)

- **Personal-minimums as typed contract** — discussed Q1.4 earlier; small high-leverage WP. Makes XC viewer + scenarios personal.
- **Calibration-as-first-class primitive** — instrument what SRS already collects (predicted vs actual confidence). Telemetry layer over existing data.
- **Hangar `/roadmap` writebacks** — promote to WP when ready (see Phase 2 section above).
- **Mock-test mode as session-config flag** — discussed Q4; decided NOT to build standalone quiz primitive. Implement as session-config flag over existing SRS.

---

## New WPs to author (large, primitives)

- **Decision-debrief replay primitive** — Q1.6; killer pedagogical loop on top of wx-engine + XC viewer.
- **Logbook ingestion** — once XC viewer works; "your last 5 flights overlay your personal mins" surface.
- **Encoded-text family lens** — METAR/TAF/PIREP/AIRMET/FB/NOTAM/ATIS skill ladder as a typed projection. Pedagogy structurally demonstrated in `wx-reading-metars-tafs`; not yet a lens.
- **Truth-aware scenario engines for other domains** — airspace/ATC/emergency/regulation/mountain-flying engines. wx-engine is one instance; pattern not generalized.
- **Mock-checkride / oral-exam mode** — listed but not built. Matters for CFI prep; punted intentionally for PPL focus.
- **`:::scenario` directive resolver** (course-reader-and-editor consumer WP) — wx-engine ships the data contract + bundles; the directive in `course/courses/weather-comprehensive/sections/s2-airmasses-fronts-stability.yaml` is a no-op placeholder until this lands. Documented in `docs/work-packages/wx-engine/CONSUMER-CONTRACT.md`.
- **`/library` subject cap revisit** — currently 3 subjects per ref for initial launch; revisit after live use (per memory).

---

## Architectural decisions owed

These need a Joshua decision before WP authoring makes sense.

- **ADR 024 entitlement primitive** — flagged from earlier multi-agent aggregate; cross-app session-cookie infra. Authenticated e2e tests for rich-reader parked behind this.
- **Credentials -> Quals full schema rename** — flagged; not actioned.
- **Lens vs flightbag merge** — flagged; not actioned.
- **Bun catalog adoption** — dep-hygiene plan said "revisit when Phase 4 lands." Phase 4 has landed. Catalogs let `vitest@^4.1.0` be defined once instead of 18 times. Not a regression; future polish.
- **Mastery thresholds** (evidence-kind-gating WP) — gates defined per evidence kind; numeric thresholds not tuned. Configuration work, not new-primitive work.

---

## Out-of-scope deferred (gated)

These have specific revisit triggers; don't build until trigger fires.

### xc-viewer-v1 (17 items)

IFR enroute charts; real sectional raster tiles; multi-region sectional library; real a/c POH ingest; live wx feed (rejected); editor UI (-> `xc-editor-v1`); TimedEvent / scenario perturbation engine (-> `xc-scenario-events`); plates rendering (gated on FAA AeroNav plate ingest); multi-leg routing optimization (rejected); 3D terrain; touch/mobile interactions (gated: desktop pre-flight first); +6 more in WP OOS doc.

### wx-engine (13 items)

S2 historical calibration (gated: real METAR archive ingest + "too synthetic" feel); S3 replay-with-perturbation (gated: S2 + scenario-overlay UX); real-time wx ingest (rejected); satellite chart derivations (gated: satellite pedagogy exercised); FIP/CIP/GTG gridded hazards; radar-mosaic chart derivation; LLM commentary (rejected — defeats killer feature); hangar map editor for scenario authoring (gated: TS literal authoring becomes bottleneck); Convective SIGMET / CWA derivation; multi-cycle TAF amendments (AMD/COR); multi-leg PIREP routing; real-terrain DEM; multi-scenario diff UI.

### Multi-agent aggregate (20260504, still un-actioned)

- §1 WP-HANDBOOK-RE-EXTRACTION-V2 follow-ups: 5 PRs queued (NOW.md update + 4 spec drafts for WP-AC-V2, WP-EXTRAS-RETIRE-FOLLOWUP, WP-TOC-VERIFY-TRIAGE, WP-HANGAR-REFS) — not authored.
- §2 Other deferred WPs (extract-provenance-and-signoff tasks/test-plan, library-completeness §6+ items) — not authored.
- §5 Manual smoke tests owed (WP 1 study, header/brand smoke, /credentials + /lens/handbook visual check, MVP step 8 six features) — user-only by design.
- §6 Header WP deferred-with-trigger items (cross-origin sign-in redirect, /preferences route, per-app HelpSearch ranking bias, real help content) — gated on triggers, not actioned.

---

## Hygiene / process

- **Multi-agent aggregate handoff** (`docs/work/handoffs/20260504-multi-agent-cleanup-aggregate.md`) — should archive to `.archive/handoffs/` once tracking-system-overhaul "closes" per its spec section 9. WP is at `agent_review_status: pending` / `human_review_status: pending` until walkthrough.
- **`.gitignore.local`** — appears in every status; untracked. Add to global gitignore or document as intentional dev-local file.
- **Orchestrator worktree at `/private/tmp/airboss-wx-orchestrator`** — owns main; recent sessions worked around it. Not "my" cleanup.
- **`bun install` before chasing workspace-resolution bugs.** When seeing a cascade of "Cannot find module" errors across workspaces (svelte-check, vitest, build), run `bun install` FIRST before chasing workspace-resolution bugs. PR #953 caught the false-alarm pattern: the symptoms looked like real workspace plumbing problems but were a stale install artifact.

---

## Documentation refresh

- **Knowledge node `Verify chapter` markers** (2 nodes) — `wx-data-sources`, `wx-equipment-and-data-limitations` flagged for ToC verification against FAA-H-8083-28B.
- **Glossary chart-type pattern extension** — `surface-analysis-chart` is the first chart-type glossary entry; pattern should extend to the other ~19 chart types (radar mosaic, METAR plot, TAF timeline, etc.).
- **Encoded-text family preamble retrofit completeness** — preamble added to ~6 product nodes during weather session; audit remaining encoded-text nodes for coverage.

---

## Tooling enhancements

- **Knowledge build warnings (intentional, but tracked)**:
  - `legacy-citation-shape × 200` — handed back to human per ADR 019 amendment; dry-run finds 0 auto-migratable rows.
  - `unresolved-edge × 11` — 11 graph edges across 3 nodes (`vfr-weather-minimums`, `crosswind-component`, `engine-failure-after-takeoff`) point at unauthored target nodes. Each is an author/drop decision per row.
- **Knowledge citation migration tool — review queue ready for human grind.** PR #955 (chapter parsing from `detail:` field) makes the 17-row review queue ready to walk. Run `bun scripts/db/migrate-knowledge-citations.ts review` to grind through; each row is a proposed rewrite pinning the chapter. Once cleared, broader sweep can run to clear the 200 legacy-citation-shape warnings.
- **`classify-card-tier` interactive CLI** — shipped as PR #954. Use `bun scripts/db/classify-card-tier.ts` to hand-classify the ~256 residue cards that fell through PR #949's inference-rule backfill. Requires CFI judgement per card.

---

## How to use this file

- **Pick from here** when starting a session and unsure what's next.
- **Add to here** at session end if items got punted.
- **Delete from here** when items ship (PR merged + walkthrough done for user-only items).
- **Promote from here** to a WP when an item earns work-package treatment per CLAUDE.md "When to use a work package" rules.
- Items are unordered within categories. Sequencing is a per-session call.

For session-scoped TODOs (today's work), use `docs/work/todos/YYYYMMDD-NN-TODO.md`. This file is for cross-session backlog.
