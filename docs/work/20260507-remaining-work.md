# 2026-05-07 -- remaining work

Append-only scratchpad for in-flight cleanup items. Each agent owns its own heading; do not edit other agents' sections.

## check.ts -- biome dispatch on tests/e2e files

`scripts/check.ts` `dirty` and `branch` profiles built a per-file list and passed it to `bunx biome check <files...>`. When every file in that list was excluded by `biome.json` `files.includes` (the canonical case: editing anything under `tests/e2e/**`), biome exited 1 with `× No files were processed in the specified paths`, failing the scoped check spuriously.

Fix: pass `--no-errors-on-unmatched` to the scoped biome invocation. Biome silences the "no files processed" error when every input is excluded; lint/format diagnostics on matched files still surface as exit 1 normally. The unscoped `quick`/`all` path (`bunx biome check .`) is untouched.

Verified with `git stash; touch tests/e2e/_tmp.spec.ts; bun run check`: exits 0 instead of 1.
