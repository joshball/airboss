# md-format

Markdown formatter for the airboss repo. Bun runtime, TypeScript, no python.

## Rules

- **MD022** -- blank line before AND after headings (`#`, `##`, ...).
- **MD031** -- blank line before and after fenced code blocks.
- **MD032** -- blank line before lists.
- **MD040** -- bare ` ``` ` opening fences become ` ```text `.
- **MD060** -- pipe-table alignment. Every `|` in every row at the same column. Cells padded to max width per column. Separator-row dashes match column width.

## Skipped

- Content inside fenced code blocks (tables-inside-fences are not reformatted).
- YAML frontmatter at the top of the file (`---` ... `---`).
- Files under `.claude/skills/`, `node_modules/`, `.svelte-kit/`, `dist/`, `build/`, `docs/.archive/`.

## Usage

```bash
bun tools/md-format/bin.ts                     # default: dirty files vs HEAD + untracked
bun tools/md-format/bin.ts --dir docs/         # all .md under a directory
bun tools/md-format/bin.ts --all               # entire repo (slow)
bun tools/md-format/bin.ts --check             # report only, exit 1 if any file would change
bun tools/md-format/bin.ts path/to/file.md     # explicit files
```

Or via package.json scripts:

```bash
bun run format:md           # writes
bun run format:md:check     # CI-style check
```

`bun run check` invokes `--check` mode and fails the pipeline on unformatted files.

## Tests

```bash
bunx vitest run tools/md-format
```
