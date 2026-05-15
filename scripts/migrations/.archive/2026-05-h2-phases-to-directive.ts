#!/usr/bin/env bun

/**
 * One-shot corpus migrator: rewrite the legacy
 *
 *   ## Context
 *
 *   <body markdown, possibly with non-canonical H2 / H3 headings>
 *
 *   ## Problem
 *
 *   ...
 *
 * shape inside every `course/knowledge/**\/node.md` to the new
 * `:::phase name="<lowercase>" ... :::` directive shape (Phase 2 of
 * the markdown-directive cleanup, following Phase 1's `:::cards`).
 * The directive parses cleanly through `@ab/help`, the splitter in
 * `@ab/bc-study` walks the wrapped slices, and the build-knowledge
 * validator + lint script enforce the shape across the corpus.
 *
 * Why this script is committed (instead of deleted after the run):
 *
 *   - The yaml-cards -> :::cards migration is the architectural twin
 *     of this one; both scripts capture the same "lift heading +
 *     scaffolding paragraph + body into a single directive block"
 *     pattern. Future migrations follow the same shape.
 *   - The dry-run report is reproducible. If a contributor wonders
 *     "why did line N get rewritten from `##` to `###`?", they can
 *     re-run and read the report.
 *   - After the migration ships the script is moved to
 *     `scripts/migrations/.archive/` (a record of how the corpus got
 *     to its current shape, not live tooling).
 *
 * Behavior:
 *
 *   - For each `course/knowledge/**\/node.md`: find every `## <Label>`
 *     line where `<Label>` matches one of the seven canonical phase
 *     labels (Context / Problem / Discover / Reveal / Practice /
 *     Connect / Verify; case-insensitive). The slice from that line
 *     up to the next `## ` line OR EOF is that phase's body.
 *
 *   - Each phase slice is wrapped:
 *
 *       :::phase name="<lowercase-canonical>"
 *       <body, with illegal-level headings bumped to ###>
 *       :::
 *
 *   - The original `## <Label>` H2 line is dropped; the phase title
 *     is auto-rendered downstream from `KNOWLEDGE_PHASE_LABELS`.
 *
 *   - Inside the wrapped slice, only headings that VIOLATE the
 *     "highest legal heading is ###" rule are rewritten:
 *
 *       `^# `  -> `### ` (illegal H1 inside phase body)
 *       `^## ` -> `### ` (illegal H2 inside phase body)
 *
 *     Headings already at `###` or deeper are left alone. The
 *     corpus today uses `###` as the highest level inside phase
 *     bodies, so this pass is defensive: it normalises any stray
 *     `##` or `#` introduced by future authoring without demoting
 *     correctly-leveled sub-section headings (`### Worked example`,
 *     `### Q1...`, `### Cards (spaced memory items)`).
 *
 *   - Content between the closing fence of one phase and the opening
 *     `## <Label>` of the next is preserved verbatim. Content before
 *     the first phase H2 is left alone (in practice that's frontmatter
 *     metadata or a leading `# Title` -- both legitimate).
 *
 * Workflow:
 *
 *   bun scripts/migrations/2026-05-h2-phases-to-directive.ts
 *     -> dry-run (default). Prints per-file downgrade reports + a
 *        summary. Writes nothing.
 *
 *   bun scripts/migrations/2026-05-h2-phases-to-directive.ts --apply
 *     -> rewrite every file in place. Same per-file reports printed.
 *        Exit 1 on the first IO error.
 */

import { Glob } from 'bun';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const NODE_GLOB = 'course/knowledge/**/node.md';
const FRONTMATTER_DELIM = '---';

const CANONICAL_PHASE_LABELS = ['Context', 'Problem', 'Discover', 'Reveal', 'Practice', 'Connect', 'Verify'] as const;
const PHASE_LABEL_TO_NAME: ReadonlyMap<string, string> = new Map(
	CANONICAL_PHASE_LABELS.map((label) => [label.toLowerCase(), label.toLowerCase()] as const),
);

const H2_HEADING_RE = /^##\s+(.+?)\s*$/;
const ANY_HEADING_RE = /^(#{1,6})(\s+.*)$/;

interface CliFlags {
	apply: boolean;
}

interface Downgrade {
	relPath: string;
	originalLineNumber: number; // 1-based, in the original (pre-rewrite) file
	before: string;
	after: string;
}

interface NodeReport {
	relPath: string;
	originalText: string;
	rewrittenText: string;
	changed: boolean;
	downgrades: Downgrade[];
	phaseCount: number;
}

function parseFlags(argv: readonly string[]): CliFlags {
	let apply = false;
	for (const a of argv) {
		if (a === '--apply') apply = true;
		else if (a === '--dry-run') apply = false;
		else if (a === '-h' || a === '--help' || a === 'help') {
			printHelp();
			process.exit(0);
		} else throw new Error(`Unknown flag: ${a}`);
	}
	return { apply };
}

function printHelp(): void {
	process.stdout.write(
		[
			'Usage: bun scripts/migrations/2026-05-h2-phases-to-directive.ts [--apply]',
			'',
			'  --dry-run   (default) Print per-file downgrade report; write nothing.',
			'  --apply     Rewrite every node in place.',
			'',
			'Wraps every `## Context / Problem / Discover / Reveal / Practice /',
			'Connect / Verify` H2 phase heading in `:::phase name="<lowercase>"`',
			'directive blocks. Only rewrites headings inside the wrapped slice',
			'that violate the rule "highest legal heading inside a :::phase is',
			"### ': any stray `^# ` or `^## ` is bumped to `### `. Headings",
			'already at `###` or deeper are left alone.',
			'',
		].join('\n'),
	);
}

interface FrontmatterSplit {
	yamlText: string;
	body: string;
	headOffset: number; // line offset of `body` in the file (number of lines BEFORE body[0])
}

function splitFrontmatter(text: string): FrontmatterSplit | null {
	if (!text.startsWith(`${FRONTMATTER_DELIM}\n`)) return null;
	const end = text.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length + 1);
	if (end === -1) return null;
	const yamlText = text.slice(FRONTMATTER_DELIM.length + 1, end);
	const headWithFences = text.slice(0, end + `\n${FRONTMATTER_DELIM}`.length);
	const rawBody = text.slice(end + `\n${FRONTMATTER_DELIM}`.length);
	const trimmed = rawBody.replace(/^\r?\n/, '');
	const droppedNewlines = rawBody.length - trimmed.length;
	const headForOffset = headWithFences + rawBody.slice(0, droppedNewlines);
	const headOffset = headForOffset.split('\n').length - 1;
	return { yamlText, body: trimmed, headOffset };
}

interface PhaseSlice {
	/** Index in `bodyLines` of the `## <Label>` line. */
	headingIdx: number;
	/** First line of body content (inclusive). */
	bodyStartIdx: number;
	/** Index BEYOND the slice (exclusive). Points at the next `##` or `bodyLines.length`. */
	bodyEndIdxExclusive: number;
	/** Canonical phase name (lowercase). */
	phaseName: string;
}

function locatePhaseSlices(bodyLines: readonly string[]): PhaseSlice[] {
	// First pass: every H2 boundary (any label).
	const h2Indices: { idx: number; canonicalName: string | null }[] = [];
	for (let i = 0; i < bodyLines.length; i++) {
		const m = H2_HEADING_RE.exec(bodyLines[i] ?? '');
		if (!m) continue;
		const label = m[1].trim().toLowerCase();
		const canonicalName = PHASE_LABEL_TO_NAME.get(label) ?? null;
		h2Indices.push({ idx: i, canonicalName });
	}
	// Second pass: emit a slice only for the canonical-phase H2s. The slice
	// runs from the H2's body up to the NEXT H2 (canonical or not) or EOF.
	const slices: PhaseSlice[] = [];
	for (let p = 0; p < h2Indices.length; p++) {
		const entry = h2Indices[p];
		if (entry === undefined) continue;
		if (entry.canonicalName === null) continue;
		const next = h2Indices[p + 1];
		const endExclusive = next?.idx ?? bodyLines.length;
		slices.push({
			headingIdx: entry.idx,
			bodyStartIdx: entry.idx + 1,
			bodyEndIdxExclusive: endExclusive,
			phaseName: entry.canonicalName,
		});
	}
	return slices;
}

/**
 * Inside a `:::phase` body, the highest legal heading is `###`.
 * `# ` and `## ` are errors; everything `### ` and deeper is fine.
 * This function returns the rewritten line ONLY when the original
 * violates the rule (level 1 or 2); otherwise null so the caller
 * leaves the line untouched.
 */
function normaliseIllegalHeading(line: string): string | null {
	const m = ANY_HEADING_RE.exec(line);
	if (!m) return null;
	const hashes = m[1];
	if (hashes.length >= 3) return null; // ### or deeper is already legal
	return `###${m[2]}`;
}

function processNode(absPath: string): NodeReport | null {
	const raw = readFileSync(absPath, 'utf8');
	const relPath = relative(REPO_ROOT, absPath);
	const split = splitFrontmatter(raw);
	if (!split) return null;
	const bodyLines = split.body.split('\n');
	const slices = locatePhaseSlices(bodyLines);
	if (slices.length === 0) {
		return {
			relPath,
			originalText: raw,
			rewrittenText: raw,
			changed: false,
			downgrades: [],
			phaseCount: 0,
		};
	}

	// Build the rewritten body line-by-line. We walk forward through the
	// original `bodyLines` and emit:
	//   - For positions OUTSIDE a slice: the line verbatim.
	//   - For a slice's heading line: drop it (replaced by the opener below).
	//   - At the slice's start: emit `:::phase name="..."`.
	//   - For each body line in the slice: downgrade if it is a heading.
	//   - At the slice's end: emit `:::` closer.
	const downgrades: Downgrade[] = [];
	const out: string[] = [];

	// Pre-build the index range each line falls into.
	const sliceForLine: Map<number, PhaseSlice & { kind: 'heading' | 'body' | 'end' }> = new Map();
	for (const s of slices) {
		sliceForLine.set(s.headingIdx, { ...s, kind: 'heading' });
	}

	let cursor = 0;
	const lineToOriginalFileLine = (lineIdxInBody: number): number => split.headOffset + lineIdxInBody + 1;

	while (cursor < bodyLines.length) {
		const sliceStart = slices.find((s) => s.headingIdx === cursor);
		if (sliceStart) {
			// Emit opener (drop the original H2 heading line).
			out.push(`:::phase name="${sliceStart.phaseName}"`);
			for (let b = sliceStart.bodyStartIdx; b < sliceStart.bodyEndIdxExclusive; b++) {
				const ln = bodyLines[b] ?? '';
				const normalised = normaliseIllegalHeading(ln);
				if (normalised !== null) {
					out.push(normalised);
					downgrades.push({
						relPath,
						originalLineNumber: lineToOriginalFileLine(b),
						before: ln,
						after: normalised,
					});
				} else {
					out.push(ln);
				}
			}
			out.push(':::');
			cursor = sliceStart.bodyEndIdxExclusive;
			continue;
		}
		out.push(bodyLines[cursor] ?? '');
		cursor += 1;
	}

	const newBody = out.join('\n');
	const rewrittenText = `${FRONTMATTER_DELIM}\n${split.yamlText}\n${FRONTMATTER_DELIM}\n${newBody}`;
	const changed = rewrittenText !== raw;
	return {
		relPath,
		originalText: raw,
		rewrittenText,
		changed,
		downgrades,
		phaseCount: slices.length,
	};
}

function formatReport(reports: readonly NodeReport[], flags: CliFlags): string[] {
	const lines: string[] = [];
	lines.push(`H2 phases -> :::phase directive migration (${flags.apply ? 'APPLY' : 'dry-run'})`);
	lines.push('');
	const changedReports = reports.filter((r) => r.changed);
	const totalDowngrades = reports.reduce((sum, r) => sum + r.downgrades.length, 0);
	const flaggedFiles = reports.filter((r) => r.downgrades.length > 0);
	lines.push(`  ${reports.length} node.md files scanned.`);
	lines.push(`  ${changedReports.length} files would migrate.`);
	lines.push(`  ${totalDowngrades} total illegal-heading rewrites across ${flaggedFiles.length} files.`);
	lines.push('');
	if (changedReports.length > 0) {
		lines.push('Per-file:');
		for (const r of reports) {
			if (!r.changed && r.downgrades.length === 0) continue;
			lines.push('');
			lines.push(`  ${r.relPath}`);
			lines.push(`    phases: ${r.phaseCount}`);
			if (r.downgrades.length === 0) {
				lines.push('    no illegal headings.');
			} else {
				lines.push(`    ${r.downgrades.length} illegal heading rewrite${r.downgrades.length === 1 ? '' : 's'}:`);
				for (const d of r.downgrades) {
					lines.push(`      REWROTE: ${r.relPath}:${d.originalLineNumber} "${d.before}" -> "${d.after}"`);
				}
			}
		}
	}
	return lines;
}

async function main(): Promise<void> {
	const flags = parseFlags(process.argv.slice(2));
	const glob = new Glob(NODE_GLOB);
	const targets: string[] = [];
	for (const file of glob.scanSync({ cwd: REPO_ROOT, absolute: true })) targets.push(file);
	targets.sort();

	const reports: NodeReport[] = [];
	for (const absPath of targets) {
		const r = processNode(absPath);
		if (r === null) continue;
		reports.push(r);
	}

	const reportLines = formatReport(reports, flags);
	for (const line of reportLines) process.stdout.write(`${line}\n`);

	if (!flags.apply) {
		process.stdout.write('\nDry-run; pass --apply to rewrite every file.\n');
		return;
	}

	let written = 0;
	for (const r of reports) {
		if (!r.changed) continue;
		const absPath = resolve(REPO_ROOT, r.relPath);
		writeFileSync(absPath, r.rewrittenText, 'utf8');
		written++;
	}
	process.stdout.write(`\nWrote ${written} files.\n`);
}

await main();
