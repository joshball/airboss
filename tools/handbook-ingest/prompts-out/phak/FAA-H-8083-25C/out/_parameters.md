# Section-extraction parameters (single source of truth)

This file is the only place where the agent rules live. The orchestrator
(`_run.md`) references this file rather than restating the rules; the
per-chapter prompts cite the JSON contract (`_section_tree_contract.md`) as
their output shape. Keep all per-run discipline in this one file.

## Sub-agent type

Dispatch every per-chapter prompt as a `general-purpose` sub-agent. The
prompts are fully self-contained -- they do not require a specialized
agent.

## Parallel dispatch in a single message

The orchestrator runs in a fresh, separate Claude Code session opened by
the user (NOT in the airboss session that emitted the prompt set). In that
fresh session, send all N per-chapter sub-agent invocations in a SINGLE
tool-call block to maximize parallelism.

Sequential dispatch is forbidden:

- It negates the per-chapter speedup (one chapter's worth of latency vs N).
- It burns parent context per dispatch round.

## Sub-agent return contract

Each sub-agent MUST return exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/<doc>/<edition>/<NN>/_llm_section_tree.json (model: {self-reported})`
- Failure:
  `error: {one-sentence reason}`

Specific error formats the contract requires:

- Sidecar SHA-256 mismatch: `error: sidecar SHA-256 mismatch -- expected <expected>, got <observed>`
- Coverage shortfall (the last entry's page anchor is more than one page short of the chapter's last printed page AND the trailing pages contain at least one body-text heading the sub-agent failed to emit): `error: incomplete coverage -- last anchor at <anchor>, expected on-or-after <last_page>`. Trailing figure-only / caption-only / blank pages do NOT trigger this error -- see the contract's coverage self-check.

The parent collates these into a final summary report listing which
chapters succeeded, which failed, total entries written, and which models
the sub-agents self-reported.

## No retries inside a sub-agent

If a sub-agent fails (malformed model output, sidecar unreadable, sidecar
SHA-256 mismatch), it returns the error status line. The parent does NOT
retry. The user re-pastes the failing chapter's prompt manually if a retry
is wanted.

## Sub-agent file-write rules

Each sub-agent writes up to THREE files inside its chapter's directory:

1. `handbooks/<doc>/<edition>/<NN>/_llm_section_tree.json` -- REQUIRED.
   The strict-JSON section tree (per the contract in
   `_section_tree_contract.md`). One trailing newline.
2. `handbooks/<doc>/<edition>/<NN>/_model_self_report.txt` -- REQUIRED.
   A one-line file containing the model the sub-agent self-reports running
   on (e.g. `claude-opus-4-7`). One trailing newline.
3. `handbooks/<doc>/<edition>/<NN>/_llm_disagreements.json` -- OPTIONAL.
   A JSON array per the contract's DISAGREEMENTS schema. Written only
   when the per-chapter prompt's TOC checklist is non-empty AND the
   sub-agent disagrees with the parser on at least one entry (level,
   parent, anchor, missing in body, or extra in TOC). Skipped entirely
   when the checklist is empty or when the sub-agent fully agrees.

The sub-agent MUST NOT modify any other file:

- Do NOT touch the sidecar (`_chapter_plaintext.txt`).
- Do NOT write under `tools/handbook-ingest/prompts-out/`.
- Do NOT write in any other chapter's directory.
- Do NOT write the chapter's overview file (`00-<chapter-slug>.md`) or any per-section markdown files.

## Sidecar verification

Before reading a chapter's `_chapter_plaintext.txt`, the sub-agent MUST
compute its SHA-256 and compare against the `{sidecar_sha256}` value
embedded in its prompt. On mismatch, return:

`error: sidecar SHA-256 mismatch -- expected {expected}, got {observed}`

This defends against partial writes, stale sidecars, and accidental
hand-edits between emit time and run time.

## Output discipline

The sub-agent's response (the status line) is for the parent. The actual
JSON section tree is written to disk only -- never echoed back to the
parent. This keeps each sub-agent's output small and the parent's collation
compact.

## Strict JSON contract

The shape of `_llm_section_tree.json` is defined in
`_section_tree_contract.md` (the snapshot of `section_tree.md` taken at
emit time). The sub-agent reads that file as its output specification.

No markdown fencing, no prose, no leading/trailing whitespace beyond a
single trailing newline.
