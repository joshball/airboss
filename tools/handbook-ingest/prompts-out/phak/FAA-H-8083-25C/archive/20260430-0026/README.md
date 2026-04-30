# Section-extraction prompt run -- phak FAA-H-8083-25C

Run-id: `20260430-0026` (UTC). Generated at: `2026-04-30T00:26:40Z`.
Repository SHA: `85323539f32800ca05b2ece837083690b7e51c21`.

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
| `parameters.md`        | `98382dc434abff47c11794e2c662fd918d1076c2941918fcc9626bd44ace0ca0`      |
| `section_tree.md`      | `e33a1cf32fbd77f6176701c3bdf0fa7e7f7d7f47a66bd9882c7c8d5ef13c06ab`    |
| `orchestrator.md`      | `195626a542f5955b58ea92872c1a870d87d868ea464576f5f94dfeb2ded582c9`    |
| `chapter.md`           | `5f228948ada23f12c2985c9ab0f0337a8b5464fce980058f59184605f40e107a`         |
| `run_readme.md`        | `a1d2f860ef2cff522af1856ec463d5222582b1f54bcb53bd513deb495ffce68d`      |

A reviewer can verify that this directory's `_parameters.md`,
`_section_tree_contract.md`, etc. match these template hashes by running
`shasum -a 256` on each file and comparing.
