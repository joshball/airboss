# test-lint

Test-quality linter. Catches weak/redundant assertion patterns at PR time.

## Rules

### `no-toBeTruthy-on-existence`

Flags `.toBeTruthy()` in test files. Two failure modes:

1. **Redundant on testing-library queries** — `expect(screen.getByTestId(x)).toBeTruthy()`
   is dead weight; `getByTestId` already throws on miss. Prefer `.toBeInTheDocument()`,
   or assert the actual shape (`.tagName`, `.textContent`, `.getAttribute(...)`).
2. **Tautology on values** — `expect(scenario.title).toBeTruthy()` passes on `' '`,
   `'0'`, `0`, `[]` (empty array is truthy), and any non-empty string. The intent
   is almost always "non-empty" — use `.toMatch(/.../)` or `.toBeGreaterThan(0)`.

The chunk-5 review of 2026-05-02 flagged ~30 sites. We froze the existing 89 sites
in `ignore.txt` rather than burn a one-shot codemod that produced visual cleanup
without behavior change. New occurrences are blocked by `bun run check`.

## Usage

```sh
bun tools/test-lint/bin.ts          # lint current tree
bun tools/test-lint/bin.ts --fix-ignore  # rewrite ignore.txt (use after a sweep)
bun tools/test-lint/bin.ts --json    # machine-readable output
```

## Ignore file

`ignore.txt` has one violation per line: `<relative-path>:<line>:<rule>`. Each
ignore is a deliberate grandfather. When you touch a file with an ignore, fix
the violation rather than re-adding the ignore.

## How to fix

| Pattern                                       | Replacement                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `expect(getByTestId(x)).toBeTruthy()`         | `expect(getByTestId(x)).toBeInTheDocument()`                                              |
| `expect(querySelector(x)).toBeTruthy()`       | `expect(querySelector(x)).toBeInTheDocument()` (after import)                             |
| `expect(value).toBeTruthy()` (string)         | `expect(value).toMatch(/non-empty pattern/)` or `expect(value.length).toBeGreaterThan(0)` |
| `expect(value).toBeTruthy()` (object)         | `expect(value).toMatchObject({...})` or `expect(value).toEqual(...)`                      |
| `expect(value).toBeTruthy()` (boolean intent) | `expect(value).toBe(true)`                                                                |
