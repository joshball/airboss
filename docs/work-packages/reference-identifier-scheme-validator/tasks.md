---
title: 'Tasks: Reference identifier scheme validator'
product: cross-cutting
feature: reference-identifier-scheme-validator
type: tasks
status: unread
review_status: pending
---

# Tasks: Reference identifier scheme validator

## Pre-flight

- [ ] Read [ADR 019](../../decisions/019-reference-identifier-system/decision.md) end-to-end. Pay close attention to §1, §1.1.1, §1.2, §1.3, §1.4, §1.5, §1.5.1, §1.6, §1.7, §2 (type signatures only), §3.1 (token recognition, not substitution), §3.4 (frontmatter acks).
- [ ] Read [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) for the storage tiers ADR 019 extends.
- [ ] Read this WP's [spec.md](spec.md) and [design.md](design.md).
- [ ] Read existing `libs/aviation/src/wikilink/parser.ts` to understand the in-prose-link parser pattern (skips fenced code, AST shape).
- [ ] Read `scripts/check.ts` and `scripts/references.ts` for the existing validation dispatch pattern.
- [ ] Read `libs/help/package.json` for a recent lib's `package.json` shape; mirror it.
- [ ] Read `course/regulations/week-04-part-91-general-and-flight-rules/overview.md` to confirm lesson frontmatter shape.

## Phase 1 - Lib skeleton + types

- [ ] Create `libs/sources/` workspace: `package.json` as `@ab/sources` with `private: true`, `type: module`. No external deps required for parser; `yaml` for frontmatter (already a project dep).
- [ ] Create `libs/sources/src/index.ts` barrel exporting public surface.
- [ ] Add `@ab/sources` and `@ab/sources/*` path aliases to root `tsconfig.json`.
- [ ] Add `libs/sources` to root `package.json` workspaces array (verify if already covered by `libs/*`; existing pattern says yes -- no change needed).
- [ ] Create `libs/sources/src/types.ts`:
  - `SourceId` (branded string type)
  - `SourceLifecycle` enum
  - `SourceEntry` per ADR 019 §2.1
  - `Edition` + `AliasEntry` per §6.1
  - `Severity`, `ValidationFinding`, `ParsedIdentifier`, `ParseError`, `RenderMode`
  - `RegistryReader` interface
  - `LessonAcknowledgment` (frontmatter ack shape per §3.4)
- [ ] Create `libs/sources/src/registry-stub.ts` with a `NULL_REGISTRY: RegistryReader` that returns null/false/empty for every method. Lets the validator instantiate a default reader for tests that don't need registry data.
- [ ] `bun run check` passes (svelte-check + biome run cleanly with the new lib in place).
- [ ] Commit: `feat(sources): scaffold @ab/sources lib + types`.

## Phase 2 - URI parser

- [ ] Create `libs/sources/src/parser.ts` with `parseIdentifier(raw: string): ParsedIdentifier | ParseError`:
  - Trim leading + trailing whitespace.
  - Reject path-absolute (`airboss-ref:/...`) with specific message.
  - Reject authority-based (`airboss-ref://...`) with specific message.
  - Accept canonical path-rootless form.
  - Recognise `unknown:` magic prefix; return `corpus: 'unknown'`.
  - Extract corpus, locator (opaque, multi-segment), pin (`?at=` query param, optional).
  - No relative URL resolution.
- [ ] Create `libs/sources/src/parser.test.ts`:
  - Path-rootless accepted (multiple shapes per §1.2 examples).
  - Path-absolute rejected.
  - Authority-based rejected.
  - Whitespace trimmed.
  - `unknown:` prefix recognised.
  - Multi-segment locators parsed.
  - Missing `?at=` parsed (pin is null; rule engine decides if that's an error).
  - Empty locator rejected at parser level.
  - Non-airboss-ref URLs rejected.
- [ ] `bun test libs/sources/` passes. `bun run check` clean.
- [ ] Commit: `feat(sources): URI parser per ADR 019 §1.1`.

## Phase 3 - Rule engine

- [ ] Create `libs/sources/src/validator.ts` with `validateIdentifier(parsed, registry, context): ValidationFinding[]`:
  - Implements all 15 rules from §1.5 in order.
  - Row 0 (`unknown:`) carve-out evaluated first.
  - Row 1 (parse + corpus + non-empty locator) checked next.
  - Rows 2-4 query the registry; default stub returns null/false so all three fire if no registry is passed.
  - Row 5 (`?at=unpinned`) WARNING.
  - Row 6 (stale pin) WARNING; uses `getEditionDistance`.
  - Rows 7-9 use lesson-context info (link text, bare URL, lazy text).
  - Rows 10-12 use `walkAliases`; row 10 silent, row 11 WARNING, row 12 ERROR.
  - Row 13 (superseded without ack) WARNING; uses `walkSupersessionChain` + the lesson-context ack list.
  - Row 14 (ack reason slug > 48 chars) NOTICE.
  - Emits exactly one ERROR per identifier (the first matching ERROR rule).
  - WARNING and NOTICE rules can fire alongside an ERROR.
- [ ] Create `libs/sources/src/validator.test.ts`:
  - Each rule fires correctly given matching input.
  - Row 0 takes priority over row 1 (`airboss-ref:unknown/foo` produces row-0 ERROR, not row-1).
  - Rules evaluate in order; an identifier matching multiple ERROR rules emits only the first.
  - All 5 §1.5.1 edge cases covered:
    - Future-pin -> row 3 ERROR.
    - Reserved section entry -> resolves normally; no special finding.
    - Newly-created section -> resolves normally.
    - Redacted section -> resolves normally (render-time NOTICE is Phase 4's concern).
    - CI on stale branch -> row 6 WARNING; non-blocking.
- [ ] `bun test libs/sources/` passes. `bun run check` clean.
- [ ] Commit: `feat(sources): rule engine per ADR 019 §1.5`.

## Phase 4 - Lesson Markdown parser

- [ ] Create `libs/sources/src/lesson-parser.ts`:
  - `parseLesson(filePath, source): LessonParseResult` returning frontmatter, identifier occurrences, and findings.
  - Splits frontmatter (YAML between `---` fences) from body.
  - Validates `acknowledgments` shape per §3.4.
  - Walks body for inline `[text](airboss-ref:...)` links.
  - Walks body for reference-style `[text][label]` + `[label]: airboss-ref:...` definitions.
  - Walks body for bare `airboss-ref:` URLs (NOTICE row 8).
  - Skips fenced code blocks and inline code spans.
  - Strips Markdown emphasis (`*`, `_`, `` ` ``) for row-7 emptiness check.
  - Detects lazy link text (matches canonical short form like `§91.103` without a token).
  - Emits ERROR for undefined reference labels.
  - Emits ERROR when one body link has no `id` but the lesson has multiple acks for the same target.
  - Emits orphan-ack WARNING for acks whose target isn't referenced in the body.
- [ ] Create `libs/sources/src/lesson-parser.test.ts`:
  - Frontmatter ack parsing (valid + malformed YAML cases).
  - Inline link extraction.
  - Reference-style link extraction + `id` binding.
  - Bare URL detection -> row 8 NOTICE.
  - Empty link text -> row 7 ERROR.
  - Lazy link text -> row 9 NOTICE.
  - Code block skip (identifier inside `` ``` ``  ignored).
  - Inline code skip.
  - Orphan ack -> WARNING.
  - Two acks same target, no `id` on body links -> ERROR.
  - Undefined reference label -> ERROR.
- [ ] `bun test libs/sources/` passes. `bun run check` clean.
- [ ] Commit: `feat(sources): lesson Markdown parser per ADR 019 §3.4`.

## Phase 5 - `bun run check` integration

- [ ] Create `libs/sources/src/check.ts` with `validateReferences(opts?): { errors, warnings, notices }`:
  - Walks every `.md` file under `course/regulations/**`.
  - Calls `parseLesson` on each.
  - For each found identifier, calls `validateIdentifier` with the default `NULL_REGISTRY` (Phase 2's registry replaces this when it ships).
  - Aggregates findings per severity.
  - Returns counts; caller decides exit code.
- [ ] Add the path-list constant `LESSON_CONTENT_PATHS` to `libs/sources/src/check.ts` (or a sibling file) for future expansion.
- [ ] Extend `scripts/check.ts` to call `validateReferences` after the existing `references` step. ERROR -> non-zero exit. WARNING / NOTICE -> print only.
- [ ] Add `airboss-ref` script entry to root `package.json` for manual invocation: `"airboss-ref": "bun -e 'await import(\"./libs/sources/src/check.ts\").then(m => m.runCli())"` (or a dedicated `scripts/airboss-ref.ts` thin wrapper -- decide during build).
- [ ] Verify `bun run check` exits 0 on the current `course/regulations/` set (no `airboss-ref:` URLs present today; should report `0 references checked`).
- [ ] Commit: `feat(sources): wire validateReferences into bun run check`.

## Phase 6 - Verification + smoke

- [ ] `bun run check` exits 0.
- [ ] All `bun test libs/sources/` tests pass.
- [ ] Existing svelte-check (1777 files) unaffected.
- [ ] Add a smoke test: place a temp `airboss-ref:` link inside a lesson, run `bun run check`, confirm ERROR; remove it; run again, confirm 0.
- [ ] Manual test per [test-plan.md](test-plan.md).
- [ ] Commit any documentation tweaks.

## Phase 7 - PR

- [ ] Stage files individually by name (no `git add -A`).
- [ ] Commit with descriptive message; no AI attribution.
- [ ] Push branch.
- [ ] Open PR with title `feat(sources): ADR 019 phase 1 -- airboss-ref: identifier validator`.
- [ ] PR body: link to ADR 019, link to this WP's spec/design/test-plan, summary of phases shipped, manual test plan reference.
- [ ] Update `docs/work/NOW.md` to note the validator is shipped, Phase 2 (registry-core) is next.
