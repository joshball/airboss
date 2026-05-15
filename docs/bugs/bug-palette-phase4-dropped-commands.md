---
id: bug-palette-phase4-dropped-commands
title: "Palette Phase 4 dropped 3 commands awaiting upstream routes"
product: platform
severity: minor
status: wontfix
discovered_pr: 940
discovered_date: 2026-05-13
fix_pr: 994
fix_wp: command-palette
tags:
  - palette
  - phase-4
  - api-gap
---

# Palette Phase 4 dropped 3 commands awaiting upstream routes

## Context

Phase 4 (PR #940) shipped per-app palette commands for study/sim/hangar/flightbag. Per the WP brief ("be honest about what's wired"), the agent dropped 3 commands rather than invent routes that don't exist yet:

| App    | Dropped command | Reason                                              |
| ------ | --------------- | --------------------------------------------------- |
| sim    | Start new sim   | Redundant with existing nav; no route gap           |
| sim    | Resume last sim | No `last-active-attempt` pointer in `study.session` |
| hangar | New doc         | `/docs` is a read-only viewer surface               |

## Impact

Cmd+Shift+P in sim shows only "Pick scenario." In hangar shows only "Open audit log" + "Invite user" (whichever subset survived). These apps feel thinner than their pals; the gap is honest, not a bug.

Low severity because:

- Every CFI tool that DOES have a wired command works
- The mode itself functions correctly across all 4 apps
- Adding more commands is mechanical once the upstream routes / pointers land

## Fix per dropped command

### sim: "Resume last sim"

Needs a `lastActiveAttemptId` projection on `study.user` (or wherever the active-session pointer lives). When the user starts a sim, write the attempt id; when they close cleanly, clear it.

1. Add `lastSimAttemptId: text('last_sim_attempt_id')` column to user / preferences (greenfield schema edit)
2. Hook into `study.session` lifecycle in the sim app to write/clear
3. Wire the command in `apps/sim/src/lib/palette/commands.ts`:

   ```ts
   {
     id: 'sim.resume-last-sim',
     type: 'cmd.goto',
     label: 'Resume last sim',
     keywords: ['resume', 'continue', 'sim'],
     surface: APP_IDS.SIM,
     handler: () => { void goto(ROUTES.SIM_ATTEMPT(lastAttemptId)); },
   }
   ```

4. Disable / hide when `lastSimAttemptId === null`

### sim: "Start new sim"

Today `/sim/scenarios` is the canonical entry point. The "Start new sim" command is either redundant with "Pick scenario" OR it should jump directly to a "default scenario / quick-start" path. Decide product shape first:

- If "start with the most recent scenario type": same prerequisite as Resume last sim
- If "open the scenarios picker": redundant with Pick scenario; drop permanently

### hangar: "New doc"

Today `apps/hangar/src/routes/docs/` is read-only. Authored docs come from `docs/work-packages/<wp>/` + `docs/bugs/`; they're filesystem-backed. There IS no "new doc" route.

If the team wants a hangar-side doc-authoring surface:

1. Decide on shape (CMS-style, scaffold-from-template, etc.)
2. Build the route + form
3. Wire the command

Otherwise: drop permanently. The command was speculative.

## Trigger to revisit

Each command has its own trigger:

- Resume last sim: when sim attempt lifecycle gets persistent state
- Start new sim: when product decides whether this differs from Pick scenario
- New doc: when hangar gains an authoring surface (no current PRD for this)

## Related

- PR #940 -- Phase 4 ships with these commands DROPPED + TODO comments in source
- Work package: [command-palette](../work-packages/command-palette/spec.md)

## Resolution

**Closed as `wontfix`.** All three originally-dropped commands stay intentionally dropped. The Phase 4 agent's decision was correct.

### What happened

The dispatcher audited the upstream and incorrectly concluded that "Resume last sim" was implementable today via the existing `simAttempt` table -- on the theory that an in-flight attempt could be identified by a row with `endedAt = null`. That premise is wrong:

- `simAttempt.endedAt` is `.notNull()` (`libs/bc/sim/src/schema.ts:78`). The table only records COMPLETED attempts.
- `recordSimAttempt` is the only write surface (`libs/bc/sim/src/persistence.ts:49`); it inserts a complete row with all terminal-state fields. There is no "begin attempt" insert path.
- The POST route at `apps/sim/src/routes/[scenarioId]/attempt/+server.ts:62` is a POST-on-completion handler, not a session-start handler.

There is no "in-flight" / "last-active" concept in the schema today. The original Phase 4 drop reasoning ("no `last-active-attempt` pointer") stands.

### Disposition per command

| Command         | Disposition   | Why                                                                                                                                                                                                                                                       |
| --------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start new sim   | Stays dropped | Original reasoning correct -- redundant with the shipped "Pick scenario" command. There is no separate "quick-start" surface to route to.                                                                                                                 |
| Resume last sim | Stays dropped | Requires a sim-attempt lifecycle redesign: either (a) a new "begin attempt" write surface that creates an in-flight row, or (b) making `simAttempt.endedAt` nullable plus a lifecycle hook chain. Either path is a feature work-package, not a bug close. |
| New doc         | Stays dropped | Original reasoning correct -- `/docs` is a filesystem-backed read-only viewer. Authoring is via the WP + file-edit flow on disk, not a UI surface.                                                                                                        |

### Reopen trigger

Reopen this bug only if someone authors a feature work-package for sim in-flight attempts (e.g. mid-session pause + resume, or "Continue where you left off"). At that point the schema lifecycle redesign is in scope and "Resume last sim" becomes a natural addition to the palette.
