---
title: 'Test plan: Section extraction contract v2'
product: platform
feature: section-extraction-contract-v2
type: test-plan
status: unread
review_status: pending
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

## Phase 2 acceptance -- contract rewrite

### Test 2.1 -- contract document reflects v2 shape

1. Open `tools/handbook-ingest/ingest/prompts/section_tree.md`.
2. Verify v2 entry shape documented (level, title, page_anchor, ordinal, parent_title).
3. Verify coverage assertion documented as a postcondition.
4. Verify boilerplate rule documented (Introduction + Chapter Summary as L1).
5. Verify hierarchy preference documented (body wins over TOC).
6. Verify difficult-cases catalog present.
7. Verify contract version bumped.

### Test 2.2 -- legacy shape rejected

1. Manually craft a `_llm_section_tree.json` with v1 shape (`page_anchor: "no-anchor"`).
2. Run `bun run sources extract handbooks phak --strategy compare`.
3. Confirm hard-fail with a clear error pointing at the v2 shape.

### Test 2.3 -- pytest

```bash
cd tools/handbook-ingest && .venv/bin/pytest -q
```

**Expected:** all green.

## Phase 3 acceptance -- mutual-reviewer framing

### Test 3.1 -- emitted prompt includes TOC checklist

1. `bun run sources extract handbooks phak --strategy prompt --force`.
2. Open `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/07-aircraft-systems.md`.
3. Verify the prompt includes a "TOC parser checklist" section listing the deterministic parser's headings for ch 7.
4. Verify the prompt includes a `Per-handbook hints:` section (may be empty for phak).

### Test 3.2 -- disagreements file shape

1. Manually run a single-chapter LLM extraction in a fresh CC session against `01-introduction-to-flying.md`.
2. Verify two files written: `_llm_section_tree.json` (entries, v2 shape) and `_llm_disagreements.json` (disagreement schema).
3. Confirm sub-agent return status line includes disagreement count.

### Test 3.3 -- compare report extensions

1. Run `bun run sources extract handbooks phak --strategy compare` against the freshly-extracted artifacts.
2. Open the report.
3. Verify "Coverage" section per-chapter (sidecar size, last entry anchor, status).
4. Verify "Disagreements" section aggregating all chapters' disagreements by type.

## Phase 4 acceptance -- end-to-end re-run

### Test 4.1 -- emit + paste-extract + compare

1. `bun run sources extract handbooks phak --strategy prompt --force`.
2. Open a FRESH Claude Code session. Paste `out/_run.md`.
3. Wait for 17 sub-agent completions.
4. Run `bun run sources extract handbooks phak --strategy compare`.

**Expected outcomes:**

- All 17 sub-agents return success.
- Every chapter has both files written.
- Coverage report: all green.
- Ch 7 entry count: 80-100 (vs 22 in the v1 run).
- Every entry has a `page_anchor` (or `null` with reason; `no-anchor` literal does not appear).
- Disagreements report flags TOC over-flattening as a systematic pattern (specifically ch 7's Propeller / Induction Systems hierarchy).

### Test 4.2 -- artifact replacement

1. `git status` -- 17 chapter directories show modified `_llm_section_tree.json` files.
2. Stage by name (no `git add -A`).
3. Inspect three random `_llm_section_tree.json` files. Verify v2 shape.
4. Commit.

### Test 4.3 -- determinism

1. Run `bun run sources extract handbooks phak --strategy compare` again.
2. Diff the new report against the previous one.
3. **Expected:** identical (compare is deterministic given fixed inputs).

## Phase 5 acceptance -- docs updated

### Test 5.1 -- doc cross-references

1. Open `docs/agents/section-extraction-strategies.md`. Verify v2 contract referenced.
2. Open `docs/agents/handbook-ingest-pipeline.md`. Verify truncation noted as "fixed in WP".
3. Open `docs/agents/handbook-onboarding-checklist.md`. Verify cap-sizing guidance from Phase 1.

### Test 5.2 -- example walkthrough

A reviewer (not the author) follows the onboarding checklist for a new
handbook end-to-end (e.g. helicopter handbook). They should never need
to consult code; the docs alone should be sufficient. Capture any gaps
as follow-up tasks.

## Regression coverage

After all phases:

- [ ] No handbook configured for `prompt` mode hits the cap.
- [ ] No `_llm_section_tree.json` in the repo carries the v1 shape.
- [ ] No prompt template references the literal `no-anchor` string.
- [ ] `bun run check` clean.
- [ ] Every test in `tools/handbook-ingest/tests/` passes.

## What we do NOT test in this WP

- Chapter-source ingestion. Separate WP, separate test plan.
- TOC parser correctness improvements driven by disagreements. Surface
  them in the report; fixing the parser is a follow-up.
- Performance. The LLM run is paste-driven; throughput is the user's
  problem, not ours.
- Other handbooks. Each runs in its own follow-up; the contract change
  applies generically once phak is verified.
