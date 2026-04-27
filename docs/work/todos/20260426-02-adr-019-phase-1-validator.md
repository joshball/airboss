# 2026-04-26 -- ADR 019 phase 1: airboss-ref: identifier validator

## Goal

Build phase 1 of [ADR 019](../../decisions/019-reference-identifier-system/decision.md) per the signed-off work package at [docs/work-packages/reference-identifier-scheme-validator/](../../work-packages/reference-identifier-scheme-validator/spec.md). New `@ab/sources` lib with the URI parser, the 15-rule validator (§1.5), the lesson Markdown walker (§3.4), and `bun run check` integration.

## Shipped

| Phase | What landed |
| ----- | ------------------------------------------------------------------------------------------------- |
| 1     | `libs/sources/` skeleton + types + `NULL_REGISTRY` stub; `@ab/sources` path alias                 |
| 2     | `parser.ts` per §1.1 + §1.1.1; 20 vitest cases (path-rootless / path-absolute / authority / pin)  |
| 3     | `validator.ts` per §1.5 -- 15 rules in order, exclusivity, alias chain, ack-aware rules           |
| 4     | `lesson-parser.ts` per §3.4 -- frontmatter acks, inline+ref-style links, code skip, orphan acks   |
| 5     | `check.ts` walks `course/regulations/**`; `scripts/airboss-ref.ts` CLI; wired into `scripts/check.ts` |
| 6     | Smoke test inserted + reverted; 77 tests pass; `bun run check` clean                               |
| 7     | PR opened (TODO -- next step)                                                                      |

### Files

- `libs/sources/package.json`, `libs/sources/src/index.ts`
- `libs/sources/src/types.ts`, `libs/sources/src/registry-stub.ts`
- `libs/sources/src/parser.ts`, `libs/sources/src/parser.test.ts`
- `libs/sources/src/validator.ts`, `libs/sources/src/validator.test.ts`
- `libs/sources/src/lesson-parser.ts`, `libs/sources/src/lesson-parser.test.ts`
- `libs/sources/src/check.ts`, `libs/sources/src/check.test.ts`
- `scripts/airboss-ref.ts`
- `scripts/check.ts` (extended)
- `package.json` (`airboss-ref` script entry)
- `tsconfig.json` + `vitest.config.ts` (`@ab/sources` alias)

### Notes

- `course/regulations/` has zero `airboss-ref:` URLs today, so the validator scans 25 lessons and reports 0 identifiers, exit 0.
- Smoke verified by inserting `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` into a real lesson, confirming row-2 ERROR with `file:line:col`, then reverting.
- The validator's rows 2/3/4 always fire today against the `NULL_REGISTRY` stub; phase 2 (registry-core) replaces the stub with the constants table. No code change required in this lib.
- `--fix` mode (auto-stamp current accepted edition) is phase-2's responsibility per the WP spec.

## Follow-ups

- Phase 2 work package: `reference-source-registry-core` -- constants table + per-corpus resolvers + real `RegistryReader`.
- Phase 3+ corpora (CFR, AIM, ACs, handbooks, etc.) populate the registry.
- Phase 9 lesson migration sweeps `course/regulations/` to replace plain eCFR URLs with `airboss-ref:` URIs.
