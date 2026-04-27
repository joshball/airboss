# Run the LLM section-extraction strategy via Claude Code

This prompt is the no-API-key alternative to `sections_via_llm.py`. Run it
inside a fresh Claude Code session (or paste it as a user message). It uses
Claude Code's existing model access; no `ANTHROPIC_API_KEY` env var needed.

The output is byte-comparable to what `sections_via_llm.py` writes, so the
generated `_llm_section_tree.json` files can drop straight into the
existing compare pipeline (`bun run handbook-ingest <doc> --strategy
compare`).

## Prerequisites

- This worktree (or any branch with the handbook-ingestion-and-reader work
  package landed) checked out.
- `bun install` has been run.
- The handbook has already been ingested with the TOC strategy, so each
  `handbooks/<doc>/<edition>/<chapter>/` directory exists with an
  `index.md` plus the per-section markdown files.
- Working directory: the airboss repo root (or this worktree's root).

## Prompt to paste into Claude Code

Copy everything between the fenced block below into a fresh Claude Code
session. Replace `<doc>` and `<edition>` with the target handbook
(`phak` and `FAA-H-8083-25C` for the canonical first run).

```text
You are extracting the section structure of FAA handbook chapters and
producing a per-chapter section tree that is byte-comparable to what
`tools/handbook-ingest/ingest/sections_via_llm.py` produces.

Working directory: the airboss repo root (or the active worktree root).
Target handbook: <doc> = phak, <edition> = FAA-H-8083-25C
  (substitute when running for a different handbook).

For each chapter directory under
handbooks/<doc>/<edition>/<NN>/ where NN is 01..17 (use `ls` to get the
real list; do not hardcode 17):

1. Read the chapter title from
   handbooks/<doc>/<edition>/<NN>/index.md frontmatter (`section_title`
   field).
2. Build the chapter plaintext: concatenate the chapter's index.md body
   (skip frontmatter) plus every `<NN>-*.md` file in the same directory,
   sorted by filename, skipping each file's frontmatter. Cap the total at
   60000 characters (matches `LlmConfig.chapter_text_max_chars` in
   `sections_via_llm.py`); truncate from the end -- never from the middle
   -- so the head of the chapter is always intact. Strip frontmatter by
   detecting the `---\n...\n---\n` block at the start of each file.
3. Apply the section-extraction prompt at
   tools/handbook-ingest/ingest/prompts/section_tree.md. Substitute
   `{title}` with the chapter title and `{plaintext}` with the truncated
   plaintext from step 2. The prompt's strict-JSON-out contract is the
   contract for your output -- do not add commentary, fencing, or prose.
4. Write the JSON array (only -- no ```json fence, no prose) to
   handbooks/<doc>/<edition>/<NN>/_llm_section_tree.json
   with a single trailing newline.
5. Validate before moving on: every entry must have `title` (non-empty
   string), `level` (1, 2, or 3), `page_anchor` (string or null), and
   `parent_title` (string or null). Sort the array by `line_offset`
   ascending. Skip any malformed entry rather than fail the chapter.

After every chapter is written:

6. Run the existing compare pipeline to produce the markdown report:
     bun run handbook-ingest <doc> --edition <edition> --strategy compare
   This rebuilds
   tools/handbook-ingest/reports/section-strategy-compare-<doc>-<edition>.md
   from the freshly-written `_llm_section_tree.json` files plus the TOC
   tree the previous ingestion baked into manifest.json.
7. Read the report, summarize the agreement buckets per chapter, and
   surface any chapter with `low` agreement plus a one-line cause
   ("LLM hallucinated 3 L1 entries", "TOC missed a subsection split", etc.).

Constraints (these match section_tree.md verbatim; restating for emphasis):

- Use only headings that appear verbatim in the chapter plaintext. Do not
  invent, paraphrase, or infer headings from general aviation knowledge.
- Page anchors should match the printed page format (e.g. "12-7"), not the
  PDF page number. If no nearby page reference is visible, emit null.
- Level 1 = top-level section under the chapter. Level 2 = subsection.
  Level 3 = sub-subsection (rare; only when the prose actually
  distinguishes them). For level 2+, set `parent_title` to the title of
  the most recent strictly-shallower heading.
- Output JSON only (one array per chapter file). No markdown fencing.

Determinism note:

- This prompt is the no-API-key alternative to sections_via_llm.py. The
  underlying section_tree.md prompt is identical; only the harness
  changes. Re-runs with the same prompt + same chapter plaintext should
  produce the same JSON within model bounds. Any drift surfaces as a git
  diff on the `_llm_section_tree.json` files at PR review time.
- Record the prompt's SHA-256 in your final summary so the resulting
  report's metadata can match what `manifest.json -> extraction.section_strategy.llm.prompt_sha256`
  carries. Compute it with:
    shasum -a 256 tools/handbook-ingest/ingest/prompts/section_tree.md

Begin.
```

## How this differs from `sections_via_llm.py`

| Aspect          | `sections_via_llm.py`                   | This prompt                                                      |
| --------------- | --------------------------------------- | ---------------------------------------------------------------- |
| API key         | Required (`ANTHROPIC_API_KEY`)          | Not required; uses Claude Code's session                         |
| Determinism     | Pinned `claude-sonnet-4-5` + temp=0     | Claude Code's default model + sampling at session time           |
| Cost            | ~$0.30 per full PHAK re-run             | $0 incremental (covered by Claude Code subscription)             |
| Reproducibility | Byte-stable from prompt + input         | Stable while the prompt is unchanged; CC may roll model versions |
| Speed           | ~2-3 min for 17 chapters                | Slower; one chapter per turn unless batched                      |
| Audit trail     | Raw response saved to `_llm_section_tree.json` | Same -- Claude Code writes the JSON files itself          |
| Compare report  | Same `--strategy compare` invocation    | Same `--strategy compare` invocation                             |

## When to use which

- Use `sections_via_llm.py` when you have an API key, want pinned-model
  determinism, and want the run to be CI-runnable.
- Use `run-llm-comparison.md` (this prompt) when you do not want to
  provision an API key, you are already running Claude Code, and a
  one-time interactive run is acceptable.

The committed `_llm_section_tree.json` files are byte-comparable across
both methods -- same prompt, same input. Only the harness (and possibly
the model version) changes.

## Re-running after a prompt edit

If `section_tree.md` is updated, re-run via Claude Code:

```text
Re-run the LLM section extraction per
tools/handbook-ingest/ingest/prompts/run-llm-comparison.md.
```

Commit the regenerated `_llm_section_tree.json` files plus the
regenerated `section-strategy-compare-<doc>-<edition>.md` report in the
same commit as the prompt edit. Do not ship one without the other.
