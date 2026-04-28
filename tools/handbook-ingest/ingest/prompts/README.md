# Section-tree extraction prompt

This prompt extracts the section / sub-section tree from FAA handbook
chapter plaintext. Used by `ingest/sections_via_llm.py` (Option 4 in the
parallel-strategies bake-off; see the worktree handbook-ingestion-and-reader
work package).

## Reproducibility

Same prompt + same input + temperature=0 + same pinned model =
~identical output (within the model's bounds).

The prompt's SHA-256 is recorded in `manifest.json` under
`extraction.section_strategy.llm.prompt_sha256` so future runs know which
prompt produced any given tree.

The raw model response per chapter is saved at
`handbooks/<doc>/<edition>/<chapter>/_llm_section_tree.json` (committed,
PR-reviewable). Re-running with the same prompt should produce a no-op git
diff on those files; any drift is the model, not the pipeline.

## To tweak

1. Edit `section_tree.md`.
2. Re-run the pipeline: `bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy llm --force`.
3. Inspect the new `_llm_section_tree.json` files (one per chapter).
4. Diff vs the previous version: `git diff handbooks/phak/FAA-H-8083-25C/**/_llm_section_tree.json`.
5. Commit the prompt change + the regenerated trees together. Don't ship one
   without the other.

## Model

Pinned in `sections_via_llm.py`:

- `MODEL = "claude-sonnet-4-5"`
- `TEMPERATURE = 0.0`
- `MAX_TOKENS = 4096`
- `ANTHROPIC_API_VERSION = "2023-06-01"`

Sonnet is the right balance for the ~17 chapter calls per handbook (cheap
enough; smart enough for FAA prose). Bumping the model is a deliberate
edit; ship the model change + regenerated trees in the same commit.

## Cost estimate

PHAK 17 chapters x ~5K tokens input + ~1K tokens output. With current
Sonnet pricing this lands around $0.30 per full re-run. Well-bounded for
a manual content workflow.

## Format note: Python `str.format` braces

The prompt is loaded via `Path.read_text()` and consumed with
`prompt_template.format(title=..., plaintext=...)`. To embed a literal
`{` in the rendered output (the `{` and `}` inside the JSON example block)
the markdown source uses `{{` / `}}`. If you edit the JSON example,
preserve the doubled braces; otherwise `format()` will raise.

## Why JSON, not tools?

We want the raw response text on disk for diffing. A tool-call shape would
hide the model's structured output behind the SDK. Strict-JSON-out + a
defensive parser is the simpler audit story.
