# Section-extraction prompt run -- phak FAA-H-8083-25C

Run-id: `20260430-1349` (UTC). Generated at: `2026-04-30T13:49:42Z`.
Repository SHA: `471e4da3145a45a8cc8ca9a67cb1669d808c1d4d`.

## What this run is

A snapshot of every input that shapes the section-extraction prompt flow
for handbook `phak` (edition `FAA-H-8083-25C`). The user pastes
`_run.md` into a fresh Claude Code session; sub-agents fan out one-per-
chapter and write `_llm_section_tree.json` + `_model_self_report.txt`
into each chapter directory under `handbooks/phak/FAA-H-8083-25C/`.

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
bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy prompt
```

(Add `--no-archive` to skip the `archive/<run-id>/` snapshot. Default is
to archive every run.)

## How to replay

1. Open a FRESH Claude Code session in the airboss repo root (not the
   session that emitted this run; the no-key flow requires a separate
   paste-driven session).
2. Paste the contents of `_run.md` as the first user message there.
3. Wait for sub-agents to finish writing
   `handbooks/phak/FAA-H-8083-25C/<NN>/_llm_section_tree.json` and
   `handbooks/phak/FAA-H-8083-25C/<NN>/_model_self_report.txt` for
   every chapter.
4. In the airboss session (NOT the fresh one), run:

   ```bash
   bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy compare
   ```

   That reads the per-chapter JSONs, runs the deterministic TOC strategy,
   and writes a markdown comparison report under
   `tools/handbook-ingest/reports/`.

## Templates as of this run

| Template               | SHA-256                       |
| ---------------------- | ----------------------------- |
| `parameters.md`        | `dbc9ce5a5da82828629df64d61404bbd7675ba84dae0d3fee28a124138298088`      |
| `section_tree.md`      | `d8f6232a32cbe277cb295063e38727cdc586c9dec8be8915f4e519107d13d263`    |
| `orchestrator.md`      | `21b7e9afaf62f136b6df84e71d4c61a8e94d3b2d3494d9fcced9c86291732d2f`    |
| `chapter.md`           | `7057819c8f45abecbd961ac9571deb92cfa828f120020eee9748b043417fcf6f`         |
| `run_readme.md`        | `a1d2f860ef2cff522af1856ec463d5222582b1f54bcb53bd513deb495ffce68d`      |

A reviewer can verify that this directory's `_parameters.md`,
`_section_tree_contract.md`, etc. match these template hashes by running
`shasum -a 256` on each file and comparing.
