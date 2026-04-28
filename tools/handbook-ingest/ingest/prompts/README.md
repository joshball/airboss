# Section-tree extraction prompts

This directory holds the prompt material for the section-extraction flow.

## What's here

| File                                 | Role                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `section_tree.md`                    | The strict-JSON output contract. Snapshotted into each per-run dir as `_section_tree_contract.md`. |
| `section-extraction/`                | The four templates emitted into `prompts-out/<doc>/<edition>/out/` per run.                        |
| `section-extraction/parameters.md`   | Sub-agent rules (single source of truth; orchestrator links here).                                 |
| `section-extraction/orchestrator.md` | Paste target for the user's fresh Claude Code session.                                             |
| `section-extraction/chapter.md`      | Per-chapter prompt template (placeholder substitution only).                                       |
| `section-extraction/run_readme.md`   | README skeleton emitted into each run dir.                                                         |

## How the prompt strategy runs

See `docs/agents/section-extraction-prompt-strategy.md` for the full
walkthrough. Short version:

1. `bun run sources extract handbooks <doc> --edition <ed> --strategy prompt`
   emits `tools/handbook-ingest/prompts-out/<doc>/<ed>/out/` and stops.
2. The user opens a fresh Claude Code session in the airboss repo root
   and pastes `out/_run.md` as the first message.
3. Sub-agents fan out one-per-chapter and write
   `handbooks/<doc>/<ed>/<NN>/_llm_section_tree.json` plus
   `handbooks/<doc>/<ed>/<NN>/_model_self_report.txt`.
4. `bun run sources extract handbooks <doc> --edition <ed> --strategy compare`
   reads those files and renders the comparison report.

No `ANTHROPIC_API_KEY` is involved at any step. The fresh CC session
provides the model.

## Tweaking `section_tree.md`

This file is the JSON contract every sub-agent obeys. Edits propagate to
the next prompt run via the `_section_tree_contract.md` snapshot in
`prompts-out/.../out/`.

1. Edit `section_tree.md`.
2. Re-run the prompt strategy:
   `bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy prompt`.
3. Paste the new `out/_run.md` into a fresh Claude Code session.
4. Run `--strategy compare` and inspect the generated report.
5. Commit the prompt change + regenerated `_llm_section_tree.json` files +
   the new `archive/<run-id>/` snapshot together.

## Format note: Python `str.format` braces

The chapter / orchestrator / run-readme templates are loaded via
`Path.read_text()` and consumed with `text.format(...)`. To embed a
literal `{` in the rendered output (e.g. inside a JSON example block) the
markdown source must use `{{` / `}}`. `parameters.md` and `section_tree.md`
are copied verbatim (no `.format()` call), so they don't need escaping.

## Why JSON, not tools?

We want the raw response text on disk for diffing. A tool-call shape
would hide the model's structured output behind the SDK. Strict-JSON-out +
a defensive parser is the simpler audit story.
