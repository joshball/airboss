# 2026-05-07 -- remaining work

Append-only scratchpad for in-flight cleanup items. Each agent owns its own heading; do not edit other agents' sections.

## check.ts -- biome dispatch on tests/e2e files

`scripts/check.ts` `dirty` and `branch` profiles built a per-file list and passed it to `bunx biome check <files...>`. When every file in that list was excluded by `biome.json` `files.includes` (the canonical case: editing anything under `tests/e2e/**`), biome exited 1 with `× No files were processed in the specified paths`, failing the scoped check spuriously.

Fix: pass `--no-errors-on-unmatched` to the scoped biome invocation. Biome silences the "no files processed" error when every input is excluded; lint/format diagnostics on matched files still surface as exit 1 normally. The unscoped `quick`/`all` path (`bunx biome check .`) is untouched.

Verified with `git stash; touch tests/e2e/_tmp.spec.ts; bun run check`: exits 0 instead of 1.

## schema review tail items captured (2026-05-08)

Tail items from [docs/work/reviews/2026-05-06-full-schema-consistency-flexibility-efficiency.md](reviews/2026-05-06-full-schema-consistency-flexibility-efficiency.md) that had no durable home are now captured.

- Items M, P, Q, R, S, W landed in [ADR 026 §Out of scope](../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work) with explicit trigger conditions.
- Items L (string-list `text[]` vs `jsonb<string[]>` convention) and O ("completed at" column naming convention) landed in [docs/agents/best-practices.md §"Schema conventions"](../agents/best-practices.md#schema-conventions) with canonical examples and current-state notes.

Tracking complete; the schema review's tail no longer lives in transient docs.
