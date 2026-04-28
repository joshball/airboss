# Section-extraction prompt run -- {document_slug} {edition}

Run-id: `{run_id}` (UTC). Generated at: `{generated_at_utc}`.
Repository SHA: `{repo_sha}`.

## What this run is

A snapshot of every input that shapes the section-extraction prompt flow
for handbook `{document_slug}` (edition `{edition}`). The user pastes
`_run.md` into a fresh Claude Code session; sub-agents fan out one-per-
chapter and write `_llm_section_tree.json` + `_model_self_report.txt`
into each chapter directory under `handbooks/{document_slug}/{edition}/`.

This directory is a self-contained replay surface: every byte the agent
sees at run time is committed alongside the JSON it produces.

## What's in this directory

- `_run.md` -- the orchestrator prompt; the ONE thing the user pastes.
- `_parameters.md` -- snapshot of the run-time agent rules (sub-agent
  type, parallel dispatch, return contract, file-write rules, sidecar
  verification).
- `_section_tree_contract.md` -- snapshot of the JSON output contract.
- `_config.yaml` -- snapshot of the handbook's YAML config at run time.
- `meta.json` -- replay record: run-id, repo SHA, source PDF SHA-256,
  template SHA-256s, per-chapter sidecar / output / prompt paths and
  hashes.
- `README.md` -- this file.
- `<NN>-<chapter-slug>.md` -- per-chapter prompt, one per chapter.

## How this was generated

```bash
bun run sources extract handbooks {document_slug} --edition {edition} --strategy prompt
```

(Add `--no-archive` to skip the `archive/<run-id>/` snapshot. Default is
to archive every run.)

## How to replay

1. Open a FRESH Claude Code session in the airboss repo root (not the
   session that emitted this run; the no-key flow requires a separate
   paste-driven session).
2. Paste the contents of `_run.md` as the first user message there.
3. Wait for sub-agents to finish writing
   `handbooks/{document_slug}/{edition}/<NN>/_llm_section_tree.json` and
   `handbooks/{document_slug}/{edition}/<NN>/_model_self_report.txt` for
   every chapter.
4. In the airboss session (NOT the fresh one), run:

   ```bash
   bun run sources extract handbooks {document_slug} --edition {edition} --strategy compare
   ```

   That reads the per-chapter JSONs, runs the deterministic TOC strategy,
   and writes a markdown comparison report under
   `tools/handbook-ingest/reports/`.

## Templates as of this run

| Template               | SHA-256                       |
| ---------------------- | ----------------------------- |
| `parameters.md`        | `{parameters_md_sha256}`      |
| `section_tree.md`      | `{section_tree_md_sha256}`    |
| `orchestrator.md`      | `{orchestrator_md_sha256}`    |
| `chapter.md`           | `{chapter_md_sha256}`         |
| `run_readme.md`        | `{run_readme_md_sha256}`      |

A reviewer can verify that this directory's `_parameters.md`,
`_section_tree_contract.md`, etc. match these template hashes by running
`shasum -a 256` on each file and comparing.
