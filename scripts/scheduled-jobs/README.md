# Scheduled jobs

This directory holds locally-scheduled, repo-scoped jobs. Each subdirectory is one job.

Use the manager to register jobs with launchd:

```bash
scripts/scheduler/list.sh                  # what's installed
scripts/scheduler/new-job.sh <name>        # scaffold a new job
scripts/scheduler/install.sh               # register all enabled jobs
scripts/scheduler/uninstall.sh             # unregister all jobs in this repo
```

If `package.json` was wired up at install time, equivalent commands are available
as `bun run schedule`, `bun run schedule new <name>`, etc.

See `~/src/_me/ai/agent-skills/skills/scheduled-jobs/SKILL.md` for the full skill docs.
