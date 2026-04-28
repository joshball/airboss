# Section-extraction prompt strategy

How to run section-extraction across an FAA handbook without an
`ANTHROPIC_API_KEY`. The CLI emits a self-contained prompt set; the user
pastes it into a fresh Claude Code session; sub-agents fan out one-per-
chapter and write JSON; the CLI's compare strategy reads those JSONs and
diffs against the deterministic TOC parse.

If you want the architectural rationale, see
`docs/work-packages/section-extraction-prompt-strategy/design.md`. This
doc is the how-to for future agents.

## When to use which strategy

| Strategy  | When                                                                    |
| --------- | ----------------------------------------------------------------------- |
| `toc`     | Default. The handbook's printed Table of Contents is reliable.          |
| `prompt`  | TOC is unreliable / you want a second opinion. No API key needed.       |
| `compare` | After a `prompt` run completes; diff TOC vs prompt-flow per chapter.    |

The default in every shipped handbook is `toc`. The prompt flow is opt-in
per run via `--strategy prompt`; the YAML is not flipped.

## Three-step flow

1. **Emit the prompt set.**

   ```bash
   bun run sources extract handbooks <doc> --edition <ed> --strategy prompt
   ```

   This:

   - Writes `_chapter_plaintext.txt` per chapter under
     `handbooks/<doc>/<ed>/<NN>/`.
   - Renders a per-run prompt set into
     `tools/handbook-ingest/prompts-out/<doc>/<ed>/out/`.
   - Mirrors `out/` into `archive/<run-id>/` (skip with `--no-archive`).
   - Stops short of seeding manifest rows.

   Run-id is `YYYYMMDD-HHMM` UTC (e.g. `20260428-1432`); collisions get
   `-N` suffix (`-2`, `-3`, ...).

2. **Paste into a fresh Claude Code session.**

   Open a NEW Claude Code session in the airboss repo root (NOT the
   session that emitted the prompts). Paste the contents of:

   ```text
   tools/handbook-ingest/prompts-out/<doc>/<ed>/out/_run.md
   ```

   The orchestrator references `_parameters.md` for the dispatch rules and
   fans out one `general-purpose` sub-agent per chapter (parallel
   dispatch in a single tool-call block).

   Each sub-agent writes exactly two files in its chapter directory:

   - `handbooks/<doc>/<ed>/<NN>/_llm_section_tree.json`
   - `handbooks/<doc>/<ed>/<NN>/_model_self_report.txt`

   The fresh-session requirement is critical: the airboss session that
   emitted the prompts MUST NOT Agent-dispatch the orchestrator. Doing
   so burns the emitting session's context and contradicts the standing
   memory note `feedback_llm_comparison_runner_is_interactive.md`.

3. **Run compare.**

   ```bash
   bun run sources extract handbooks <doc> --edition <ed> --strategy compare
   ```

   This:

   - Verifies the cached PDF's SHA-256 against `meta.json.source_pdf_sha256`
     (hard-fails on mismatch -- "PDF changed since the prompt run").
   - Reads each chapter's JSON + `_model_self_report.txt` (hard-fails on
     missing or malformed files).
   - Runs the deterministic TOC strategy.
   - Renders `tools/handbook-ingest/reports/section-strategy-compare-<doc>-<ed>.md`.

   Compare does NOT mutate the sidecars and does NOT seed manifest rows.

## Run directory layout

```text
tools/handbook-ingest/prompts-out/<doc>/<edition>/
  out/                            # mutable; overwritten each run
    _run.md                       # orchestrator prompt -- the paste target
    _parameters.md                # snapshot of templates/.../parameters.md
    _section_tree_contract.md     # snapshot of prompts/section_tree.md
    _config.yaml                  # snapshot of the handbook YAML
    meta.json                     # write-once replay record
    README.md                     # human-readable run overview
    01-<chapter-slug>.md          # per-chapter prompt
    02-<chapter-slug>.md
    ...
  archive/                        # frozen snapshots (archive-by-default)
    20260428-1432/                # YYYYMMDD-HHMM UTC; -N suffix on collision
      ... mirror of out/ at run time ...
```

`out/` is overwritten on every run; `archive/<run-id>/` is the audit
snapshot. Re-running produces a clean two-part diff: new `out/` plus a new
`archive/<run-id>/` directory.

## meta.json schema (write-once)

```json
{
  "run_id": "20260428-1432",
  "generated_at_utc": "2026-04-28T14:32:18Z",
  "document_slug": "phak",
  "edition": "FAA-H-8083-25C",
  "repo_sha": "5b75e966...",
  "source_pdf_sha256": "247929cace0a...",
  "templates": {
    "parameters_md_sha256": "...",
    "section_tree_md_sha256": "...",
    "orchestrator_md_sha256": "...",
    "chapter_md_sha256": "...",
    "run_readme_md_sha256": "..."
  },
  "config": {
    "chapter_text_max_chars": 60000,
    "section_strategy": "prompt",
    "config_yaml_sha256": "..."
  },
  "chapters": [
    {
      "ordinal": 1,
      "code": "1",
      "title": "Introduction To Flying",
      "page_range": "1-1..1-24",
      "sidecar_path": "handbooks/phak/FAA-H-8083-25C/01/_chapter_plaintext.txt",
      "sidecar_sha256": "...",
      "sidecar_chars": 24180,
      "output_path": "handbooks/phak/FAA-H-8083-25C/01/_llm_section_tree.json",
      "model_self_report_path": "handbooks/phak/FAA-H-8083-25C/01/_model_self_report.txt",
      "prompt_path": "tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/01-introduction-to-flying.md",
      "prompt_sha256": "..."
    }
  ]
}
```

Every field is write-once; nothing mutates after emission. A reviewer can
checksum each input + prompt against `meta.json` to confirm the committed
run is internally consistent.

## Common failure modes

| Failure                                                  | What to do                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| Compare: PDF SHA-256 mismatch                            | Re-run `--strategy prompt`; the JSONs were produced against stale bytes. |
| Compare: missing `_llm_section_tree.json`                | Re-paste `out/_run.md` into a fresh CC session.                   |
| Compare: missing `_model_self_report.txt`                | Same as missing JSON; sub-agents must write both.                 |
| Compare: malformed JSON                                  | Re-paste that chapter's prompt manually; re-run compare.          |
| Sub-agent: sidecar SHA-256 mismatch                      | Re-run `--strategy prompt --force` to regenerate sidecars.        |
| YAML carries `section_strategy: llm`                     | Rename to `prompt`. The CLI errors with this exact hint.          |
| YAML carries `per_chapter_section_strategy`              | Remove the field. Per-chapter strategy mixing is no longer supported. |
| YAML has top-level `llm:` block                          | Rename to `prompt:`. The `chapter_text_max_chars` field is unchanged. |

## Editing templates

The four templates live at:

```text
tools/handbook-ingest/ingest/prompts/section-extraction/
  parameters.md
  orchestrator.md
  chapter.md
  run_readme.md
```

`section_tree.md` (the JSON output contract) lives one directory up at
`tools/handbook-ingest/ingest/prompts/section_tree.md`.

Rules:

- **`parameters.md` is the single source of truth** for sub-agent rules.
  `orchestrator.md` references it; do NOT restate the rules elsewhere.
- **`chapter.md` is pure substitution only.** No conditional logic per
  handbook. If a future handbook needs branching, that's the trigger to
  introduce `chapter-overrides.md`; forbidden today.
- After editing a template, re-run `--strategy prompt` to regenerate the
  per-run snapshot. Commit the template change + regenerated `out/` +
  new `archive/<run-id>/` together.

The chapter / orchestrator / run-readme templates pass through Python
`str.format(...)`; literal `{` / `}` characters must be doubled (`{{` /
`}}`) in those template sources. `parameters.md` and `section_tree.md`
are copied verbatim and don't need brace escaping.

## What this PR replaced

This flow replaces the old `--strategy llm` API path
(`sections_via_llm.py`) and the human-interactive
`run-llm-comparison.md` runner. Both are deleted; their YAML hooks
(`section_strategy: llm`, `per_chapter_section_strategy`, the `llm:`
block) error with rename hints rather than silently falling back.
