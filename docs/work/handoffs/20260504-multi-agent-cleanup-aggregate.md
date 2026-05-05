---
date: 2026-05-04
type: handoff-aggregate
source: salvaged from multiple agent session-end notes during branch cleanup
status: triage-needed
---

# Multi-agent cleanup aggregate (2026-05-04)

Consolidates the work items, deferred decisions, surfaced bugs, and "worth knowing" notes pulled out of several agent handoffs during a branches-and-worktrees cleanup pass. Nothing here has been re-verified against `main`. Treat each item as a claim that needs a quick check before acting.

## Verify before acting

- Some items below may already have shipped (check `git log --oneline -50` and `gh pr list --state merged --limit 30`).
- WP statuses have drifted in the past (frontmatter said shipped, `status.md` said not started). Trust `git log` over either.
- Stash `stash@{0}: tmp dirty` is owned by another agent. Do not drop without auditing.

## 1. WP-HANDBOOK-RE-EXTRACTION-V2 follow-up PRs (5 small doc-only PRs)

Substrate is shipped (14 PRs across phases 1D, 2, 3). Five doc-only PRs remain to close the loop and queue follow-ups.

### PR 1: `docs(now)` close + queue follow-ups (mechanical, do first)

Update `docs/work/NOW.md`:

- Move WP-HANDBOOK-RE-EXTRACTION-V2 from "in flight" to "Just shipped" with a one-paragraph summary. Reference: front-matter capture, empty-section policy, OCR-leak elision, `warnings.json` + `warnings-triage.json` contract, `getOpenWarningsForReference` BC reader. Aggregate Phase 2 numbers: 3309 -> 3345 sections, 1394 -> 1446 figures, 28 OCR-leak elisions (including the canonical IFH 2/5 phonetic-alphabet bug), 36 front-matter rows added, every fixable warning has a stable id.
- Add a "Deferred follow-ups" subsection naming three carve-outs: WP-AC-V2, WP-EXTRAS-RETIRE follow-up, toc-verify reclassification triage WP.
- Add WP-HANGAR-REFS to "next" since the data contract is in place.

PR title: `docs(now): close WP-HANDBOOK-RE-EXTRACTION-V2 + queue three follow-ups`.

### PR 2: WP-AC-V2 spec

Path: `docs/work-packages/wp-ac-v2/spec.md` (frontmatter `status: draft`).

- Port v2 emitter vocabulary into `libs/sources/src/ac/ingest.ts` (currently emits zero closed-vocab codes; `AcManifestFile.warnings` is wired but always empty after PR #636).
- Emitters that should fire on ACs: `figure-without-caption`, `caption-without-figure`, `table-cell-merge-ambiguity`, `tablish-block-not-converted`, `ocr-leak-in-section-body`, `empty-section-kept`, `empty-section-merged`. Front-matter capture probably does not apply (ACs are short), but spec the question explicitly.
- AC ingest is TS, not Python. Plan equivalent helpers in `libs/sources/src/ac/` (e.g. `ocr-leak.ts`, `empty-section.ts`).
- Stable warning IDs via the same `compute_warning_id` contract Phase 1A established.
- Sibling `warnings.json` already written by PR #636; just needs real entries.

Out of scope: front-matter capture (decide by inspecting an AC PDF); table-to-markdown conversion if AC tables are simple enough to render as-is.

Suggested phases:

- 1A: empty-section + OCR-leak detection ports.
- 1B: figure-pairing + table-conversion (port geometric pairing if AC PDFs have figures).
- 2: re-run ingest against the 9 ACs, commit derivative deltas. Target metric: every AC has the same warning surface as a handbook of similar size.
- 3: hand off to WP-HANGAR-REFS.

### PR 3: WP-EXTRAS-RETIRE follow-up spec

Path: `docs/work-packages/wp-extras-retire-followup/spec.md` (frontmatter `status: draft`).

Context: `tips-mountain-flying` (`faa-mtn-tips`) and other docs using `body_override` live in `scripts/sources/config/handbooks-extras.yaml`, not in `scripts/sources/config/handbooks/<slug>.yaml`. The chapter-aware Python pipeline does not touch them. `body_override` replaces extracted text with a hand-cleaned markdown file, but skips front-matter capture, OCR-leak elision, empty-section policy, and `warnings.json`.

Decide: does `body_override` need v2 substrate at all, or is the override file always hand-curated (so warnings are zero by definition)? Probably "no, the carve-out is permanent", but the spec needs to record the reasoning.

Anchors: read `scripts/sources/config/handbooks-extras.yaml` and `scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md` before writing.

### PR 4: WP-TOC-VERIFY-TRIAGE spec

Path: `docs/work-packages/wp-toc-verify-triage/spec.md` (frontmatter `status: draft`).

Context: PHAK ships 668 `toc-verify` warnings. Real signal but does not fit the fixable triage model (parser instrumentation, not extraction quality). Surfaced in the hangar dashboard via WP-HANGAR-REFS but not actionable through standard triage states.

Decide between:

(a) Tighter fingerprint match in `tools/handbook-ingest/ingest/sections_via_toc.py`.
(b) Fix the underlying TOC parser.
(c) Reclassify some as a different code that fits the fixable triage model.
(d) Accept as audit signal, surface separately in hangar dashboard, never count as fixable.

Probably (d) for now with (a) or (b) queued.

### PR 5: WP-HANGAR-REFS spec proper

Path: `docs/work-packages/wp-hangar-references-dashboard/spec.md` (currently a stub from PR #632).

Hangar admin UI for triaging warnings. Reads via `getOpenWarningsForReference` (`libs/bc/study/src/references.ts`). Writes `warnings-triage.json` (path: `validation/<corpus>/<doc_slug>/<edition>/warnings-triage.json`, schema: `handbookWarningsTriageFileSchema` in `libs/bc/study/src/manifest-validation.ts`).

**Scale matters.** Substrate produces 3414 fixable warnings across 7 handbooks, not the originally targeted <300. PR #621 retired that target. Design WP-HANGAR-REFS for 3000+ items: pagination, bulk operations, "wontfix-by-rule" patterns from day one.

Per-reference dashboard with: bulk + individual triage actions (open / wontfix / fixed / duplicate, optional note); filters by code / section / status / has-note; full-text search over `message[:200]` + `section_code`; stable warning IDs (16 hex chars) survive re-extraction.

Suggested phases: (1) read-only list view, (2) triage write actions, (3) bulk + filters + search, (4) stale-detection alerting.

Out of scope: modifying the upstream `warnings.json` producer; new warning codes (vocabulary closed in `libs/bc/study/src/manifest-validation.ts`).

### Sequencing

PR 1 first. PRs 2-5 are independent and can run in parallel worktrees. Each PR signed `Closes part of <WP-id>` for specs, plus the title above for PR 1. Squash-merge each via `gh pr merge --squash --delete-branch`.

## 2. Other deferred WP work

### Library-completeness §6+ authoring

Status (verify before authoring, frontmatter has lied here before):

| WP             | Dir          | Spec | Tasks | Test-plan | Status                                         |
| -------------- | ------------ | ---- | ----- | --------- | ---------------------------------------------- |
| WP-AC-V        | wp-ac/       | 129  | 58    | 40        | Shipped #480 (2026-05-02)                      |
| WP-ACS-V       | wp-acs-v/    | 95   | 68    | 55        | Shipped #501 (2026-05-03)                      |
| WP-CC          | wp-cc/       | 109  | -     | -         | spec only, status: draft                       |
| WP-NTSB-ALJ    | wp-ntsb-alj/ | 97   | -     | -         | spec only, frontmatter says shipped (suspect)  |
| WP-SAFO+INFO   | wp-safo-info/| 123  | -     | -         | spec only, frontmatter says shipped (suspect)  |
| WP-AC-FULL     | -            | -    | -     | -         | not started; depends on WP-AC-V (unblocked)    |
| WP-O8900-V5    | -            | -    | -     | -         | deferred per spec §4.E                         |
| WP-SAFETY-BRIEF| -            | -    | -     | -         | deferred per spec §5                           |

Easy first step: reconcile WP-NTSB-ALJ + WP-SAFO-INFO frontmatter vs `status.md`. Then either fill tasks/test-plan for the three half-authored WPs or author WP-AC-FULL from scratch (probably the "natural next easy win", AC pipeline already proven).

### Other unauthored WPs

- **extract-provenance-and-signoff** tasks/test-plan/design (spec ratified PR #600; needs ~400-500 lines).
- **PR #443's 8 stub WPs:** wp-hangar-ui-primitives, wp-hangar-destructive-confirm, wp-hangar-jobs-tests, wp-hangar-e2e, wp-hangar-list-projections, wp-aviation-count-helpers, wp-hangar-sync-semantic-diff, wp-hangar-runtime-probe (wp-hangar-package-cycle shipped via #435).

### WP 2 + WP 3 spec-complete on main, never built

- `docs/work-packages/flight-evidence-and-cfi-feedback/`
- `docs/work-packages/node-render-modes/`

Contract pre-pass (PR #622) shipped shared user-pref keys + routes both WPs need. Substrate is ready; held off pending green light.

Note: spec/design/tasks/test-plan/user-stories for these two WPs landed inside the WP 1 squash commit (#617 -> `d871c00d`), so `git log` will misattribute them to that commit. Not a blocker.

## 3. Deferred design decisions

### ADR 024 entitlement primitive

`requireEntitlement(event, 'flightbag:read')` does not exist in `libs/auth` yet. Phase 6 of the book experience (#608) ships with `requireUser` + an inline TODO. Three follow-up tasks when someone builds it:

- `identity.entitlement` table migration.
- `requireEntitlement` helper.
- Default-grant bundles for new users on registration.

Then update flightbag's heartbeat endpoint + section page guard from `requireAuth` to `requireEntitlement(event, 'flightbag:read')`.

### Credentials -> Quals full schema rename

UI relabel shipped. DB tables, route paths, type names, function names still use `credential`. ~217 files of churn if the user wants full alignment. Open question, no urgency.

### Lens vs flightbag merge

Options 1 + 2 (clarification) shipped. Option 3 (fold flightbag's reader into lens) breaks flightbag's deep-link contract per ADR-019. Bigger architectural call, explicitly deferred.

### Empty-section default policy

157 `empty-section-kept` warnings on IFH alone. If 80% of them should have been `merge_upward`, the empty-section default policy is wrong and 1D's YAML-per-doc opt-in burden is too high. Worth scanning a sample before WP-AC-V2 commits to the same default. Future tweak might invert the default.

## 4. Real bugs surfaced, not yet fixed

Each warrants its own WP.

- **AC URL helper drift** (`libs/sources/src/url-for-reference.ts:urlForAc`): `urlForReference('airboss-ref:ac/91-21-1/d/section-1')` produces `/ac/91-21.1/d/1` (stray dot). Citation chips for AC sections currently 404. Representative-pages spec does not generate AC tests because of this.
- **ACS slug-shape mismatch:** `ACS_PUBLICATION_SLUGS` ships `ir-airplane-8c` but `study.reference.document_slug` stores `ir-airplane-acs-8c`. URL builder + route disagree; ACS citation chips 404.
- **Flightbag SSR crash on parallel handbook section requests:** `ReadableStream is already closed` in figure streaming. Reproducible via the new representative-pages spec when it hits N handbook URLs concurrently. Single requests work fine.
- **Worker test residual flake** (`libs/hangar-jobs/src/worker.test.ts`): "serialises two same-targetId jobs" flakes ~1 in 4 full-suite runs even with the 30s timeout bump. Root cause is DB contention on the claim-loop. Mitigation shipped; real fix is a separate WP if it bites in CI.
- **`/library/handbook/afh/1/1.1` URL contract:** link generator at `/lens/handbook/afh/1` is fixed, but the literal full-dotted URL is still invalid by URL contract. Separate change to the section loader if hand-typed full-dotted URLs should also work. No link in the codebase emits this shape.

### Validate warnings (non-blocking)

- 1 TBD-id wiki-link in `knowledge-graph.ts`.
- 4 orphan help pages (first: goals).
- 4 orphan references.

## 5. Manual smoke tests owed (user-only)

Only the user can do these.

### WP 1 (study) test plan

PR #617 shipped without the 39-scenario `test-plan.md` walkthrough. If anything on `/study` is broken, start there.

### App header / brand smoke (sim, avionics, flightbag, study)

- Brand renders correctly: tiny "airboss" pretitle on top, big ALL-CAPS app name below, anchored hard-left.
- Right cluster: Help -> Help search -> Flightbag (except on flightbag itself) -> ☀/☾/◐ toggle -> Account ▾ (or "Sign in" when logged-out).
- Account menu: identity row, ThemePicker, Sign out (no Preferences yet, no app passes the prop).
- Appearance toggle cycles light -> dark -> system -> light.
- Flightbag has a working theme/appearance flow (was bare before).
- Sim/avionics auth banner appears below the header for logged-out users.
- `/help` on sim/avionics/flightbag shows placeholder with cross-link to study.

### `/credentials` + `/lens/handbook` visual check

Live `/credentials` (Quals + InfoTip popover) and `/lens/handbook` (new heading + Flightbag link) never visually verified. String swaps + one InfoTip + one cross-origin link, low risk, but only the user can confirm layout.

### MVP manual test passes (Build Order step 8)

Six features still need user-zero walkthrough.

## 6. Header WP follow-ups (deferred with explicit triggers)

From PR #620 / `docs/work/todos/20260504-02-TODO.md`:

- Cross-origin sign-in redirect (trigger: ADR 024 cross-app auth).
- `/preferences` route (trigger: account-settings WP).
- Per-app HelpSearch ranking bias (trigger: sim/avionics author real help).
- Real help content for sim/avionics/flightbag (trigger: when those apps need docs).

## 7. IDEAS funnel

`docs/platform/IDEAS.md` rich-reader feature suite captured 2026-05-03. Eight subsystems, read tracking shipped via Phase 6, other 7 future. Auth surface for read state resolved by ADR 024, so several rich-reader subsystems are unblocked. Awaits next 2-week IDEAS review cycle.

## 8. Housekeeping (FYI, not bugs)

- **`stash@{0}: tmp dirty`** (IDEAS.md + NOW.md edits) owned by another agent. Stashes are shared across worktrees. Audit before dropping.
- **4 dirty files in main worktree** are another agent's in-flight work (skeleton aviation entries, lens handbook chapter route slice fix at `apps/study/src/routes/(app)/lens/handbook/[doc]/[chapter]/+page.svelte:42-51`). Untouched.
- **`/tmp/airboss-aborted-merge-snapshot/`** forensic snapshot from the half-merged hangar-review-queue state. Self-resolved (PR #611, #633, #634 shipped). Lens-edit patch superseded by PR #616. Safe to `rm -rf` whenever.
- **`feat/wp-study-home-arc-docs`** restored from reflog earlier in session and pushed to origin. Unmerged on origin with `feat/study-home-impl` and `feat/study-home-impl-finish` extending it. Other agents own follow-ups. Coordinate merge sequence.
- **handbook-ingest pytest suite** has 4 pre-existing failures in `test_fetch_atomicity.py` and `test_handbooks_registry.py`. Worth a triage pass eventually.
- **`Button.svelte:154`** pre-existing theme-lint violation (raw `0.8s` instead of `var(--motion-fast)`).
- **9 worktrees in `.claude/worktrees/`** carry in-progress work from other agents. Run `/audit-worktrees` for a structured report.

## 9. Tooling quirks worth knowing

- **`bun install` state can silently degrade between sessions.** Empty `node_modules/` (workspace symlinks missing) causes `Cannot find module '@ab/constants'`. Fix is `bun install`, not file edits.
- **`/qs` skill quirk:** chained `gh pr merge --squash` (without a PR number) at the end of a fast-chain does not work because the fast-chain returns to the shared branch before the merge call, so `gh` cannot infer the PR. Workaround: pass PR number explicitly.
- **Branch-pivot pattern:** with multiple agents sharing the main worktree, the active branch can change mid-session without a checkout. The `qs` skill's snapshot-and-restore + fast-chain handles it, but do not rely on "current branch is stable across a session."

## Suggested execution order

1. **Verify what already shipped.** `git log --oneline -50`, `gh pr list --state merged --limit 30`, then strike anything done from this doc.
2. **Resolve frontmatter drift** on WP-NTSB-ALJ + WP-SAFO-INFO (10 min).
3. **PR 1** of section 1 (NOW.md update).
4. **PRs 2-5** of section 1 in parallel worktrees.
5. **WP-AC-FULL** spec (likely the next "easy win" for library-completeness).
6. Bug WPs from section 4, scoped one-by-one.
7. User-only smoke tests from section 5.
