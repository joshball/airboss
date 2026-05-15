#!/usr/bin/env bun

/**
 * Phase-directive lint.
 *
 * Authoring knowledge-node phases uses the `:::phase name="..."`
 * directive (parsed by `@ab/help`, split by `splitContentPhases` in
 * `@ab/bc-study`). The historical `## <PhaseLabel>` H2 heading shape
 * was retired by the 2026-05 migration because:
 *
 *   1. H2 inside a phase body conflated structure (the phase wrapper)
 *      with content (an author's heading inside a phase body), so a
 *      `## Worked example` inside Practice silently became a sibling
 *      phase boundary.
 *   2. The phase title itself is auto-rendered from
 *      `KNOWLEDGE_PHASE_LABELS`; the H2 line carried no payload beyond
 *      "I am a phase boundary."
 *
 * This guard prevents a regression by failing `bun run check` if any
 * file under `course/knowledge/**` reintroduces an H2 phase heading.
 * The runtime splitter only recognises `:::phase`; an H2 phase heading
 * would silently produce zero phases and crash the lifecycle scan.
 *
 * Exits 0 if no offending headings are found; exits 1 with a list of
 * offending paths + line numbers + headings otherwise. Wired into
 * `bun run check` as the `phase-directive` step.
 */

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const SCAN_GLOB = 'course/knowledge/**/node.md';
const CANONICAL_PHASE_LABELS = ['Context', 'Problem', 'Discover', 'Reveal', 'Practice', 'Connect', 'Verify'] as const;
const PHASE_LABEL_SET = new Set<string>(CANONICAL_PHASE_LABELS.map((l) => l.toLowerCase()));
const H2_HEADING_RE = /^##\s+(.+?)\s*$/;

interface Finding {
	path: string;
	line: number;
	heading: string;
}

function scanFile(absPath: string): Finding[] {
	const text = readFileSync(absPath, 'utf8');
	const lines = text.split(/\r?\n/);
	const out: Finding[] = [];
	for (let i = 0; i < lines.length; i++) {
		const m = H2_HEADING_RE.exec(lines[i] ?? '');
		if (!m) continue;
		const label = m[1].trim().toLowerCase();
		if (PHASE_LABEL_SET.has(label)) {
			out.push({ path: relative(REPO_ROOT, absPath), line: i + 1, heading: m[1].trim() });
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
		process.stdout.write('phase-directive: 0 legacy H2 phase headings in course/knowledge/**.\n');
		return;
	}
	process.stderr.write(
		`phase-directive: found ${findings.length} legacy H2 phase heading${findings.length === 1 ? '' : 's'}.\n`,
	);
	process.stderr.write(
		`Wrap each phase body in a ':::phase name="<lowercase>"' directive (see scripts/migrations/.archive/2026-05-h2-phases-to-directive.ts).\n\n`,
	);
	for (const f of findings) {
		process.stderr.write(`  ${f.path}:${f.line}  ## ${f.heading}\n`);
	}
	process.exit(1);
}

main();
