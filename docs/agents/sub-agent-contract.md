# Sub-agent terminal-report contract

The contract every sub-agent dispatched via the Agent tool must satisfy when it returns control. If you're writing a dispatch prompt, drop the boilerplate block below into it. If you're a sub-agent reading this: the dispatcher cannot recover work you didn't commit, so don't make them.

## Why this exists

Real failure mode 2026-05-07: a sub-agent set up a YAML edit, ran the seeder, didn't commit, didn't push, didn't open a PR, and returned `0 bytes`. The dispatcher had to fish unstaged work out of the worktree and finish it inline. That defeats the purpose of delegation -- the dispatcher pays the cost of the agent (context switch, prompt latency, tool round-trips) and then pays the cost of the work too.

A sub-agent that exits silently with staged-but-uncommitted state is worse than one that didn't run at all.

## The contract

Every sub-agent must end with one of exactly two outcomes:

- **A. PR URL.** The work is committed, pushed, a PR is open, and (if instructed) merged. Report the URL and the final state (`OPEN` / `MERGED`).
- **B. BLOCKER.** A specific obstacle the sub-agent could not resolve, with the exact decision the dispatcher needs to make. Include what was tried, what was observed, and what's needed.

No third outcome. "0 bytes," "should work," "looks good," "I think it's done" are all contract violations.

## Anti-patterns

- Silent exit with staged-but-uncommitted work.
- "Looks done" or "should work" without verification (`bun run check` clean, browser load if browser-only, gh pr view to confirm state).
- Reporting only the success path -- no blocker description even when blocked.
- Asking the dispatcher questions instead of trying the obvious next step first. If the answer is reachable by reading a file or running a command, do that first.
- Reporting the PR was opened but not the final state after merge attempt.
- Cleaning up the dispatcher's worktree from inside it.

## Dispatch prompt boilerplate

Drop this block into every Agent prompt that's expected to ship a PR:

> ## TERMINAL REPORT CONTRACT
>
> End with one of exactly two outcomes:
> A. PR URL (opened, merged).
> B. BLOCKER (specific, with the decision needed).
> Do NOT silently exit with staged-but-uncommitted work.

## Recovery when a sub-agent breaks the contract

Do not re-dispatch blind. Walk the worktree first.

1. `cd` into the sub-agent's worktree (`.claude/worktrees/<id>`) and run `git status`, `git log --oneline -10`, `git diff --stat HEAD`.
2. Determine if the work is salvageable:
   - Edits look correct → finish inline (commit, push, PR, merge).
   - Edits are incomplete or wrong → inspect and decide: finish inline, or revert and re-dispatch with a tightened prompt that names the missing step.
3. If re-dispatching, name the step that was skipped. "Open the PR and merge it" is more useful than the original prompt that already said the same thing -- the tightening signal is naming the failure mode.
4. Clean up the worktree only after the work has shipped.
