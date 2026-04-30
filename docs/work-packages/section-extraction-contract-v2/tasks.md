---
title: 'Tasks: Section extraction contract v2'
product: platform
feature: section-extraction-contract-v2
type: tasks
status: unread
review_status: pending
---

# Tasks: Section extraction contract v2

Implementation breakdown of [spec.md](spec.md). Phased; each phase is a
reviewable unit. Phase 1 ships the truncation fix on its own (smallest
viable change; unblocks correct testing of later phases). Phase 2 ships
the contract rewrite. Phase 3 ships the mutual-reviewer framing
(disagreements + TOC checklist). Phase 4 is the re-run + replacement.

## Phase 1 -- Truncation fix (shipped: PRs #332, #335)

Single-commit change. Targets the `chapter_text_max_chars` cap.

- [x] Measure uncapped chapter plaintext sizes per handbook.
- [x] Set `chapter_text_max_chars` per handbook to `max(longest_chapter) * 1.2` rounded up to next 25K.
- [x] YAML annotation comment names the chapter that drove each cap value.
- [x] Verified every chapter's `_chapter_plaintext.txt` below cap post-fix.
- [x] Bonus from PR #335: removed `DEFAULT_CHAPTER_TEXT_MAX_CHARS = 60000` silent default; cap is now required for any handbook in `prompt` mode.

## Phase 2 -- Contract rewrite (shipped: PR #342, amended in PR #355)

Touched:

- `tools/handbook-ingest/ingest/prompts/section_tree.md`
- `tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md`
- `tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md`
- `tools/handbook-ingest/tests/test_section_tree.py` (no changes needed; existing tests cover v2 shape)
- `tools/handbook-ingest/ingest/sections_via_sidecar.py` (already v2-compatible at #342 time)

Tasks:

- [x] `section_tree.md` carries v2 entry shape (`level`, `title`, `page_anchor`, `line_offset`, `parent_title`). Note: `ordinal` from the spec became `line_offset` in the live contract -- different name, same role (deterministic ordering hint).
- [x] Coverage assertion in contract + parameters error return line.
- [x] Boilerplate rule (Introduction, Chapter Summary as L1).
- [x] Hierarchy preference rule (body > printed TOC).
- [x] Difficult-cases catalog.
- [x] `chapter.md` references contract version + adds explicit coverage self-check step.
- [x] Loader (`sections_via_sidecar.py`) accepts v2 shape (was already v2-compatible; no changes were needed).
- [x] `CONTRACT VERSION: 2` field added; bumped to `3` in PR #355.
- [x] `bun run check` clean; pytest 123 passing.

## Phase 3 -- Mutual-reviewer framing (TOC checklist + disagreements) -- DEFERRED, decision pending

**Status:** deferred pending review of the PR #355 compare report. Phase 4 ran without Phase 3 (per the data-driven scoping decision documented in spec §"Coordination"). Re-evaluate after reading the report.

**Decision criteria** (read the PR #355 compare report against these):

- If the report shows the LLM and TOC parser already agree on most entries (low "TOC only" + low "LLM only" + low level/parent mismatch), Phase 3's TOC-checklist machinery has marginal value. **Defer Phase 3** with a documented trigger (e.g. "open Phase 3 when the next handbook surfaces > N% disagreement" or "open Phase 3 if a section-tree consumer needs structured disagreement metadata").
- If the report shows systematic disagreement (TOC over-flattening across many chapters, LLM-only finds that look like real headings, hierarchy mismatches the LLM got right) AND that disagreement would be valuable as feedback to the deterministic TOC parser, **ship Phase 3** as planned below.

**If Phase 3 is greenlit, the planned work is:**

Touches:

- `tools/handbook-ingest/ingest/prompt_emit.py` (new placeholders)
- `tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md` (use placeholders)
- `tools/handbook-ingest/ingest/sections_via_toc.py` (export per-chapter checklist data)
- `tools/handbook-ingest/ingest/sections_compare.py` (read disagreements; render report section)
- `tools/handbook-ingest/ingest/prompts/section_tree.md` (disagreements schema + file location -- already drafted in spec.md)

Tasks (frozen scope; revisit after the compare-report decision):

- [ ] Extract a `to_checklist_for_chapter(chapter_ord)` helper from `sections_via_toc.py` that returns the TOC parser's per-chapter section list as a markdown list, ready to substitute into a prompt.
- [ ] Add `{toc_checklist}` and `{handbook_hints}` placeholders to `chapter.md`.
- [ ] Update `prompt_emit.py` to render TOC checklist per chapter and substitute into each prompt.
- [ ] Add `extraction_hints:` schema to YAML config loader; pass through to prompt-emit.
- [ ] Define `_llm_disagreements.json` schema in `section_tree.md` (separate file, NOT embedded in section-tree JSON).
- [ ] Update sub-agent return contract: success status line includes disagreement count.
- [ ] Update `sections_compare.py` to read disagreements; render new report section.
- [ ] Add a coverage section to the compare report: per chapter, sidecar size vs cap, last entry anchor vs last page.
- [ ] Add tests for the disagreements loader and the compare report renderer.
- [ ] Run pytest; confirm clean.

## Phase 4 -- Re-run phak end-to-end (acceptance test for phases 1-3)

Tasks:

- [x] Run `bun run sources extract handbooks phak --strategy prompt --force`. Verify the emitted `out/01-introduction-to-flying.md` includes the new placeholders.
- [x] Open a fresh Claude Code session. Paste `out/_run.md`. Wait for all 17 sub-agents to complete.
- [x] Verify each chapter's `_llm_section_tree.json` matches v2 shape. (Disagreements file deferred -- Phase 3 TOC-as-checklist not yet implemented.)
- [x] Run `bun run sources extract handbooks phak --strategy compare`. Read the new report.
- [x] Verify ch 7 has 80+ entries (got 89); verify all chapters have `page_anchor` populated; verify Coverage section is green.
- [x] Replace existing `_llm_section_tree.json` files in `handbooks/phak/FAA-H-8083-25C/<NN>/` with output. Stage by name. Commit. (PR #355.)

### Phase 4 amendments (v2 -> v3)

The phak re-run forced two contract amendments shipped alongside it. See spec §12 for the full rationale; tasks below capture the work.

- [x] Amend coverage self-check to tolerate trailing figure-only / caption-only / blank pages. Source: `tools/handbook-ingest/ingest/prompts/section_tree.md`.
- [x] Amend level definitions with explicit cap at 3 + flatten-by-example guidance. Source: same file.
- [x] Bump `CONTRACT VERSION:` to 3 and update the chapter prompt template to reference `3`.
- [x] Patch the live emitted prompts under `prompts-out/phak/FAA-H-8083-25C/out/` so the in-flight run picks up the new rules without re-emit.
- [x] Re-dispatch ch 03, ch 14 (coverage false-positives), and ch 17 (level cap violation) under the amended rules. All three returned `ok`.
- [x] Note the run-audit drift in PR body: `meta.json` records the v2 template SHA at emit time; the committed prompts are the v3 versions; the JSON outputs are valid v3 shape regardless. Future contract changes go through a fresh re-emit before dispatch.

## Phase 5 -- Documentation updates (post-#355 polish sweep)

- [x] Update `docs/agents/section-extraction-strategies.md`: replace "current contract gaps" section with "contract v3 in production" + numbers from PR #355.
- [x] Update `docs/agents/handbook-ingest-pipeline.md`: known-issue on truncation moves from "current as of 2026-04-29" to "resolved in contract v2/v3 + chapter-source-ingestion (#332/#335/#337/#342/#355)."
- [x] Update `docs/agents/handbook-onboarding-checklist.md`: per-handbook quirks table no longer says "PHAK chapters too long for 60K cap" (resolved); cap-sizing guidance points at `measure_chapter_sizes.py`.
- [x] Update `docs/work/NOW.md`: "PHAK regenerated" entry now reflects 913 entries (post-PR-355) instead of the v1 baseline ~559.
- [x] Delete the `phak-llm-v1-baseline` tag locally and on origin (acceptance comparison done; tag earned its keep, no longer needed).

## Out-of-band: monitor post-merge

After phases 1-4 ship:

- [ ] Schedule a re-run of every other handbook configured for `prompt` or `compare`. Today: AFH and AVWX both default to `section_strategy: toc` (no `prompt` re-run needed); revisit if either flips to `prompt` for a particular use.
- [ ] If chapter-source-ingestion has shipped (✅ #337), remove the cap entirely for handbooks in chapter mode. **Status: still required for whole-doc fallback handbooks (AVWX, IFH).** Per-handbook YAMLs in chapter mode (PHAK, AFH, IPH, helicopter, glider, balloon, instructors) bypass the cap via `chapter_pdfs` block per ADR 022; the cap stays in YAML as a fallback for any handbook that loses chapter-PDF access.
