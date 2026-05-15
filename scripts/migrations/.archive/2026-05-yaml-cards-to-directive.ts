#!/usr/bin/env bun

/**
 * One-shot corpus migrator: rewrite the legacy
 *
 *   ### Cards (spaced repetition)
 *
 *   <intro paragraph>
 *
 *   ```yaml-cards
 *   - front: ...
 *     ...
 *   ```
 *
 * shape inside every `course/knowledge/**\/node.md` to the new
 * `:::cards ... :::` directive shape (Option C in the 2026-05-14
 * design discussion). The directive parses cleanly through `@ab/help`,
 * renders nothing on the page, and feeds the spaced-rep seeder via the
 * same payload the legacy fence carried.
 *
 * Why this script stays in the repo (instead of being deleted after
 * the run): the upcoming `:::phase` migration follows the same shape
 * (heading + scaffolding paragraph + payload -> directive block) and
 * cloning this script is the cheapest way to land it. Treat this file
 * as the canonical reference for "lift heading + intro + fenced block
 * into a single directive while flagging substantive prose for manual
 * review."
 *
 * Workflow:
 *
 *   bun scripts/migrations/2026-05-yaml-cards-to-directive.ts
 *     -> dry-run (default). Prints FLAGGED + CLEAN reports, writes nothing.
 *
 *   bun scripts/migrations/2026-05-yaml-cards-to-directive.ts --apply
 *     -> rewrite non-flagged nodes. Flagged nodes are listed and skipped.
 *
 *   bun scripts/migrations/2026-05-yaml-cards-to-directive.ts --apply --force
 *     -> also rewrite flagged nodes. Use only after the substantive
 *        intro prose has been hand-lifted to a sibling paragraph above
 *        the (now removed) `### Cards (spaced repetition)` heading.
 *
 * Flagging heuristic for "did the dropped intro paragraph carry
 * substantive content?":
 *
 *   - Paragraph length > 280 chars (a sentence-plus that probably
 *     teaches something), OR
 *   - Contains a `**bold**` span (authors use bold to flag a
 *     mnemonic / takeaway), OR
 *   - Contains a bullet list (a list of points is content, not scaffolding).
 *
 * Conservative: when in doubt, flag. The cost of a false flag is a
 * one-line manual scan; the cost of a missed flag is silent prose
 * deletion.
 */

import { Glob } from 'bun';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const NODE_GLOB = 'course/knowledge/**/node.md';
const FRONTMATTER_DELIM = '---';

const CARDS_H3_PATTERN = /^###\s+Cards\b.*$/;
const YAML_CARDS_FENCE_OPEN = /^```yaml-cards\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const BULLET_LINE = /^\s*[-*]\s+/;

const FLAG_MAX_INTRO_LENGTH = 280;

interface CliFlags {
	apply: boolean;
	force: boolean;
}

interface NodeReport {
	relPath: string;
	headingText: string | null;
	headingLine: number | null;
	introParagraph: string | null;
	flagReasons: string[];
	flagged: boolean;
	yamlBody: string;
	rewrittenText: string;
	originalText: string;
	changed: boolean;
}

function parseFlags(argv: readonly string[]): CliFlags {
	let apply = false;
	let force = false;
	for (const a of argv) {
		if (a === '--apply') apply = true;
		else if (a === '--force') force = true;
		else if (a === '--dry-run') apply = false;
		else if (a === '-h' || a === '--help' || a === 'help') {
			printHelp();
			process.exit(0);
		} else throw new Error(`Unknown flag: ${a}`);
	}
	return { apply, force };
}

function printHelp(): void {
	process.stdout.write(
		[
			'Usage: bun scripts/migrations/2026-05-yaml-cards-to-directive.ts [--apply] [--force]',
			'',
			'  --dry-run   (default) Print FLAGGED + CLEAN reports; write nothing.',
			'  --apply     Rewrite non-flagged nodes; skip flagged with a notice.',
			'  --force     Combined with --apply: also rewrite flagged nodes.',
			'',
			'Flagging heuristic: the heading + intro paragraph between the H3 and the',
			'```yaml-cards fence is dropped during rewrite. A flag means the intro is',
			'long enough / formatted richly enough that an author likely meant it as',
			'content; hand-lift those before --force.',
			'',
		].join('\n'),
	);
}

function splitFrontmatter(text: string): { yamlText: string; body: string; bodyStart: number } | null {
	if (!text.startsWith(`${FRONTMATTER_DELIM}\n`)) return null;
	const end = text.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length + 1);
	if (end === -1) return null;
	const yamlText = text.slice(FRONTMATTER_DELIM.length + 1, end);
	const bodyStart = end + `\n${FRONTMATTER_DELIM}`.length;
	const rawBody = text.slice(bodyStart);
	const trimmed = rawBody.replace(/^\r?\n/, '');
	return { yamlText, body: trimmed, bodyStart: bodyStart + (rawBody.length - trimmed.length) };
}

interface MatchedBlock {
	headingIdx: number | null;
	headingText: string | null;
	introIdx: number | null;
	introParagraph: string | null;
	fenceOpenIdx: number;
	fenceCloseIdx: number;
}

/**
 * Walk the body line by line. For each ```yaml-cards``` fence we
 * locate the most-recent `### Cards` H3 heading above it (with only
 * blank lines and one paragraph between heading and fence) and collect
 * the intro paragraph if present.
 *
 * A node may contain multiple yaml-cards blocks (the migration emits
 * one `:::cards` per fence). The scan returns blocks in document
 * order; rewriting walks them back-to-front so line indices stay
 * stable.
 */
function locateBlocks(bodyLines: readonly string[]): MatchedBlock[] {
	const blocks: MatchedBlock[] = [];
	for (let i = 0; i < bodyLines.length; i++) {
		if (!YAML_CARDS_FENCE_OPEN.test(bodyLines[i])) continue;
		const fenceOpenIdx = i;
		let close = fenceOpenIdx + 1;
		while (close < bodyLines.length && !FENCE_CLOSE.test(bodyLines[close])) close++;
		if (close >= bodyLines.length) continue; // unclosed -- skip, will surface elsewhere
		const fenceCloseIdx = close;

		// Walk backwards from the fence, skipping blank lines and one
		// paragraph, to find the `### Cards` heading.
		let cur = fenceOpenIdx - 1;
		while (cur >= 0 && bodyLines[cur].trim() === '') cur--;
		// Now `cur` is at the last non-blank line above the fence. If
		// that line is a heading, there's no intro paragraph. Otherwise
		// walk up the contiguous run of non-blank, non-heading lines as
		// the candidate intro paragraph.
		const introEnd = cur;
		let introStart = cur;
		let introParagraph: string | null = null;
		let introIdx: number | null = null;
		if (cur >= 0 && !bodyLines[cur].startsWith('#')) {
			while (introStart > 0 && bodyLines[introStart - 1].trim() !== '' && !bodyLines[introStart - 1].startsWith('#')) {
				introStart--;
			}
			introIdx = introStart;
			introParagraph = bodyLines.slice(introStart, introEnd + 1).join('\n');
			cur = introStart - 1;
			while (cur >= 0 && bodyLines[cur].trim() === '') cur--;
		}
		// Now `cur` should be at the H3 `### Cards` heading -- if not,
		// the block has no recognised heading prologue (we still emit a
		// `:::cards` rewrite but leave headingIdx null).
		let headingIdx: number | null = null;
		let headingText: string | null = null;
		if (cur >= 0 && CARDS_H3_PATTERN.test(bodyLines[cur])) {
			headingIdx = cur;
			headingText = bodyLines[cur];
		} else {
			// No matching heading -> the intro paragraph isn't actually
			// scaffolding; reset.
			introIdx = null;
			introParagraph = null;
		}
		blocks.push({ headingIdx, headingText, introIdx, introParagraph, fenceOpenIdx, fenceCloseIdx });
	}
	return blocks;
}

function classifyIntro(intro: string | null): string[] {
	if (intro === null) return [];
	const reasons: string[] = [];
	const trimmed = intro.trim();
	if (trimmed.length === 0) return reasons;
	if (trimmed.length > FLAG_MAX_INTRO_LENGTH) {
		reasons.push(`intro length ${trimmed.length} > ${FLAG_MAX_INTRO_LENGTH}`);
	}
	if (/\*\*[^*]+\*\*/.test(trimmed)) {
		reasons.push('bold span in intro');
	}
	const lines = trimmed.split('\n');
	if (lines.some((l) => BULLET_LINE.test(l))) {
		reasons.push('bullet list in intro');
	}
	return reasons;
}

function processNode(absPath: string): NodeReport | null {
	const raw = readFileSync(absPath, 'utf8');
	const relPath = relative(REPO_ROOT, absPath);
	const split = splitFrontmatter(raw);
	if (!split) return null;
	const bodyLines = split.body.split('\n');
	const blocks = locateBlocks(bodyLines);
	if (blocks.length === 0) return null;

	// Walk blocks back-to-front so line indices stay valid as we splice.
	const newBodyLines = [...bodyLines];
	const flagReasonsAggregate: string[] = [];
	const firstHeadingText: string | null = blocks[0]?.headingText ?? null;
	const firstHeadingLine: number | null = blocks[0]?.headingIdx ?? null;
	const firstIntroParagraph: string | null = blocks[0]?.introParagraph ?? null;
	const yamlBodies: string[] = [];

	for (const b of [...blocks].reverse()) {
		const yamlBody = bodyLines.slice(b.fenceOpenIdx + 1, b.fenceCloseIdx).join('\n');
		yamlBodies.unshift(yamlBody);

		const reasons = classifyIntro(b.introParagraph);
		flagReasonsAggregate.push(...reasons);

		const blockReplacement = `:::cards\n${yamlBody}\n:::`;
		// Replacement span: from heading (if present) -> fence close.
		const spanStart = b.headingIdx ?? b.introIdx ?? b.fenceOpenIdx;
		const spanEnd = b.fenceCloseIdx;
		newBodyLines.splice(spanStart, spanEnd - spanStart + 1, blockReplacement);
	}

	const flagged = flagReasonsAggregate.length > 0;
	const newBody = newBodyLines.join('\n');
	const rewrittenText = `${FRONTMATTER_DELIM}\n${split.yamlText}\n${FRONTMATTER_DELIM}\n${newBody}`;
	const changed = rewrittenText !== raw;

	return {
		relPath,
		headingText: firstHeadingText,
		headingLine: firstHeadingLine,
		introParagraph: firstIntroParagraph,
		flagReasons: flagReasonsAggregate,
		flagged,
		yamlBody: yamlBodies.join('\n---block-boundary---\n'),
		rewrittenText,
		originalText: raw,
		changed,
	};
}

function formatReportLine(r: NodeReport): string {
	const lines: string[] = [];
	lines.push(`  ${r.relPath}`);
	if (r.headingText) lines.push(`    heading dropped: ${r.headingText.trim()}`);
	if (r.introParagraph) {
		const oneLine = r.introParagraph.replace(/\s+/g, ' ').trim();
		const preview = oneLine.length > 120 ? `${oneLine.slice(0, 117)}...` : oneLine;
		lines.push(`    intro dropped:   ${preview}`);
	}
	if (r.flagged) lines.push(`    FLAG reasons:    ${r.flagReasons.join('; ')}`);
	return lines.join('\n');
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

	const flagged = reports.filter((r) => r.flagged);
	const clean = reports.filter((r) => !r.flagged);

	process.stdout.write(
		`yaml-cards -> :::cards migration (${flags.apply ? 'APPLY' : 'dry-run'}${flags.force ? ' --force' : ''})\n`,
	);
	process.stdout.write(`  ${reports.length} nodes with yaml-cards blocks.\n`);
	process.stdout.write(`  ${clean.length} clean (will rewrite under --apply).\n`);
	process.stdout.write(`  ${flagged.length} flagged (require manual review).\n\n`);

	if (clean.length > 0) {
		process.stdout.write('CLEAN nodes\n');
		for (const r of clean) process.stdout.write(`${formatReportLine(r)}\n`);
		process.stdout.write('\n');
	}
	if (flagged.length > 0) {
		process.stdout.write('FLAGGED nodes (review the dropped intro before --force)\n');
		for (const r of flagged) process.stdout.write(`${formatReportLine(r)}\n`);
		process.stdout.write('\n');
	}

	if (!flags.apply) {
		process.stdout.write('Dry-run; pass --apply to rewrite CLEAN nodes; --apply --force for flagged too.\n');
		return;
	}

	let written = 0;
	let skipped = 0;
	for (const r of reports) {
		if (!r.changed) continue;
		if (r.flagged && !flags.force) {
			process.stdout.write(`skipped: ${r.relPath} -- flagged for manual review\n`);
			skipped++;
			continue;
		}
		const absPath = resolve(REPO_ROOT, r.relPath);
		writeFileSync(absPath, r.rewrittenText, 'utf8');
		written++;
	}
	process.stdout.write(`\nWrote ${written} files; skipped ${skipped} flagged.\n`);
}

await main();
