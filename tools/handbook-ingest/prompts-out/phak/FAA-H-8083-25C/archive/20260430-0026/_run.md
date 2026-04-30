# Section-extraction orchestrator -- phak FAA-H-8083-25C

You are running in a **FRESH Claude Code session** that the user has opened
specifically to fan out section-extraction sub-agents for the
`phak` handbook (FAA-H-8083-25C). Do NOT confuse this with the
airboss session that emitted these prompts; that session must not Agent-
dispatch this orchestrator (the no-key flow requires the user's own
paste-driven session, and the airboss session would burn its own context).

If you were dispatched as a sub-agent from the emitting airboss session,
STOP. Tell the user to open a fresh Claude Code window in the airboss repo
root and paste the `_run.md` file from
`tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_run.md`
as the first user message there.

## Read first

Before dispatching anything, read `_parameters.md` in the same directory as
this file:

`tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_parameters.md`

That file is the single source of truth for sub-agent type, parallel
dispatch, return contract, file-write rules, sidecar verification, and
output discipline. The rules are NOT restated here -- read them there.

You will also reference the JSON output contract at
`tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md`.
Each per-chapter prompt also points at it; you don't need to load it
yourself before dispatch.

## Dispatch

Send all 17 per-chapter prompts in a SINGLE tool-call block
(parallel dispatch -- see `_parameters.md`). Each invocation hands the
sub-agent the contents of one of these files:

- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/01-introduction-to-flying.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/02-aeronautical-decision-making.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/03-aircraft-construction.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/04-principles-of-flight.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/05-aerodynamics-of-flight.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/06-flight-controls.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/07-aircraft-systems.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/08-flight-instruments.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/09-flight-manuals-and-other-documents.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/10-weight-and-balance.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/11-aircraft-performance.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/12-weather-theory.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/13-aviation-weather-services.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/14-airport-operations.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/15-airspace.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/16-navigation.md`
- `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/17-aeromedical-factors.md`

Each sub-agent writes exactly two files in its chapter directory:

- `handbooks/phak/FAA-H-8083-25C/<NN>/_llm_section_tree.json`
- `handbooks/phak/FAA-H-8083-25C/<NN>/_model_self_report.txt`

Each sub-agent MUST emit `_model_self_report.txt` (a one-line file naming
the model the sub-agent self-reports running on). The orchestrator's
final summary depends on it; the airboss `--strategy compare` step also
reads it.

## Collate

After all sub-agents return, render a brief summary listing:

- Total chapters: 17
- Per-chapter status (ok / error + reason)
- Total entries written across all chapters
- Per-chapter model self-report

If any chapter returned an error, name it explicitly. The user will re-
paste that single chapter's prompt to retry; do NOT retry from this
orchestrator (per `_parameters.md`).

## Follow-up command

Once every chapter has both files written, the user runs (in the airboss
session, not this fresh session):

```bash
bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy compare
```

That command reads each chapter's JSON + model-self-report, runs the
deterministic TOC strategy, and produces a markdown comparison report.

Begin dispatch now.
