#!/usr/bin/env bun

/**
 * Edition-cache write guard. ADR 026 §3.
 *
 * `study.reference.edition` is a denormalized cache populated by the seed
 * from `sources_registry.editions.edition_label`. The seed is the only
 * legitimate writer; any other call site that mutates the column would drift
 * the cache out of sync with the registry.
 *
 * This guard greps the repo for `.set({ ... edition: ... })` and
 * `.values({ ... edition: ... })` patterns targeting the `reference` Drizzle
 * handle. Allowed paths (the seed surface):
 *
 *   - libs/bc/study/src/seeders/**      adapter helpers called by the seed
 *   - scripts/db/seed-references-from-manifest.ts
 *   - scripts/db/seed-references.ts
 *   - scripts/db/seed-syllabi.ts
 *   - libs/bc/study/src/references.ts   the BC's `upsertReference` write path
 *
 * Wired into `bun run check`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');

const ALLOWED_PATTERNS: readonly RegExp[] = [
	/^libs\/bc\/study\/src\/seeders\//,
	/^scripts\/db\/seed-references-from-manifest\.ts$/,
	/^scripts\/db\/seed-references\.ts$/,
	/^scripts\/db\/seed-syllabi\.ts$/,
	// `references.ts` exposes `upsertReference` (the BC's write helper called
	// by every seeder adapter) -- this is the canonical seed-side surface.
	/^libs\/bc\/study\/src\/references\.ts$/,
	// The guard itself describes the pattern in its docstring; exempt to
	// prevent the script from flagging its own prose.
	/^scripts\/lint\/edition-cache-write-guard\.ts$/,
];

const SCAN_DIRS: readonly string[] = ['apps', 'libs', 'scripts'];
const SKIP_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist', 'build', '.svelte-kit', '.cache']);

interface Finding {
	path: string;
	line: number;
	text: string;
}

/**
 * Heuristic match: a `.set({ ... })` or `.values({ ... })` block whose
 * argument object includes an `edition:` property AND the call site appears
 * to target the `reference` Drizzle handle (not e.g. `referenceSection` or
 * `referenceFigure`, which have their own `edition`-shaped fields in some
 * test fixtures). Two-pass match so multi-line `.set({ ... })` blocks resolve.
 *
 * The pattern is intentionally generous on the false-positive side: false
 * negatives are silent drift; false positives surface as a one-line lint
 * complaint that the author can dismiss with a comment if it's a real
 * non-reference table.
 */
const SET_OR_VALUES_RE = /\b(?:reference)\b\s*\)?\s*\.\s*(?:set|values)\s*\(\s*\{[^}]*\bedition\s*:/m;

/**
 * Looser secondary regex that catches the case where the `reference` handle
 * is destructured into a local variable and then `.set()`-ed: e.g.
 *
 *   const tbl = reference;
 *   tbl.set({ edition: 'x' });
 *
 * The lint is best-effort; a determined author can bypass it by aliasing.
 * Per ADR 026 the contract is enforced via this lint + code review; the
 * forcing function is the same as for "no `any`."
 */
const ASSIGN_RE = /\b\.set\s*\(\s*\{[^}]*\bedition\s*:/m;

function isAllowed(relPath: string): boolean {
	for (const pat of ALLOWED_PATTERNS) {
		if (pat.test(relPath)) return true;
	}
	return false;
}

function* walk(dir: string): Generator<string> {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			yield* walk(full);
		} else if (stat.isFile() && (full.endsWith('.ts') || full.endsWith('.svelte.ts'))) {
			yield full;
		}
	}
}

function scanFile(file: string, findings: Finding[]): void {
	const rel = relative(REPO_ROOT, file);
	if (isAllowed(rel)) return;
	if (rel.endsWith('.test.ts')) return; // tests author fixtures freely.
	const text = readFileSync(file, 'utf-8');
	if (!text.includes('edition')) return; // fast bail: file doesn't touch the column.
	if (!text.includes('.set(') && !text.includes('.values(')) return;

	const lines = text.split('\n');
	// Window-based check: glue 6 consecutive lines together so multi-line
	// `.set({ ... edition: ... })` blocks match.
	const WINDOW = 6;
	for (let i = 0; i < lines.length; i += 1) {
		const block = lines.slice(i, i + WINDOW).join('\n');
		if (SET_OR_VALUES_RE.test(block) || (block.includes('reference') && ASSIGN_RE.test(block))) {
			// Confirm the match references the `reference` table (not e.g.
			// `referenceSection`, which has its own write path that may
			// legitimately edit the row).
			if (/\bedition\s*:/.test(block) && /\breference\b(?!Section|Figure|SectionReadState|SectionErrata)/.test(block)) {
				findings.push({ path: rel, line: i + 1, text: lines[i] ?? '' });
				break; // one report per file is enough.
			}
		}
	}
}

const findings: Finding[] = [];
for (const dir of SCAN_DIRS) {
	const abs = resolve(REPO_ROOT, dir);
	for (const file of walk(abs)) scanFile(file, findings);
}

if (findings.length === 0) {
	console.log('edition-cache-write-guard: ok (seed-only-writer contract upheld)');
	process.exit(0);
}

console.error('edition-cache-write-guard: non-seed writes to study.reference.edition detected:\n');
for (const f of findings) {
	console.error(`  ${f.path}:${f.line}  ${f.text.trim()}`);
}
console.error('\nPer ADR 026 §3, study.reference.edition is a seed-only denormalized cache.');
console.error('Writes outside the seed pipeline drift the column out of sync with the registry.');
console.error('If you need to reflect a registry change, update sources_registry.editions and reseed.');
process.exit(1);
