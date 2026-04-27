---
title: 'Test plan: Reference identifier scheme validator'
product: cross-cutting
feature: reference-identifier-scheme-validator
type: test-plan
status: unread
review_status: pending
---

# Test plan: Reference identifier scheme validator

## Setup

- `libs/sources/` lib in place at `@ab/sources`.
- `bun run check` extended with `validateReferences()` step.
- `course/regulations/**` lesson set is the validation corpus.
- No registry data yet (Phase 2 fills it). Tests use fixture `RegistryReader` instances.

---

## Automated (Vitest)

### Parser tests (`libs/sources/src/parser.test.ts`)

| ID    | Scenario                                                                           | Expected                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| P-01  | `airboss-ref:regs/cfr-14/91/103?at=2026`                                           | `{ corpus: 'regs', locator: 'cfr-14/91/103', pin: '2026' }`                                                                    |
| P-02  | `airboss-ref:regs/cfr-14/91/103/b/1/i?at=2026`                                     | Multi-segment locator parsed; pin populated.                                                                                   |
| P-03  | `airboss-ref:ac/61-65/j` (slug-encoded edition, no `?at=`)                         | `{ corpus: 'ac', locator: '61-65/j', pin: null }` -- parser doesn't enforce pinning; that's row 1.                             |
| P-04  | `airboss-ref:/regs/cfr-14/91/103?at=2026` (path-absolute)                          | `ParseError` with message naming "path-absolute form is not canonical".                                                        |
| P-05  | `airboss-ref://regs/cfr-14/91/103?at=2026` (authority-based)                       | `ParseError` with message naming "authority-based form is not canonical".                                                      |
| P-06  | `  airboss-ref:regs/cfr-14/91/103?at=2026  ` (whitespace-padded)                   | Whitespace trimmed; parses cleanly.                                                                                            |
| P-07  | `airboss-ref:unknown/cost-sharing-letter`                                          | `{ corpus: 'unknown', locator: 'cost-sharing-letter', pin: null }`.                                                            |
| P-08  | `airboss-ref:` (no corpus, no locator)                                             | `ParseError`.                                                                                                                  |
| P-09  | `airboss-ref:regs/` (corpus only, empty locator)                                   | `ParseError`.                                                                                                                  |
| P-10  | `airboss-ref:regs/cfr-14/91/103?at=unpinned`                                       | `{ corpus: 'regs', locator: 'cfr-14/91/103', pin: 'unpinned' }`.                                                                |
| P-11  | `https://www.ecfr.gov/...` (non-airboss-ref URL)                                   | `ParseError` (or "not an identifier" return value -- caller distinguishes).                                                    |

### Validator tests (`libs/sources/src/validator.test.ts`)

| ID    | Scenario                                                                                              | Expected                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| V-00  | `airboss-ref:unknown/foo` -- row 0                                                                    | ERROR row 0 with the "transitional reference" message; row 1 NOT also fired.                                                                   |
| V-01  | Path-absolute string passed to validator                                                              | ERROR row 1 (parse failed).                                                                                                                    |
| V-02  | Identifier resolves to `accepted` entry (fixture registry)                                            | No row-2 finding.                                                                                                                              |
| V-02b | Identifier doesn't resolve (no registry entry)                                                        | ERROR row 2.                                                                                                                                   |
| V-03  | Pinned edition doesn't exist (registry has entry, no edition matching pin)                            | ERROR row 3.                                                                                                                                   |
| V-04  | Identifier resolves to `pending` entry                                                                | ERROR row 4 with message naming "pending review".                                                                                              |
| V-04b | Identifier resolves to `retired` entry                                                                | ERROR row 4 with message naming "retired".                                                                                                     |
| V-05  | `?at=unpinned`                                                                                        | WARNING row 5.                                                                                                                                 |
| V-06  | Pin > 1 edition older than current `accepted`                                                         | WARNING row 6.                                                                                                                                 |
| V-07  | Empty link text after stripping                                                                       | ERROR row 7.                                                                                                                                   |
| V-08  | Bare `airboss-ref:` in prose                                                                          | NOTICE row 8.                                                                                                                                  |
| V-09  | Lazy link text (e.g. `[91.103](airboss-ref:regs/cfr-14/91/103?at=2026)`)                              | NOTICE row 9.                                                                                                                                  |
| V-10  | Renumbering alias, content unchanged                                                                  | No finding (silent).                                                                                                                           |
| V-11  | Renumbering alias, content changed (`AliasEntry.kind === 'content-change'`)                            | WARNING row 11.                                                                                                                                |
| V-12  | Cross-section alias                                                                                   | ERROR row 12; resolver does NOT walk past the alias.                                                                                          |
| V-13  | Reference to superseded entry, no ack                                                                 | WARNING row 13.                                                                                                                                |
| V-14  | Ack reason slug 49+ chars                                                                             | NOTICE row 14.                                                                                                                                 |
| V-EX  | Identifier matches BOTH row 2 and row 5 (unresolved AND `?at=unpinned`)                               | One ERROR (row 2) + one WARNING (row 5). Two findings, exactly one ERROR.                                                                      |
| V-EX2 | Identifier matches row 2 and row 4 (unresolved -- but if it resolved would be `pending`)              | Only row 2 fires (it comes first).                                                                                                              |
| V-EDGE-1 | Future-pin                                                                                         | ERROR row 3.                                                                                                                                  |
| V-EDGE-2 | Reserved section entry                                                                              | Resolves; no special finding.                                                                                                                  |
| V-EDGE-3 | Newly-created section                                                                               | Resolves; no special finding.                                                                                                                  |
| V-EDGE-4 | Redacted section                                                                                    | Resolves; no row-13-style finding for redaction (Phase 4 handles render-time `[redacted]`).                                                    |
| V-EDGE-5 | Stale-branch CI rerun (pin > 1 edition stale)                                                        | WARNING row 6; does not block.                                                                                                                  |

### Lesson parser tests (`libs/sources/src/lesson-parser.test.ts`)

| ID    | Scenario                                                                                              | Expected                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| L-01  | Lesson with valid frontmatter `acknowledgments`                                                       | Acks parsed; no findings.                                                                                                                       |
| L-02  | Frontmatter YAML malformed                                                                            | ERROR with YAML parser's message + file location.                                                                                              |
| L-03  | Inline link `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)`                                          | Identifier extracted; link text `@cite` carried into context for downstream rules.                                                             |
| L-04  | Reference-style link with `[label]` and matching `[label]: airboss-ref:...`                            | Identifier extracted; label bound to ack with matching `id`.                                                                                   |
| L-05  | Reference-style link with undefined label                                                             | ERROR ("undefined reference label `<label>`").                                                                                                 |
| L-06  | Bare `airboss-ref:` URL in prose (no `[...](...)` wrapping)                                           | NOTICE row 8.                                                                                                                                   |
| L-07  | Identifier inside fenced code block                                                                   | Skipped; no finding.                                                                                                                           |
| L-08  | Identifier inside inline code span                                                                    | Skipped; no finding.                                                                                                                           |
| L-09  | Empty link text `[](airboss-ref:...)`                                                                 | ERROR row 7.                                                                                                                                    |
| L-10  | Link text emphasised: `[*foo*](airboss-ref:...)` -- not empty after strip                              | No row-7 finding.                                                                                                                               |
| L-11  | Lazy link text matching canonical short pattern                                                       | NOTICE row 9.                                                                                                                                   |
| L-12  | Orphan acknowledgment (target not in body)                                                            | WARNING.                                                                                                                                       |
| L-13  | Two acks same target, body links lack `id` labels                                                     | ERROR per §3.4 ("when one lesson has multiple acks for the same target, every binding link must have an explicit reference label").             |
| L-14  | Lesson with no `airboss-ref:` URLs anywhere (current state of every `course/regulations/` lesson)     | Zero findings, zero identifiers; clean parse.                                                                                                  |

### Integration tests (`libs/sources/src/check.test.ts`)

| ID    | Scenario                                                       | Expected                                                                              |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| C-01  | Run validator over an empty fixture lesson                     | 0 findings.                                                                          |
| C-02  | Run validator over a lesson with one ERROR                     | Returns 1 error, validateReferences exits non-zero (in CLI mode).                     |
| C-03  | Run validator over a lesson with WARNING + NOTICE (no ERROR)   | 0 errors; CLI exits 0; findings printed to stdout.                                    |
| C-04  | Run validator over current `course/regulations/**`             | 0 errors, 0 warnings, 0 notices, 0 identifiers (sanity check on shipped state).      |

---

## Manual gates

### M-1: Initial smoke -- empty corpus passes

1. Fresh checkout of branch.
2. Run `bun install`, then `bun run check`.
3. **Expected:** Check exits 0. The reference-identifier validator step prints "0 references checked, 0 findings" (or similar). All other checks pass as before.

### M-2: Insert a malformed identifier; check fails

1. Edit `course/regulations/week-04-part-91-general-and-flight-rules/overview.md`. Add a line with `[@cite](airboss-ref:/regs/cfr-14/91/103?at=2026)` (path-absolute).
2. Run `bun run check`.
3. **Expected:** Non-zero exit. Output names the file + line + the path-absolute error.
4. Revert the edit. Run `bun run check`.
5. **Expected:** Clean exit.

### M-3: Insert a path-rootless identifier with no registry entry

1. Add `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` to a lesson.
2. Run `bun run check`.
3. **Expected:** Non-zero exit with row-2 ERROR (registry has no entry; this is the expected Phase 1 behavior since the registry stub returns nothing).
4. Revert.

### M-4: Insert an `unknown:` identifier

1. Add `[@cite](airboss-ref:unknown/some-future-thing)` to a lesson.
2. Run `bun run check`.
3. **Expected:** Non-zero exit with row-0 ERROR carrying the "transitional reference; cannot publish" message.
4. Revert.

### M-5: Insert a `?at=unpinned` identifier

1. Add `[@cite](airboss-ref:regs/cfr-14/91/103?at=unpinned)` to a lesson.
2. Run `bun run check`.
3. **Expected:** Row-5 WARNING printed; check still exits non-zero because row 2 (registry stub returns nothing) ERROR also fires. Once Phase 2 lands and the registry has the entry, this becomes WARNING-only and check passes.

### M-6: Frontmatter ack with malformed YAML

1. Add `acknowledgments:` line followed by garbage YAML to a lesson's frontmatter.
2. Run `bun run check`.
3. **Expected:** Non-zero exit; YAML parser error + file location printed.
4. Revert.

### M-7: Orphan ack warning

1. Add a valid frontmatter `acknowledgments` entry whose `target` is not referenced anywhere in the lesson body.
2. Run `bun run check`.
3. **Expected:** WARNING printed naming the orphan target. ERROR is not raised (orphan is warning-tier this phase). Check still passes if no other ERROR.
4. Revert.

### M-8: Bare URL in prose

1. Add a line `See airboss-ref:regs/cfr-14/91/103?at=2026 for the rule.` (bare URL, not wrapped).
2. Run `bun run check`.
3. **Expected:** NOTICE row 8 printed. Check continues; ERROR for unresolved identifier (row 2) also fires. After Phase 2 lands and resolution succeeds, only NOTICE remains.
4. Revert.

### M-9: Identifier inside fenced code block ignored

1. Add a fenced code block containing `airboss-ref:regs/cfr-14/91/103?at=2026`.
2. Run `bun run check`.
3. **Expected:** No findings for that identifier. The validator skips fenced code per spec.

### M-10: Confirm legacy `[[display::id]]` validator still runs

1. Run `bun run check` on a clean branch.
2. **Expected:** Both `references` (legacy `[[id]]` system) and the new `validateReferences` step run side-by-side. Output has both sections. Both exit clean today.

---

## Definition of done

- All Vitest tests pass (`bun test libs/sources/`).
- All manual gates above pass.
- `bun run check` exits 0 on `main` after merge.
- 1777 svelte-check files unaffected.
- The PR body references this test plan and ADR 019 §1 + §1.5 + §1.5.1 + §3.4.
