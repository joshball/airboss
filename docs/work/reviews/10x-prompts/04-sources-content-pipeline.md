# Chunk 4 -- Sources and content pipeline

Paste the block below as the first message in a fresh Claude Code session.

---

```text
/ball-review-10x

Scope is locked. Do NOT re-negotiate it -- review exactly what is listed below.

## What to review
The source ingest and content rendering pipeline. This is a broad surface -- pace the reviewers accordingly.

- `libs/sources/src/` -- entire directory:
  - Top-level: `bootstrap.ts`, `check.ts`, `fix.ts`, `parser.ts`, `lesson-parser.ts`, `snapshot.ts`, `validator.ts`, `types.ts`, `index.ts`, `registry-stub.ts`
  - Subdirs: `ac/`, `acs/`, `aim/`, `asrs/`, `diff/`, `forms/`, `handbooks/`, `handbooks-extras/`, `info/`, `interp/`, `ntsb/`, `orders/`, `pdf/`, `plates/`, `pohs/`, `pts/`, `registry/`, `regs/`, `render/`, `safo/`, `sectionals/`, `statutes/`, `tcds/`
  - All co-located tests
- `libs/aviation/src/` -- aviation reference registry, sources, glossary
- `tools/` -- python ingest scripts, theme-lint, theme-codemod (review for security and correctness; full code-quality review on python is lower priority -- focus on the bun/ts pieces)
- `scripts/sources/`, `scripts/references/`, `scripts/setup/` if present -- bun-driven CLI dispatchers that drive the pipeline
- `course/knowledge/`, `course/regulations/` content schemas (only the schema/manifest definitions, not the content itself)

## What is NOT in scope
- Source bytes themselves (PDFs, audio masters) -- these live in the developer-local cache per ADR 018. Don't review content quality.
- The actual aviation content in `course/` (knowledge nodes, regulations) -- reviewed separately if at all.
- `libs/bc/study/handbooks.ts`, `handbooks-errata.ts` -- those consume the pipeline but are reviewed in chunk 2.
- App routes that render sources (`apps/study/src/routes/(app)/handbooks/`, `references/`) -- chunk 1.

If pipeline code calls into other libs, READ for context but do not raise findings outside `libs/sources/`, `libs/aviation/`, and the relevant scripts.

## Project context the reviewers must respect
- Read `CLAUDE.md` at repo root.
- Read ADR 018 (`docs/decisions/018-source-artifact-storage-policy/decision.md`) and `docs/platform/STORAGE.md` -- source bytes live in `~/Documents/airboss-handbook-cache/` (override via `AIRBOSS_HANDBOOK_CACHE`). LFS plumbing is dormant. Extracted derivatives (markdown, figure PNGs, table HTML, manifest.json) stay inline. Generated artifacts (DB rows, indexes) stay out of repo.
- Read `docs/agents/section-extraction-prompt-strategy.md` for the paste-to-Claude flow used by ingest.
- Read `docs/agents/reference-citations-pattern.md` for citation rendering rules.
- Hard rules: no raw SQL, no `any`, no magic strings, `@ab/*` aliases, IDs via `createId()`.

## Reviewers to launch (floor -- detect stack and add more if appropriate)
Core: correctness, security, perf, architecture, patterns, testing, dx.
Stack-specific: schema (registry tables), backend (some pipeline pieces are server-only).
Domain: include a security reviewer with a sharp eye on the paste-to-Claude flow (prompt-injection risk in user-provided source text, path traversal in cache lookups, file-system writes outside the cache root).
Skip: ux, svelte (no UI here), a11y, tauri/rust/dotnet/maui.

## Spec context
Check `docs/work-packages/` for ingest-, handbook-, regulations-, citations-related packages. Check `docs/decisions/` for ADRs 011, 018, and any others touching sources or content. Pass matching content to the relevant agents.

## Output
Each agent writes one review file to `docs/work/reviews/{YYYY-MM-DD}-sources-content-pipeline-{category}.md`. After all agents complete, build the summary table and report findings. Do NOT auto-fix -- present the punch list and await my call on `/ball-review-fix`.
```
