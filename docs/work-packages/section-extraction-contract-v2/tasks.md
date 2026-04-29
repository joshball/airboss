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

## Phase 1 -- Truncation fix (lands first)

Single-commit change. Targets the `chapter_text_max_chars` cap.

- [ ] Measure: for every handbook with `section_strategy: prompt` (or
      that might use it), run `--strategy toc` and capture the
      uncapped chapter plaintext sizes per chapter.
- [ ] Set `chapter_text_max_chars` per handbook to
      `max(longest_chapter) * 1.2` rounded up to the next 25K.
- [ ] Add a YAML comment on each cap value naming the chapter that
      drove it (e.g. `# ch14 Airport Operations is 248K -- 300K cap`).
- [ ] Run `bun run sources extract handbooks phak --strategy prompt --force` and verify every chapter's `_chapter_plaintext.txt` is below the cap.
- [ ] Commit + PR. Title: `fix(handbook-ingest): raise chapter_text_max_chars to fit longest chapters`.

## Phase 2 -- Contract rewrite (entry shape, coverage, boilerplate, hierarchy)

Touches:

- `tools/handbook-ingest/ingest/prompts/section_tree.md`
- `tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md`
- `tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md`
- `tools/handbook-ingest/tests/test_section_tree.py`
- `tools/handbook-ingest/ingest/sections_via_sidecar.py` (loader; new shape)

Tasks:

- [ ] Rewrite `section_tree.md` with v2 entry shape (`level`, `title`, `page_anchor`, `ordinal`, `parent_title`).
- [ ] Add coverage assertion to `parameters.md`. Self-check rule + new error return line.
- [ ] Add boilerplate rule (Introduction, Chapter Summary as L1).
- [ ] Add hierarchy preference rule (body > printed TOC).
- [ ] Add difficult-cases catalog (pseudo-headings, two-line wraps, sidebar callouts, repeated titles, numeric prefixes).
- [ ] Update `chapter.md` template: success status line text, contract reference path, error format.
- [ ] Update `sections_via_sidecar.py` to validate v2 shape; legacy shape (with `page_anchor: "no-anchor"`) is rejected.
- [ ] Update `test_section_tree.py` for v2 shape.
- [ ] Bump the contract version field in the contract doc itself; record version in `meta.json`.
- [ ] Run pytest; confirm clean.

## Phase 3 -- Mutual-reviewer framing (TOC checklist + disagreements)

Touches:

- `tools/handbook-ingest/ingest/prompt_emit.py` (new placeholders)
- `tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md` (use placeholders)
- `tools/handbook-ingest/ingest/sections_via_toc.py` (export per-chapter checklist data)
- `tools/handbook-ingest/ingest/sections_compare.py` (read disagreements; render report section)
- `tools/handbook-ingest/ingest/prompts/section_tree.md` (disagreements schema + file location)

Tasks:

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

- [ ] Run `bun run sources extract handbooks phak --strategy prompt --force`. Verify the emitted `out/01-introduction-to-flying.md` includes the new placeholders.
- [ ] Open a fresh Claude Code session. Paste `out/_run.md`. Wait for all 17 sub-agents to complete.
- [ ] Verify each chapter's `_llm_section_tree.json` matches v2 shape; verify each `_llm_disagreements.json` exists (may be empty).
- [ ] Run `bun run sources extract handbooks phak --strategy compare`. Read the new report.
- [ ] Verify ch 7 has 80+ entries; verify all chapters have `page_anchor` populated; verify Coverage section is green; verify Disagreements digest captures TOC over-flattening.
- [ ] Replace existing `_llm_section_tree.json` files in `handbooks/phak/FAA-H-8083-25C/<NN>/` with v2 output. Stage by name. Commit.

## Phase 5 -- Documentation updates

- [ ] Update `docs/agents/section-extraction-strategies.md`: replace "current contract gaps" section with "v2 contract" details.
- [ ] Update `docs/agents/handbook-ingest-pipeline.md`: known-issue on truncation moves to "Resolved in contract v2; see WP."
- [ ] Update `docs/agents/section-extraction-prompt-strategy.md`: contract-version reference + new error code.
- [ ] Update `docs/agents/handbook-onboarding-checklist.md`: cap-sizing guidance from Phase 1.
- [ ] Update CLAUDE.md if any of the changed surfaces are mentioned.

## Out-of-band: monitor post-merge

After phases 1-4 ship:

- [ ] Schedule a re-run of every other handbook configured for `prompt` or `compare`. Document outcomes in a follow-up note.
- [ ] If chapter-source-ingestion has shipped, remove the cap entirely for handbooks in chapter mode.
