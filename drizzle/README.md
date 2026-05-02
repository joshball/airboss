# `drizzle/`

Generated migration artifacts for the Drizzle schema. **Read this before adding files here.**

## Operating rule: this project uses `db push`, not `db migrate`

Both dev (`bun run db reset`) and the hosted deploy use `drizzle-kit push`, which diffs `libs/**/schema.ts` against the live DB and applies the delta directly. **Nothing in this folder is read at deploy time.** The runtime schema source of truth is the TypeScript schema files, not the SQL here.

That means:

- `_journal.json` and `0000_initial.sql` are advisory snapshots that exist so `drizzle-kit generate` can compute future diffs accurately.
- The migrate path (`drizzle-kit migrate`) is dormant. If we ever revive it, we will regenerate this folder from a clean baseline first.

## Adding schema changes

1. Edit the relevant `libs/**/schema.ts` (or `apps/**` schema if applicable).
2. Run `bun run db reset` -- this drops and recreates the DB from the TS schema. Done.
3. Optionally, run `bunx drizzle-kit generate --name=<descriptive_slug>` to update this folder for future-diff accuracy.

## Things NOT to do

- Do **not** hand-write a `0001_*.sql` (or any other numbered migration) and skip the journal update. Drizzle-kit's `0000_initial` is the entire source of truth; the only legitimate way to add a new file here is via `drizzle-kit generate`.
- Do **not** add `IF NOT EXISTS` or other idempotency guards to migrations as a workaround for the broken migrate path. The fix is to regenerate from TS, not to make broken migrations safe-to-replay.
- Do **not** commit a snapshot without its journal entry, or vice versa. They are co-generated; if you have one, you have both.

## History

The 11 migrations in `0000-0009` were collapsed into a single fresh `0000_initial` in PR #445 because four prior PRs (#426, #434, #436, #437, #439) had each added a `.sql` file without journaling it, and one PR caused a duplicate `0007_*` prefix collision. The collapse is verified to include every column, index, FK, CHECK, and schema namespace from the deleted files (grepped against each PR's contributions). PR #449 absorbed #448's `0010_hangar_job_log_seq_unique` into `0000_initial` and added this README.
