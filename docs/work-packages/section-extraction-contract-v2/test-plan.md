---
title: 'Test plan: Section extraction contract v2'
product: platform
feature: section-extraction-contract-v2
type: test-plan
status: done
review_status: done
closed_at: '2026-04-30'
---

# Test plan: Section extraction contract v2

Hand-test plan for the four phases in [tasks.md](tasks.md). Project rule:
nothing merges without manual verification. Automated tests cover unit
behavior; this plan covers correctness end-to-end.

## Phase 1 acceptance -- truncation fix

### Setup

```bash
git checkout main && git pull --ff-only
bun install
```

### Test 1.1 -- per-handbook cap measurement

For each handbook with `section_strategy: prompt` (today: `phak`):

1. Run `bun run sources extract handbooks <doc> --strategy prompt --force`.
2. `wc -c handbooks/<doc>/<edition>/*/_chapter_plaintext.txt`.
3. Confirm every size is below `chapter_text_max_chars` from the YAML.
4. Confirm the YAML comment names the chapter that drove the cap value.

**Expected:** zero chapters at the cap. Largest chapter under cap by at
least 20%.

### Test 1.2 -- truncation no longer hides content

1. Open `handbooks/phak/FAA-H-8083-25C/07/_chapter_plaintext.txt`.
2. Confirm the file ends with the chapter summary text, not mid-sentence.
3. `grep -c "^Turbine Engines\|^Fuel Systems\|^Oxygen Systems\|^Anti-Ice\|^Pressurized Aircraft\|^Chapter Summary" handbooks/phak/FAA-H-8083-25C/07/_chapter_plaintext.txt`.

**Expected:** 6 hits (one per pattern).

## Phase 2 acceptance -- contract rewrite (PR #342, amended #355)

### Test 2.1 -- contract document reflects v3 shape

1. Open `tools/handbook-ingest/ingest/prompts/section_tree.md`.
2. Verify entry shape: `level`, `title`, `page_anchor`, `line_offset`, `parent_title`.
3. Verify coverage assertion documented as a postcondition (with v3 amendment: figure-only trailing pages tolerated).
4. Verify boilerplate rule documented (Introduction + Chapter Summary as L1).
5. Verify hierarchy preference documented (body wins over printed TOC).
6. Verify difficult-cases catalog present.
7. Verify `CONTRACT VERSION: 3` line at the top.
8. Verify level cap rule (levels 1-3 only; flatten L4+ to L3 with documented worked example).

### Test 2.2 -- legacy `no-anchor` literal rejected

The contract forbids the literal string `"no-anchor"` in `page_anchor`. Verify every committed `_llm_section_tree.json` under `handbooks/phak/FAA-H-8083-25C/<NN>/` uses `null` (or a real anchor like `"7-12"`), never `"no-anchor"`.

```bash
grep -r '"no-anchor"' handbooks/phak/FAA-H-8083-25C/
```

**Expected:** zero hits.

### Test 2.3 -- pytest

```bash
cd tools/handbook-ingest && .venv/bin/pytest -q
```

**Expected:** all green.

## Phase 3 acceptance -- DEFERRED

Phase 3 tests will run only if the WP greenlights Phase 3 after reviewing the PR #355 compare report. See `tasks.md` Phase 3 section for decision criteria. Deferred test scaffold:

- (deferred) Emitted prompt includes `{toc_checklist}` and `{handbook_hints}` placeholder content per chapter.
- (deferred) Sub-agents emit `_llm_disagreements.json` alongside the section tree.
- (deferred) Compare report grows a "Disagreements" section.

## Phase 4 acceptance -- end-to-end re-run (PR #355, shipped)

### Test 4.1 -- emit + paste-extract + compare

Shipped via PR #355's self-driving orchestrator. Outcomes verified:

- ✅ All 17 sub-agents returned success.
- ✅ Every chapter has both files written (`_llm_section_tree.json` + `_model_self_report.txt`).
- ✅ Coverage report: green for every chapter.
- ✅ Ch 7 entry count: **89** (up from 22 in the v1 run).
- ✅ Every entry has a `page_anchor` (real value or `null`); literal `"no-anchor"` does not appear.
- ⏸️ Disagreements report: not yet implemented; deferred to Phase 3.

### Test 4.2 -- artifact replacement

Shipped via PR #355. New `_llm_section_tree.json` files committed. The `phak-llm-v1-baseline` tag preserved the v1 artifacts during the transition; deleted post-acceptance.

### Test 4.3 -- determinism

Compare is deterministic given fixed inputs. Re-running `--strategy compare` against the committed artifacts produces an identical report.

## Phase 5 acceptance -- docs updated (this polish PR)

### Test 5.1 -- doc cross-references

1. Open `docs/ingestion-pipeline/section-extraction-strategies.md`. Verify contract v3 referenced; truncation no longer described as "current".
2. Open `docs/ingestion-pipeline/handbook-ingest-pipeline.md`. Verify truncation noted as "resolved in PR #332/#335 + #337" with link to ADR 022.
3. Open `docs/ingestion-pipeline/handbook-onboarding-checklist.md`. Verify cap-sizing guidance points at `measure_chapter_sizes.py`. Verify the per-handbook quirks table no longer says "PHAK chapters too long for 60K cap".
4. Open `docs/work/NOW.md`. Verify the chapter-source-ingestion note carries the post-#355 entry count (913) instead of the v1 baseline (~559).

### Test 5.2 -- example walkthrough

A reviewer (not the author) follows the onboarding checklist for a new
handbook end-to-end (e.g. helicopter handbook). They should never need
to consult code; the docs alone should be sufficient. Capture any gaps
as follow-up tasks.

## Regression coverage

After all shipped phases (1, 2, 4, 5):

- [x] No handbook configured for `prompt` mode hits the cap (verified by `measure_chapter_sizes.py`).
- [x] No `_llm_section_tree.json` in the repo carries the v1 shape (PR #355 replaced them all).
- [x] No prompt template references the literal `no-anchor` string (forbidden by contract v2/v3).
- [x] `bun run check` clean (PR #355 ran the check before shipping).
- [x] Every test in `tools/handbook-ingest/tests/` passes (123/123 + 9 skipped as of PR #342).

## What we do NOT test in this WP

- Chapter-source ingestion. Separate WP, separate test plan.
- TOC parser correctness improvements driven by disagreements. Surface
  them in the report; fixing the parser is a follow-up.
- Performance. The LLM run is paste-driven; throughput is the user's
  problem, not ours.
- Other handbooks. Each runs in its own follow-up; the contract change
  applies generically once phak is verified.
