# Section-extraction orchestrator -- {document_slug} {edition}

You are about to fan out section-extraction sub-agents for the
`{document_slug}` handbook ({edition}). Dispatch the sub-agents per the
rules in `_parameters.md`, validate their outputs, and ship a PR back to
main.

This file can be invoked any way the user chooses: pasted into a fresh
Claude Code window, piped via `claude < _run.md`, or read-and-executed
on instruction in any session. Whatever brought you here, the work is
the same.

## Step 0 -- isolate yourself in a worktree

Before dispatching anything, check whether you're already in a git
worktree dedicated to this run:

```bash
pwd
```

If `pwd` already contains `.claude/worktrees/`, you're isolated --
proceed to Step 1.

If `pwd` is the main repo root, **isolate yourself first**. The 17
chapter sub-agents will run in parallel for many minutes; running them
in the main checkout exposes the work to other agents that may stash,
restore, or `git restore` files mid-run.

Use the `/ball-worktree` skill (or equivalently `Agent(isolation:
"worktree")`) to dispatch THIS SAME ORCHESTRATOR FILE inside a fresh
worktree off `main`. The worktree-launched copy of you sees `pwd`
contains `.claude/worktrees/` and proceeds. The original copy of you
exits cleanly with a one-line "dispatched orchestrator into worktree
`<worktree-id>`; awaiting completion" -- no further action by the original copy.

If neither `/ball-worktree` skill nor `Agent(isolation: "worktree")` is
available in your runtime, tell the user: "I cannot self-isolate in
this runtime. Either run me from a worktree manually (`git worktree
add ...`), or accept that other agents in the main repo may interfere
during the ~10-30 minute extraction window."

## Step 1 -- read the parameters

Read `_parameters.md` in the same directory as this file:

`tools/handbook-ingest/prompts-out/{document_slug}/{edition}/out/_parameters.md`

That file is the single source of truth for sub-agent type, parallel
dispatch, return contract, file-write rules, sidecar verification, and
output discipline. The rules are NOT restated here -- read them there.

You will also reference the JSON output contract at
`tools/handbook-ingest/prompts-out/{document_slug}/{edition}/out/_section_tree_contract.md`.
Each per-chapter prompt already points at it; you don't need to load it
yourself before dispatch.

## Step 2 -- dispatch

Send all {chapter_count} per-chapter prompts in a SINGLE tool-call block
(parallel dispatch -- see `_parameters.md`). Each invocation hands the
sub-agent the contents of one of these files:

{chapter_prompt_paths}

Each sub-agent writes exactly two files in its chapter directory:

- `handbooks/{document_slug}/{edition}/<NN>/_llm_section_tree.json`
- `handbooks/{document_slug}/{edition}/<NN>/_model_self_report.txt`

Each sub-agent MUST emit `_model_self_report.txt` (a one-line file naming
the model the sub-agent self-reports running on). The compare step
depends on it.

## Step 3 -- collate

After all sub-agents return, render a brief summary listing:

- Total chapters: {chapter_count}
- Per-chapter status (ok / error + reason)
- Total entries written across all chapters
- Per-chapter model self-report

If any chapter returned an error, name it explicitly and STOP. Do NOT
retry from this orchestrator (per `_parameters.md`). Surface the failure
to the user; they re-paste that single chapter's prompt to retry, after
which they re-invoke this orchestrator (or just the validate-and-ship
steps below) to continue.

## Step 4 -- validate

Run the compare step inside the worktree:

```bash
bun run sources extract handbooks {document_slug} --edition {edition} --strategy compare
```

This reads each chapter's `_llm_section_tree.json` + `_model_self_report.txt`,
runs the deterministic TOC strategy against the same source, and produces
a markdown comparison report at
`tools/handbook-ingest/reports/{document_slug}-{edition}-compare-<run-id>.md`.

The compare report is the validation gate. Inspect:

- Are chapter counts consistent between LLM and TOC?
- Are section ordinals continuous (no gaps, no duplicates)?
- Are page-anchor ranges (`first_page`, `last_page`) plausible?

If the compare report shows obvious failures (chapter count drift, large
section-count gaps, wildly wrong page anchors), STOP and surface the
report to the user. Do not ship a PR with broken extractions.

## Step 5 -- check + ship

If validation passes:

```bash
bun run check
```

Must be clean.

Then commit, push, and open a PR back to main:

```bash
git add handbooks/{document_slug}/{edition}/ \
        tools/handbook-ingest/prompts-out/{document_slug}/{edition}/ \
        tools/handbook-ingest/reports/
git commit -m "chore({document_slug}): LLM section trees ({edition})

<short summary: chapter count, total entries, model used>"
git push -u origin <branch>
gh pr create --title "chore({document_slug}): LLM section trees ({edition})" --body "..."
```

PR body should include:

- Chapter count
- Total entries written
- Model self-report (one model per chapter; usually all the same)
- Compare-report path
- Confirmation that `bun run check` passed

**Do NOT auto-merge.** Output the PR URL and stop. The user reviews the
diff (especially the compare report) and merges manually if everything
looks right.

## Final report

When the PR is open and awaiting review, your final message to the user
is one short paragraph:

- "PR opened: `<pr-url>`"
- Chapter count + entries + model
- Compare report path
- "Worktree at `<worktree-path>`; remove with `git worktree remove <worktree-path>` after the PR is merged."

Begin Step 0 now.
