# Section extraction strategies

Deep dive into how the handbook ingest pipeline turns a chapter into a
section tree. Three strategies coexist: **TOC**, **LLM**, and
**compare**. They disagree systematically. This doc explains why, what
each gets right, and how to read a compare report.

Companion docs:

- [handbook-ingest-pipeline.md](handbook-ingest-pipeline.md) -- end-to-end pipeline overview
- [section-extraction-prompt-strategy.md](section-extraction-prompt-strategy.md) -- the no-API-key paste flow

## Path tokens used in this doc

| Token                  | Meaning                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `$HANDBOOK_CACHE_ROOT` | `~/Documents/airboss-handbook-cache/` (override via `AIRBOSS_HANDBOOK_CACHE`) |
| `$REPO_ROOT`           | The repo root                                                                 |
| `<doc>`                | Document slug (`phak`, `afh`, `avwx`)                                         |
| `<edition>`            | Edition tag (`FAA-H-8083-25C`)                                                |
| `<NN>`                 | Two-digit chapter ordinal                                                     |

## Why two strategies exist

The TOC parser and the LLM parser look at different inputs and answer
different questions. They are not redundant.

| Strategy | Input                          | Question it answers                                                         |
| -------- | ------------------------------ | --------------------------------------------------------------------------- |
| TOC      | Printed table-of-contents text | "What sections did the FAA's editor say exist?"                             |
| LLM      | Chapter body markdown          | "What sections actually exist as headings in the body text?"                |
| compare  | Both trees                     | "Where do TOC and LLM disagree, and which one is probably right per case?"  |

The TOC parser is deterministic but limited by what the printed TOC
contains. The LLM reads body text directly and finds real headings the
printed TOC missed. They disagree systematically; compare exists to
surface and reconcile the disagreement.

## TOC strategy deep dive

Source: [sections_via_toc.py](../../tools/handbook-ingest/ingest/sections_via_toc.py).

### How it works

1. Reads the YAML `toc:` block (`page_start`, `page_end` of the printed
   TOC, plus `heading_style` hints).
2. Extracts the printed TOC text from those PDF pages.
3. Parses each TOC line: title + page anchor (e.g.
   `Powerplant ........ 7-1`).
4. Emits `SectionTreeNode{level, title, page_anchor, ordinal, chapter_ordinal}`.
5. Validates each TOC line against body text via fingerprint match
   (where the heading appears in the chapter body markdown).
6. Emits warnings on fingerprint failures; warnings are recorded in
   `manifest.json`, not fatal.

### What it gets right

- Page anchors. When the TOC includes them, they are accurate and
  authoritative.
- Boilerplate. "Introduction" and "Chapter Summary" entries are
  preserved because they appear in the printed TOC.
- Determinism. Same input PDF -> same output. No model variance.

### What it gets wrong

| Limitation                             | Cause                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Over-flattens hierarchy                | The FAA's printed TOC promotes most subsections to L1 because they're indented identically. Real hierarchy (Powerplant -> Propeller -> Fixed-Pitch Propeller) gets lost. |
| Misses body headings absent from TOC   | PHAK ch 1 has "History of the Federal Aviation Administration (FAA)" as a real L1 in body text; not in the printed TOC.                        |
| Treats list-item labels as sections    | "Privileges:" / "Limitations:" become L2 because they're indented like sections in the TOC.                                                    |
| Page anchor only when TOC included one | If the FAA omitted a page in the printed TOC, the parser can't fabricate one.                                                                  |

### Observed scale (phak FAA-H-8083-25C)

- 833 nodes parsed across 17 chapters.
- ~668 nodes emit fingerprint warnings (most are non-fatal mismatches
  between TOC casing/punctuation and body text).
- Nearly every chapter shows L1 inflation: ch 7 reports 86 L1 entries
  from the TOC where the LLM reports 6.

## LLM strategy deep dive

Source: prompt templates at
[tools/handbook-ingest/ingest/prompts/section-extraction/](../../tools/handbook-ingest/ingest/prompts/section-extraction/)
plus the JSON contract in
[prompts/section_tree.md](../../tools/handbook-ingest/ingest/prompts/section_tree.md).

### How it works

1. The CLI emits one prompt per chapter to
   `$REPO_ROOT/tools/handbook-ingest/prompts-out/<doc>/<edition>/out/`.
2. Each prompt loads `_chapter_plaintext.txt` (PyMuPDF-extracted),
   truncated at the YAML's `chapter_text_max_chars`.
3. The user runs the no-API-key paste flow described in
   [section-extraction-prompt-strategy.md](section-extraction-prompt-strategy.md).
4. Each sub-agent emits `_llm_section_tree.json` per the contract:
   array of `{ level, title, page_anchor, ordinal }`.
5. Sidecar SHA-256 verification protects against partial writes and
   hand edits.

### What it gets right

- Real document hierarchy. The LLM reads body structure and nests
  subsections under their parents correctly. PHAK ch 7's "Fixed-Pitch
  Propeller" / "Adjustable-Pitch Propeller" are children of
  "Propeller" in the LLM tree (correct), siblings in the TOC tree
  (wrong).
- Catches body headings the FAA omitted from the printed TOC.
- Resilient to TOC formatting quirks since it never reads the TOC.

### What it gets wrong

| Limitation                          | Cause                                                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Input truncation (load-bearing)** | `chapter_text_max_chars` caps the plaintext fed to the model. PHAK is 60000. The most recent run had 11 of 17 PHAK chapters hit the cap.                       |
| Boilerplate omission                | The contract is silent on whether to keep "Introduction" / "Chapter Summary"; the model tends to drop them.                                                    |
| No page anchors                     | Current contract doesn't ask for page anchors; LLM emits `no-anchor` everywhere even though the page footer text (`7-12`, `7-13`) is in the sidecar plaintext. |
| Model variance                      | Two paste runs of the same prompt may differ slightly in casing / inclusion of edge cases.                                                                     |

The truncation pitfall is severe. Ch 7 ended mid-sentence in engine
cooling; the LLM never saw turbine engines, fuel systems, oxygen, or
anti-ice. Any "missing back-half" pattern in the compare report should
be checked against the plaintext file size first.

## Compare strategy deep dive

Source: [sections_compare.py](../../tools/handbook-ingest/ingest/sections_compare.py).

### How the diff is built

1. Greedy title-match within `(chapter, level)`. Match is normalized
   to lowercase, whitespace-collapsed.
2. Each entry is categorized: **agreement**, **TOC only**, **LLM
   only**, **level mismatch**, **parent mismatch**.
3. Per-chapter table summarizes counts.
4. Per-chapter detailed diff lists every TOC entry, every LLM entry,
   and every disagreement.

Output:
`$REPO_ROOT/tools/handbook-ingest/reports/section-strategy-compare-<doc>-<edition>.md`.

### How to read the report

The top table is the executive summary. Key columns:

| Column                          | Read it as                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `TOC L1` vs `LLM L1`            | If drastically different, one is over-flattening (almost always TOC).                                                               |
| `TOC total` vs `LLM total`      | If LLM is much smaller (>2x ratio), suspect input truncation. Check `_chapter_plaintext.txt` size against `chapter_text_max_chars`. |
| `parent diff`                   | Always nonzero. That's the structural-hierarchy disagreement, usually the LLM's nesting being correct.                              |
| `level diff`                    | Same headline as parent diff; the LLM saw a subsection where TOC said top-level.                                                    |

Per-category interpretation:

| Category          | Most common explanation                                                                       | What to do                                                                |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Agreement         | Both saw the same heading.                                                                    | Trust it.                                                                 |
| TOC only          | Either real headings the LLM missed, OR boilerplate the LLM intentionally skipped.            | Check body text. If real -> truncation or omission bug. If boilerplate -> tolerate. |
| LLM only          | Real body headings the FAA didn't include in their printed TOC.                               | Usually valid finds; verify in body text.                                 |
| Level mismatch    | LLM nested a subsection that TOC promoted to L1.                                              | LLM is usually correct.                                                   |
| Parent mismatch   | Same heading, different parent. The two trees disagree about which L1 owns it.                | LLM is usually correct.                                                   |

## Three patterns observed in the phak FAA-H-8083-25C run

Snapshot from
[section-strategy-compare-phak-FAA-H-8083-25C.md](../../tools/handbook-ingest/reports/section-strategy-compare-phak-FAA-H-8083-25C.md).
Re-runs will refresh the numbers.

### Pattern A -- TOC over-flattens, LLM nests correctly

The clearest example is ch 7 (Aircraft Systems): 16 level mismatches +
16 parent mismatches. Subsections like "Fixed-Pitch Propeller" appear
as L1 in TOC, L2 under "Propeller" in LLM. LLM is right; FAA's printed
TOC indentation can't be trusted as level signal.

### Pattern B -- LLM truncated inputs cause missing back-half sections

11 of 17 PHAK chapters hit the 60000-char cap. Ch 7 is missing
turbines, fuel, oxygen, and anti-ice. Ch 14 (Airport Operations) is
missing the second half. The compare report flags these as huge "TOC
only" counts in the back half of the chapter. Read the report bottom-up
in those cases -- the missing cluster is contiguous.

### Pattern C -- LLM skips boilerplate, TOC keeps it

"Introduction" and "Chapter Summary" appear in roughly every chapter's
printed TOC but the LLM omits them as boilerplate. ~34 expected gaps
across the book. Predictable. Fixable with a contract change ("always
include Introduction and Chapter Summary if present").

## The mutual-reviewer framing (proposed)

Future contract-v2 work will operationalize this:

- Pass the parsed TOC to the LLM **as a checklist**, not as truth.
- Ask the LLM to (a) verify each TOC entry exists in body text,
  (b) find any missing, and (c) emit a `disagreements:` array
  explaining where it disagrees with the TOC parse.
- Both outputs (the LLM tree AND the disagreements) feed back into
  improving the TOC parser.

This makes TOC and LLM mutual reviewers rather than competing oracles.
The compare step becomes the auditor's view rather than a deep diff.

## What you do with a compare report

Operational checklist when a fresh report lands:

1. Skim the top table. Identify chapters with `TOC total >> LLM total`
   (>2x) -- those are truncation-suspect.
2. For each truncation-suspect chapter, check the
   `_chapter_plaintext.txt` byte size vs `chapter_text_max_chars` in
   the YAML. If the file is exactly at the cap, it's truncated. Bump
   the cap and re-emit prompts for that chapter.
3. For chapters where totals look comparable, read level/parent
   mismatches first. They are the structural issues; if the LLM nests
   sensibly, prefer the LLM tree.
4. Scan "LLM only" entries. If they appear in body text, the printed
   TOC is incomplete (not a fixable bug, but informs how to weight
   TOC-only data downstream).
5. Scan "TOC only" entries. Sort into "real heading the LLM missed"
   (truncation or model miss) vs "boilerplate" (tolerate).
6. Decide per-chapter which strategy to trust, or whether to re-run.

The compare report is read by humans. Its job is to surface decisions,
not to make them.

## Failure modes per strategy

Cross-references the failure mode table in
[handbook-ingest-pipeline.md](handbook-ingest-pipeline.md).

| Strategy | Failure                              | Symptom                                              | Resolution                                                    |
| -------- | ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------- |
| TOC      | `OutlineError`                       | Pipeline aborts before section parse                 | Fix YAML `toc:` block (page_start / page_end / heading style) |
| TOC      | Empty body / chapter markdown blank  | Fingerprint validation fails for every node          | Re-run extract; check upstream chapter markdown emission      |
| TOC      | Fingerprint warnings (non-fatal)     | `manifest.json` has many warnings                    | Acceptable noise; only act if warning count is unusual        |
| LLM      | Sidecar SHA mismatch                 | CLI rejects `_llm_section_tree.json` on read         | Re-paste using the exact run.md flow; do not hand-edit JSON   |
| LLM      | Malformed JSON                       | Parse error during ingest                            | Re-paste; sub-agent likely added prose or fencing             |
| LLM      | Missing `_model_self_report.txt`     | Validation rejects the run                           | Re-paste; sub-agent skipped the self-report step              |
| LLM      | Output truncation                    | Tree ends mid-chapter; back-half sections missing    | Bump `chapter_text_max_chars`; re-emit prompt; re-paste       |
| compare  | PDF SHA mismatch                     | Compare refuses to run                               | Re-emit prompts so sidecars match current PDF                 |
| compare  | Sidecar missing                      | Per-chapter row blank in report                      | Re-paste run.md for that chapter                              |

## Source files

- [sections_via_toc.py](../../tools/handbook-ingest/ingest/sections_via_toc.py)
- [sections_compare.py](../../tools/handbook-ingest/ingest/sections_compare.py)
- [section_tree.py](../../tools/handbook-ingest/ingest/section_tree.py)
- [prompts/section_tree.md](../../tools/handbook-ingest/ingest/prompts/section_tree.md)
- [prompts/section-extraction/](../../tools/handbook-ingest/ingest/prompts/section-extraction/)
- [reports/](../../tools/handbook-ingest/reports/)
