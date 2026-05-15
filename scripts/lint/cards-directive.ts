#!/usr/bin/env bun

/**
 * Cards-directive lint.
 *
 * Authoring cards in `course/knowledge/**\/node.md` uses the
 * `:::cards ... :::` directive (parsed by `@ab/help`, seeded by
 * `scripts/db/seed-cards.ts`). The historical `` ```yaml-cards `` fenced
 * block was retired by the 2026-05 migration because the markdown
 * renderer falls through to a `<pre><code>` block and dumps the raw
 * YAML onto the page.
 *
 * This guard prevents a regression by failing `bun run check` if any
 * file under `course/knowledge/**` reintroduces a `yaml-cards` fence.
 * The directive scanner in `scripts/db/seed-cards-parser.ts` and the
 * shared validator in `libs/bc/study/src/cards-yaml.ts` only recognise
 * `:::cards` blocks; a fence would silently produce zero cards at
 * `bun run db seed cards` and the visible regression on the rendered
 * page would catch it -- this guard catches it earlier.
 *
 * Exits 0 if no fences are found; exits 1 with a list of offending
 * paths + line numbers otherwise. Wired into `bun run check` as the
 * `cards-directive` step.
 */

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const SCAN_GLOB = 'course/knowledge/**/node.md';
const YAML_CARDS_FENCE = /^```yaml-cards\s*$/;

interface Finding {
	path: string;
	line: number;
}

function scanFile(absPath: string): Finding[] {
	const text = readFileSync(absPath, 'utf8');
	const lines = text.split(/\r?\n/);
	const out: Finding[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (YAML_CARDS_FENCE.test(lines[i])) {
			out.push({ path: relative(REPO_ROOT, absPath), line: i + 1 });
		}
	}
	return out;
}

function main(): void {
	const glob = new Glob(SCAN_GLOB);
	const findings: Finding[] = [];
	for (const file of glob.scanSync({ cwd: REPO_ROOT, absolute: true })) {
		findings.push(...scanFile(file));
	}
	if (findings.length === 0) {
		process.stdout.write('cards-directive: 0 yaml-cards fences in course/knowledge/**.\n');
		return;
	}
	process.stderr.write(
		`cards-directive: found ${findings.length} legacy 'yaml-cards' fence${findings.length === 1 ? '' : 's'}.\n`,
	);
	process.stderr.write(
		`Replace with ':::cards ... :::' (see scripts/migrations/.archive/2026-05-yaml-cards-to-directive.ts).\n\n`,
	);
	for (const f of findings) {
		process.stderr.write(`  ${f.path}:${f.line}\n`);
	}
	process.exit(1);
}

main();
