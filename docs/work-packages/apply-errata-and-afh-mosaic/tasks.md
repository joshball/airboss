---
title: 'Tasks: Apply Errata and AFH MOSAIC'
product: study
feature: apply-errata-and-afh-mosaic
type: tasks
status: unread
---

# Tasks: Apply Errata and AFH MOSAIC

Phased plan. Each phase ends with `bun run check` clean and a commit.

## Phase status (2026-04-28 build)

- R1: shipped (`refactor(handbook-ingest): introduce HandbookPlugin registry`)
- R2: shipped (`feat(handbook-ingest): additive-paragraph errata parser + YAML errata list`)
- R3: shipped (`feat(study/schema): handbook_section_errata table + BC functions`)
- R4: shipped (`feat(handbook-ingest): apply-errata pipeline (--apply-errata + --reapply-errata)`)
- R5: AFH portion shipped (`feat(content/afh): apply MOSAIC addendum`); PHAK portion deferred (different layout requires a new `bullet-edits` parser archetype, captured in IDEAS.md and PHAK YAML comment)
- R6: shipped (reader UI: AmendmentPanel + ErrataEntry + LCS word-diff utility wired into +page.svelte; e2e spec authored and `.skip()` until the e2e seed inserts errata rows -- see R6 task block).
- R7: deferred (discovery: 17-handbook catalogue, scrape, GH issue, launchd cron, dispatcher banner)
- R8: ADR 020 amendment shipped; IDEAS.md follow-ups captured; hangar PRD update covered via IDEAS.md (hangar PRD dormant per project memory)
- R9: deferred (full test-plan walk + ball-review-full + PR follow-up review)

A follow-up PR will pick up R5 PHAK portion, R6, R7, and R9.

## Pre-flight

- [ ] Read [spec.md](spec.md) end-to-end.
- [ ] Read [design.md](design.md) end-to-end.
- [ ] Read [research/errata-discovery.md](research/errata-discovery.md) — the discovery design rests on it.
- [ ] Read [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md) and [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md).
- [ ] Read existing files the WP modifies:
  - `tools/handbook-ingest/ingest/cli.py`
  - `tools/handbook-ingest/ingest/normalize.py`
  - `tools/handbook-ingest/ingest/sections.py`
  - `tools/handbook-ingest/ingest/config_loader.py`
  - `tools/handbook-ingest/ingest/config/{phak,afh,avwx}.yaml`
  - `scripts/sources.ts`
  - `scripts/sources/download/index.ts`
  - `libs/bc/study/src/schema.ts`
  - `apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.svelte`
  - `apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.server.ts`
  - `apps/study/src/hooks.server.ts`
- [ ] Confirm cached MOSAIC PDFs exist:
  - `~/Documents/airboss-handbook-cache/handbooks/afh/FAA-H-8083-3C/AFH_Addendum_MOSAIC.pdf`
  - `~/Documents/airboss-handbook-cache/handbooks/phak/FAA-H-8083-25C/PHAK_Addendum_MOSAIC.pdf` (download if missing)
- [ ] Confirm Python venv: `tools/handbook-ingest/.venv/` exists with `pip install -e '.[dev]'` applied.
- [ ] Read [research/errata-discovery.md](research/errata-discovery.md) Section F to confirm the gating decisions match what's in spec.md "Open questions resolved during scoping."

## Phase R1: Per-handbook plugin registry refactor

Lands first. Zero behavior change. Subsequent phases consume the new shape.

### 1. Plugin scaffolding

- [ ] Create `tools/handbook-ingest/ingest/handbooks/__init__.py` with empty `REGISTRY` dict and `get_handbook` / `UnknownHandbookError`.
- [ ] Create `tools/handbook-ingest/ingest/handbooks/base.py` with `HandbookPlugin` ABC, `ErrataPatch` and `ErrataConfig` dataclasses (no errata logic yet; placeholder methods).
- [ ] Create `tools/handbook-ingest/ingest/handbooks/phak.py` — `PhakHandbook(HandbookPlugin)` with stub methods returning current behavior (no quirks moved yet).
- [ ] Create `tools/handbook-ingest/ingest/handbooks/afh.py` — `AfhHandbook(HandbookPlugin)`.
- [ ] Create `tools/handbook-ingest/ingest/handbooks/avwx.py` — `AvwxHandbook(HandbookPlugin)`.
- [ ] Wire `REGISTRY` in `__init__.py`.
- [ ] Run `cd tools/handbook-ingest && source .venv/bin/activate && python -m pytest` — all existing tests pass.
- [ ] Commit: `refactor(handbook-ingest): introduce HandbookPlugin registry scaffolding`

### 2. Migrate quirks into plugins

- [ ] Audit `normalize.py` for any conditional that branches by handbook semantics. Move logic into the plugin's `body_quirks_pre/post` hooks. Engine code calls plugin methods.
- [ ] Audit `sections.py` for handbook-specific page-label resolution. Move logic into plugin if present.
- [ ] `cli.py`: replace any direct slug references with `get_handbook(slug)` calls.
- [ ] Run `bun run sources extract handbooks phak --edition FAA-H-8083-25C --dry-run` — output matches pre-refactor (snapshot a manifest.json before refactor; diff after).
- [ ] Same for `afh` and `avwx`.
- [ ] Run `bun run check` — 0 errors.
- [ ] Commit: `refactor(handbook-ingest): route per-handbook quirks through plugins`

## Phase R2: Errata parser foundation

### 3. Parser scaffolding

- [ ] Create `tools/handbook-ingest/ingest/errata_parsers/__init__.py` with `PARSERS` registry and `get_parser`.
- [ ] Create `tools/handbook-ingest/ingest/errata_parsers/base.py` with `ErrataParser` ABC and `UnknownErrataLayoutError`.
- [ ] Create `tools/handbook-ingest/ingest/errata_parsers/additive_paragraph.py` — implements MOSAIC layout. Recognizes the markers: "In Chapter N: <Title>, the following <subsection|paragraph> will be added to the <Section> section on page <X-Y>: <new content>".
- [ ] Unit tests for `AdditiveParagraphParser`: build a synthetic PDF (or fixture from cached AFH MOSAIC) and assert parsed `ErrataPatch` list matches expected.
- [ ] Run `pytest tools/handbook-ingest/tests/errata_parsers/`.
- [ ] Commit: `feat(handbook-ingest): additive-paragraph errata parser`

### 4. YAML config extension

- [ ] Update `config_loader.py` to read the new `errata:` list. Keep backward compat: comment-only YAML still loads (empty `errata` list).
- [ ] Add structured `errata:` list to `tools/handbook-ingest/ingest/config/afh.yaml` for MOSAIC.
- [ ] Add structured `errata:` list to `tools/handbook-ingest/ingest/config/phak.yaml` for MOSAIC (URL: `https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/PHAK_Addendum_(MOSAIC).pdf`).
- [ ] `avwx.yaml`: leave `errata: []` for now; AvWX has no published errata.
- [ ] Unit test: `config_loader` round-trips the new `errata` field.
- [ ] Commit: `feat(handbook-ingest): structured errata list in YAML config`

## Phase R3: Schema and migration

### 5. Drizzle schema

- [ ] Add `handbookSectionErrata` table to `libs/bc/study/src/schema.ts` per [design.md](design.md) Schema section.
- [ ] Run `bun run db:generate`. Review the generated SQL in `drizzle/0003_*.sql`.
- [ ] Run `bun run db:migrate`. Confirm table exists in dev DB.
- [ ] Run `bun run check` — 0 errors.
- [ ] Commit: `feat(study/schema): handbook_section_errata table`

### 6. BC functions

- [ ] Create `libs/bc/study/src/handbooks-errata.ts` with: `listErrataForSection`, `hasErrata`, `formatErrataForDisplay`. Export from `libs/bc/study/src/index.ts`.
- [ ] Add error class `ErrataNotFoundError` if not present.
- [ ] Unit tests in `libs/bc/study/src/handbooks-errata.test.ts`. Seed a test section with two errata; assert ordering, formatting, FK cascade on section delete.
- [ ] Run `bun run check` — 0 errors.
- [ ] Commit: `feat(bc/study): handbook errata BC functions`

## Phase R4: Apply-errata pipeline

### 7. CLI command and orchestration

- [ ] Add `--apply-errata <id>` and `--reapply-errata` flags to `cli.py`. Reject if id is not in YAML; require explicit id (no URL acceptance).
- [ ] Implement orchestration: download (cache-aware), record SHA in manifest, dispatch to plugin's `parse_errata`, apply patches to source markdown, regenerate section content_md, write per-section `<section>.errata.md` notes, update manifest.json.
- [ ] Implement transaction boundary: all DB writes for one erratum apply in a single transaction. Either every section gets its row + content updated, or nothing changes.
- [ ] `--force` flag: deletes existing `handbook_section_errata` rows for the erratum (by `errata_id`), then re-applies.
- [ ] Idempotency: a second invocation without `--force` exits 0 with a "already applied at <ts>" message.
- [ ] Run `bun run check` — 0 errors.
- [ ] Commit: `feat(handbook-ingest): --apply-errata pipeline`

### 8. Re-seed integration

- [ ] Update `scripts/db/seed-handbooks.ts` (or wherever handbook seed lives) to: (a) read `manifest.json -> errata[]`, (b) populate `handbook_section_errata` rows from per-section errata notes when seeding fresh.
- [ ] Verify content_hash recomputation: `handbook_section.content_hash` reflects post-errata text.
- [ ] Run a full re-seed and verify Abby's account sees post-errata text in the affected sections.
- [ ] Commit: `feat(seed): handbook_section_errata seed integration`

## Phase R5: Apply MOSAIC to AFH and PHAK

### 9. AFH MOSAIC

- [ ] Run `bun run sources extract handbooks afh --apply-errata mosaic`.
- [ ] Manually verify per-section markdown for one patched section (e.g., Chapter 2 Preflight Assessment of the Aircraft).
- [ ] Visually verify in the reader app: navigate to the patched section, confirm post-errata text is rendered.
- [ ] Commit: `feat(content/afh): apply MOSAIC addendum`. Includes regenerated section markdown, per-section errata notes, manifest.json updates, db migration if any.

### 10. PHAK MOSAIC

- [ ] Download PHAK MOSAIC PDF if not already cached: `bun run sources download` should pull it once YAML is in place.
- [ ] Run `bun run sources extract handbooks phak --apply-errata mosaic`.
- [ ] Manually verify per-section markdown for one patched section.
- [ ] Visual verification in reader.
- [ ] Commit: `feat(content/phak): apply MOSAIC addendum`.

## Phase R6: Reader UI (amendment badge + diff panel)

### 11. AmendmentPanel component

- [x] Create `libs/ui/src/handbooks/AmendmentPanel.svelte` and `ErrataEntry.svelte` per [design.md](design.md) Component structure. Files live under `handbooks/` (plural, matching the existing project convention) rather than `handbook/`.
- [x] Diff utility: added `libs/utils/src/text-diff.ts` (LCS word diff, no new deps) plus unit tests.
- [x] Style with existing handbook tokens. No new tokens introduced.
- [ ] Storybook entry if Storybook is wired up; otherwise a small dev-only test page under `apps/study/src/routes/dev/`. Deferred -- Storybook is not wired in airboss; the vitest component tests cover the rendering contract.
- [x] Run `bun run check` on the changed files -- 0 errors introduced. (Workspace `bun run check` carries pre-existing errors unrelated to this work.)
- [x] Commit: `feat(ui/handbooks): ErrataEntry component` + `feat(ui/handbooks): AmendmentPanel component`.

### 12. Wire into reader

- [x] `apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.server.ts`: loads errata via `listErrataForSection` -> `formatErrataForDisplay`. Passes `data.errata` to the page.
- [x] `+page.svelte`: mounts `AmendmentPanel` in the section header. The component renders nothing for an empty list, so no conditional in the page template.
- [ ] Visual verification in reader for one AFH section + one PHAK section. Pending: blocked on the e2e seed gap below; the manual test surfaces once `bun db seed --apply-errata` runs against the dev DB.
- [x] Commit: `feat(study/reader): mount AmendmentPanel for sections with applied errata`.

### 12a. E2e spec + seed wiring

- [x] Author `tests/e2e/handbook-amendment.spec.ts` with the badge -> click -> FAA source URL contract. Currently `.skip()` because the e2e seed (`tests/e2e/global.setup.ts` + the dev-seed dump) does not insert `study.handbook_section_errata` rows.
- [ ] Wire errata fixtures into the e2e seed. Two viable paths:
  1. Extend `tests/e2e/global.setup.ts` to call `insertErrataRows` against the seeded section ids using parsed `.errata.md` fixtures under `handbooks/afh/.../*.errata.md`.
  2. Re-run `bun run sources extract handbooks afh --apply-errata mosaic` against the dev-seed database before the Playwright dump is captured.
- [ ] Once the seed inserts errata rows, drop the `.skip()` calls in `handbook-amendment.spec.ts`. The contract is fixed; the unskip is one line.

## Phase R7: Discovery

### 13. Source-byte coverage extension

- [ ] Author `scripts/sources/download/handbooks-catalogue.ts` listing all 17 FAA aviation handbooks with current edition + parent page URL. Citations in code comments to faa.gov pages used for the catalogue.
- [ ] Extend `scripts/sources/download/handbooks.ts` (or add new module) to fetch source PDFs for all 17 handbooks via HEAD-cached download.
- [ ] Extend to also download known errata listed in YAML configs.
- [ ] Run `bun run sources download` — verify cache populates.
- [ ] Commit: `feat(sources/download): all 17 handbook source PDFs + known errata`

### 14. Discovery scan

- [ ] Create `scripts/sources/discover/index.ts` with `runDiscoverErrata`.
- [ ] Add `discover-errata` subcommand to `scripts/sources.ts` dispatcher.
- [ ] Add per-handbook plugin Python helpers exposed via subprocess JSON (`python -m ingest.handbooks.discovery_url <slug>` and `python -m ingest.handbooks.link_patterns <slug>`).
- [ ] Implement scrape: fetch parent page, regex-extract candidate URLs, diff against `<cache>/discovery/handbooks/<doc>.json`.
- [ ] Implement state file write + `_pending.md` write + `_last_run.json` update.
- [ ] Implement `actionable` vs `signal-only` flag based on plugin registry membership.
- [ ] Run `bun run sources discover-errata` — verify state files created and a synthetic candidate is detected when YAML drops a known erratum.
- [ ] Commit: `feat(sources/discover): handbook errata discovery scan`

### 15. GitHub issue auto-open

- [ ] Add issue creation logic to `scripts/sources/discover/github.ts`. Skip silently when `GH_TOKEN` not set.
- [ ] Idempotent: existing issue with the same candidate URL set gets updated, not duplicated. Match by issue label `errata` + body fingerprint.
- [ ] Test: dry-run mode (`--dry-run` flag) prints what would happen without calling the API.
- [ ] Commit: `feat(sources/discover): auto-open GitHub issue for new errata candidates`

### 16. Triggers

- [ ] Add startup hook in `apps/study/src/hooks.server.ts` per [design.md](design.md) "Server startup hook." Non-blocking, freshness-gated.
- [ ] Extend `bun run sources download` to fire `discover-errata` as a side effect (still freshness-gated).
- [ ] Author `scripts/setup-discovery-cron.sh` — opt-in launchd plist installer.
- [ ] Document the three triggers in `docs/devops/discovery.md` (new short doc).
- [ ] Commit: `feat(sources/discover): triggers (startup, download, weekly cron)`

### 17. Dispatcher banner

- [ ] When `bun run sources` runs any command, print a banner if `<cache>/discovery/_pending.md` has unreviewed items: `[!] N unreviewed errata candidates. Run 'bun run sources discover-errata --review' to triage.`
- [ ] Banner suppressible via `AIRBOSS_QUIET=1`.
- [ ] Commit: `feat(sources): dispatcher banner for unreviewed errata`

## Phase R8: ADR 020 amendment + docs

### 18. ADR 020 Revisions section

- [ ] Edit `docs/decisions/020-handbook-edition-and-amendment-policy.md` to add a "Revisions" section at the bottom dated 2026-04-28 per [spec.md](spec.md) ADR amendment subsection.
- [ ] Tighten line 44 wording to clarify cumulative vs incremental: "Errata may be **incremental** (each new sheet adds different content; addendum B does not re-state addendum A) or **cumulative** (the latest sheet supersedes earlier sheets for the same edition). Both occur in FAA practice."
- [ ] Update any cross-references in the ADR that depended on the old wording.
- [ ] Commit: `docs(adr-020): clarify cumulative vs incremental errata`

### 19. Future hangar surface notes

- [ ] In each new CLI command's help text and code comment, add a line: `# Future: hangar UI wraps this command via dispatcher.` Keeps the path forward documented.
- [ ] Update `docs/products/hangar/PRD.md` (if it exists) with a section "Errata management UI (future)" pointing at this WP and its CLI surfaces.
- [ ] If `docs/products/hangar/` doesn't exist or the relevant PRD section is dormant, capture as a row in `docs/platform/IDEAS.md` instead.
- [ ] Commit: `docs(hangar): note future UI for errata discovery and apply`

## Phase R9: Testing and verification

### 20. Test plan execution

- [ ] Walk [test-plan.md](test-plan.md) end-to-end. Every numbered scenario passes.
- [ ] Address any failures by patching the failing layer; re-run that scenario plus the surrounding ones.

### 21. `/ball-review-full`

- [ ] Run a full 10-axis review on the branch.
- [ ] Apply every finding (no menu-picking).
- [ ] Re-run `bun run check` and the test plan after the fixer.

### 22. PR

- [ ] Push the branch.
- [ ] Open a PR via `gh pr create`. Title: `feat: apply-errata flow + AFH and PHAK MOSAIC + discovery surface`.
- [ ] PR body: link to spec, summary of phases shipped, screenshots of the AmendmentPanel for one AFH section + one PHAK section, list of MOSAIC sections patched, link to the regenerated `manifest.json`.

## Post-implementation

- [ ] Update `docs/work/NOW.md` to mark this WP shipped.
- [ ] Update `docs/products/study/{ROADMAP,TASKS}.md` to reflect post-MOSAIC state.
- [ ] Capture follow-ups in `docs/platform/IDEAS.md`:
  - Apply auto-apply gate when 3 distinct addendum layouts are proven.
  - Onboard W&B / WSC / PPC handbooks (their MOSAIC addenda are signal-only until then).
  - Section-level "what changed since I last read this?" notification surface.
  - Hangar UI for discovery review and apply orchestration.
- [ ] Run `audit-worktrees` and clean up any dangling worktrees from this WP's authoring sessions.
