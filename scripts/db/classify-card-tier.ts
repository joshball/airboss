#!/usr/bin/env bun

/**
 * Interactive hand-classifier for `question_tier` on yaml-cards entries.
 *
 * Phase 2 of the card-question-tier WP (PR #949) auto-populated
 * `source_authority` (256/262 cards) and `acs_codes` (235/262 cards) from
 * tag + frontmatter inference, but left `question_tier` null on every
 * unclassified entry. The conservative auto-rule couldn't infer tier from
 * existing tags (the corpus has zero `faa-written` / `cfi-fundamentals`
 * tag tokens), so the FAA-vs-CFI distinction is human judgement per card.
 *
 * This script is that hand pass. It walks every `course/knowledge/**\/node.md`
 * file, finds yaml-cards entries with `question_tier` unset, prints a
 * context block (node slug, body section heading, front/back, ACS codes,
 * source authority, suggested tier with reasoning), and prompts the
 * human for a single keypress: `f` (faa-written), `c` (cfi-essential),
 * `b` (both), `s` (skip), `q` (quit), `?` (help).
 *
 * Suggestion heuristics (conservative -- the human decides each one):
 *
 *   1. If the card carries any `cfi-*` / `instructor-*` / `foi` token in
 *      its `tags`, OR any `source_authority.cite` mentions FOI / AC 61-65
 *      / AC 61-83 / AC 60-25 -> suggest `cfi-essential`.
 *   2. Else if the card carries any ACS-code matching `ACS_CODE_PATTERN`
 *      (PA.*, IR.*, CA.*) -> suggest `faa-written`.
 *   3. Else if the front/back prose contains an explain/teach/examiner
 *      marker AND the card has an ACS code -> suggest `both`.
 *   4. Else -> suggest `faa-written` (PPL-focus default, low confidence).
 *
 * The suggestion exists to make the keypress fast. It's not a default --
 * every prompt requires an explicit keypress from the human.
 *
 * Each classification persists to disk immediately. Quit (or Ctrl-C)
 * preserves every already-classified card; only the in-flight cursor is
 * lost. The yaml.parseDocument round-trip preserves block scalars (`|`),
 * flow tags, comments, and key order -- same pattern as the Phase 2
 * backfill script.
 *
 * Usage:
 *   bun scripts/db/classify-card-tier.ts                 # walk all unclassified
 *   bun scripts/db/classify-card-tier.ts --dry-run       # prompt but don't write
 *   bun scripts/db/classify-card-tier.ts --node <slug>   # restrict to one node id
 *   bun scripts/db/classify-card-tier.ts --start-from <slug>
 *                                                        # resume from a node id
 *   bun scripts/db/classify-card-tier.ts --auto-suggest  # print suggestions, no prompts
 */

import { Glob } from 'bun';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { ACS_CODE_PATTERN, QUESTION_TIERS, type QuestionTier } from '@ab/constants';
import { parseDocument, parse as parseYaml, Scalar, YAMLMap, YAMLSeq } from 'yaml';

const REPO_ROOT = new URL('../../', import.meta.url).pathname;
const NODE_GLOB = 'course/knowledge/**/node.md';
const FRONTMATTER_DELIM = '---';
const CARDS_DIRECTIVE_OPEN = /^:::cards(?:\s.*)?$/;
const DIRECTIVE_CLOSE = /^:::\s*$/;
const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*$/;

/**
 * Lowercased tokens (substring match against any tag) that nudge the
 * suggestion toward `cfi-essential`. Conservative: the corpus has zero
 * of these today; the list exists so future authoring lands cleanly
 * without re-tooling the suggester.
 */
const CFI_TAG_HINTS = ['cfi-', 'instructor-', 'foi', 'elements-of-instruction', 'fundamentals-of-instructing'];

/**
 * Substring markers in front/back prose that suggest an instructional
 * framing (examiner wants you to teach, demo, or explain). Match is
 * case-insensitive; presence alongside an ACS code nudges toward `both`.
 */
const TEACH_MARKERS = [
	'examiner expects you to explain',
	'examiner expects',
	'teach the',
	'teach a',
	'how would you teach',
	'as a cfi',
	'instructor must',
	'explain to a student',
	'foi',
	'fundamentals of instructing',
];

/**
 * Substrings in `source_authority.cite` that mark a CFI / instructor
 * authority. Case-insensitive match.
 */
const CFI_AUTHORITY_HINTS = ['ac 61-65', 'ac 61-83', 'ac 60-25', 'foi', 'instructor', 'cfi pts', 'fia acs'];

const TIER_KEYS: Record<string, QuestionTier> = {
	f: QUESTION_TIERS.FAA_WRITTEN,
	c: QUESTION_TIERS.CFI_ESSENTIAL,
	b: QUESTION_TIERS.BOTH,
};

interface CliFlags {
	dryRun: boolean;
	nodeSlug: string | null;
	startFrom: string | null;
	autoSuggest: boolean;
}

interface CardContext {
	absPath: string;
	relPath: string;
	nodeId: string;
	headingPath: string;
	entryIndex: number;
	front: string;
	back: string;
	acsCodes: string[];
	sourceAuthority: Array<{ kind: string; cite: string }>;
	tags: string[];
}

interface Suggestion {
	tier: QuestionTier;
	reasoning: string;
	confidence: 'high' | 'medium' | 'low';
}

interface Counters {
	classified: number;
	faaWritten: number;
	cfiEssential: number;
	both: number;
	skipped: number;
}

function parseFlags(argv: readonly string[]): CliFlags {
	let dryRun = false;
	let nodeSlug: string | null = null;
	let startFrom: string | null = null;
	let autoSuggest = false;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry-run') {
			dryRun = true;
			continue;
		}
		if (a === '--auto-suggest') {
			autoSuggest = true;
			continue;
		}
		if (a === '--node') {
			const next = argv[i + 1];
			if (typeof next !== 'string' || next.startsWith('--')) {
				throw new Error('--node requires a slug argument');
			}
			nodeSlug = next;
			i++;
			continue;
		}
		if (a === '--start-from') {
			const next = argv[i + 1];
			if (typeof next !== 'string' || next.startsWith('--')) {
				throw new Error('--start-from requires a slug argument');
			}
			startFrom = next;
			i++;
			continue;
		}
		if (a === '-h' || a === '--help' || a === 'help') {
			printHelp();
			process.exit(0);
		}
		throw new Error(`Unknown flag: ${a}`);
	}
	return { dryRun, nodeSlug, startFrom, autoSuggest };
}

function printHelp(): void {
	process.stdout.write(
		[
			'Usage: bun scripts/db/classify-card-tier.ts [flags]',
			'',
			'  --dry-run             Prompt as normal but do not persist mutations.',
			'  --node <slug>         Restrict walk to one node (frontmatter id).',
			'  --start-from <slug>   Skip every node before this one (alphabetical by relpath).',
			'  --auto-suggest        Print the heuristic suggestion + reasoning for every',
			'                        unclassified card; do not prompt or write. Useful for',
			'                        offline review before a real classification session.',
			'',
			'Keys during prompt:',
			'  f  -> faa-written',
			'  c  -> cfi-essential',
			'  b  -> both',
			'  s  -> skip (leave null, move on)',
			'  q  -> quit (already-classified work is preserved)',
			'  ?  -> reprint help',
			'',
		].join('\n'),
	);
}

function splitFrontmatter(text: string): { yamlText: string; bodyText: string } | null {
	if (!text.startsWith(`${FRONTMATTER_DELIM}\n`)) return null;
	const end = text.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length + 1);
	if (end === -1) return null;
	const yamlText = text.slice(FRONTMATTER_DELIM.length + 1, end);
	const bodyStart = end + `\n${FRONTMATTER_DELIM}`.length;
	const rawBody = text.slice(bodyStart);
	const trimmed = rawBody.replace(/^\r?\n/, '');
	return { yamlText, bodyText: trimmed };
}

/**
 * Compute the breadcrumb of headings active at a body line index. e.g.
 * `## Practice`. Post-migration the `:::cards` block sits directly under
 * `## Practice` (the legacy `### Cards (spaced repetition)` subheading
 * was dropped because the directive renders nothing and the heading
 * referenced authoring scaffolding readers never see); we return the
 * full path so context survives if an author re-adds an interior
 * heading later.
 */
function headingPathAt(bodyLines: readonly string[], lineIdx: number): string {
	const stack: Array<{ depth: number; text: string }> = [];
	for (let i = 0; i <= lineIdx && i < bodyLines.length; i++) {
		const m = bodyLines[i].match(HEADING_PATTERN);
		if (!m) continue;
		const depth = m[1].length;
		const text = m[2];
		while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();
		stack.push({ depth, text });
	}
	if (stack.length === 0) return '(no heading)';
	return stack.map((h) => `${'#'.repeat(h.depth)} ${h.text}`).join(' > ');
}

function locateYamlCardsBlocks(bodyLines: readonly string[]): Array<{ open: number; close: number }> {
	const out: Array<{ open: number; close: number }> = [];
	let i = 0;
	while (i < bodyLines.length) {
		if (CARDS_DIRECTIVE_OPEN.test(bodyLines[i])) {
			let j = i + 1;
			while (j < bodyLines.length && !DIRECTIVE_CLOSE.test(bodyLines[j])) j++;
			if (j < bodyLines.length) {
				out.push({ open: i, close: j });
				i = j + 1;
				continue;
			}
		}
		i++;
	}
	return out;
}

function detectIndent(blockLines: readonly string[]): string {
	for (const line of blockLines) {
		if (line.trim() === '') continue;
		const m = line.match(/^(\s*)/);
		return m ? m[1] : '';
	}
	return '';
}

function scalarString(node: unknown): string | null {
	if (typeof node === 'string') return node;
	if (node instanceof Scalar && typeof node.value === 'string') return node.value;
	return null;
}

function readStringList(map: YAMLMap, key: string): string[] {
	const node = map.get(key, true);
	if (!(node instanceof YAMLSeq)) return [];
	const out: string[] = [];
	for (const item of node.items) {
		const s = scalarString(item);
		if (s !== null) out.push(s);
	}
	return out;
}

function readSourceAuthority(map: YAMLMap): Array<{ kind: string; cite: string }> {
	const node = map.get('source_authority', true);
	if (!(node instanceof YAMLSeq)) return [];
	const out: Array<{ kind: string; cite: string }> = [];
	for (const item of node.items) {
		if (!(item instanceof YAMLMap)) continue;
		const kind = scalarString(item.get('kind', true));
		const cite = scalarString(item.get('cite', true));
		if (kind === null || cite === null) continue;
		out.push({ kind, cite });
	}
	return out;
}

function computeSuggestion(ctx: CardContext): Suggestion {
	const reasons: string[] = [];
	const tags = ctx.tags.map((t) => t.toLowerCase());
	const cites = ctx.sourceAuthority.map((s) => s.cite.toLowerCase());
	const prose = `${ctx.front}\n${ctx.back}`.toLowerCase();

	const matchedCfiTag = tags.find((t) => CFI_TAG_HINTS.some((hint) => t.includes(hint)));
	const matchedCfiAuthority = cites.find((c) => CFI_AUTHORITY_HINTS.some((hint) => c.includes(hint)));
	const matchedTeachMarker = TEACH_MARKERS.find((m) => prose.includes(m));
	const hasAcsCode = ctx.acsCodes.some((c) => ACS_CODE_PATTERN.test(c));

	if (matchedCfiTag !== undefined) reasons.push(`tag '${matchedCfiTag}' looks CFI-flavoured`);
	if (matchedCfiAuthority !== undefined) reasons.push(`source_authority cite mentions '${matchedCfiAuthority}'`);
	if (matchedTeachMarker !== undefined) reasons.push(`prose contains '${matchedTeachMarker}'`);
	if (hasAcsCode) reasons.push(`ACS code present (${ctx.acsCodes.filter((c) => ACS_CODE_PATTERN.test(c)).join(', ')})`);

	const cfiSignal = matchedCfiTag !== undefined || matchedCfiAuthority !== undefined;
	const teachAndAcs = matchedTeachMarker !== undefined && hasAcsCode;

	if (cfiSignal && hasAcsCode) {
		return {
			tier: QUESTION_TIERS.BOTH,
			reasoning: reasons.join('; '),
			confidence: 'medium',
		};
	}
	if (cfiSignal) {
		return {
			tier: QUESTION_TIERS.CFI_ESSENTIAL,
			reasoning: reasons.join('; '),
			confidence: 'medium',
		};
	}
	if (teachAndAcs) {
		return {
			tier: QUESTION_TIERS.BOTH,
			reasoning: reasons.join('; '),
			confidence: 'low',
		};
	}
	if (hasAcsCode) {
		return {
			tier: QUESTION_TIERS.FAA_WRITTEN,
			reasoning: reasons.join('; '),
			confidence: 'medium',
		};
	}
	return {
		tier: QUESTION_TIERS.FAA_WRITTEN,
		reasoning: 'No signal -- defaulting to faa-written (PPL focus)',
		confidence: 'low',
	};
}

/**
 * Wrap a prose block at the given column width, preserving existing
 * paragraph breaks. Used for rendering front/back fields in the prompt.
 */
function wrapText(text: string, width: number, prefix: string): string {
	const paragraphs = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);
	const out: string[] = [];
	for (const para of paragraphs) {
		const collapsed = para.replace(/\s+/g, ' ').trim();
		if (collapsed === '') continue;
		let line = '';
		for (const word of collapsed.split(' ')) {
			if (line === '') {
				line = word;
				continue;
			}
			if (line.length + 1 + word.length > width) {
				out.push(`${prefix}${line}`);
				line = word;
				continue;
			}
			line = `${line} ${word}`;
		}
		if (line !== '') out.push(`${prefix}${line}`);
		out.push(prefix.trimEnd());
	}
	while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
	return out.join('\n');
}

/**
 * Buffer of un-consumed bytes from non-TTY stdin. When the script is
 * piped (e.g. `printf 'fsb' | classify-card-tier`), we read the full
 * stream once and yield one character per `readKey()` so test scripts
 * can drive the prompt deterministically. When stdin is a TTY, we use
 * raw mode and consume one keypress per call.
 */
const PIPED_STDIN_BUFFER: { chars: string[]; loaded: boolean; loading: Promise<void> | null } = {
	chars: [],
	loaded: false,
	loading: null,
};

async function ensurePipedBufferLoaded(): Promise<void> {
	if (PIPED_STDIN_BUFFER.loaded) return;
	if (PIPED_STDIN_BUFFER.loading !== null) {
		await PIPED_STDIN_BUFFER.loading;
		return;
	}
	PIPED_STDIN_BUFFER.loading = (async () => {
		const stdin = process.stdin;
		stdin.setEncoding('utf8');
		const chunks: string[] = [];
		for await (const chunk of stdin) {
			chunks.push(typeof chunk === 'string' ? chunk : (chunk as Buffer).toString('utf8'));
		}
		const joined = chunks.join('');
		for (const ch of joined) PIPED_STDIN_BUFFER.chars.push(ch);
		PIPED_STDIN_BUFFER.loaded = true;
	})();
	await PIPED_STDIN_BUFFER.loading;
}

/**
 * Read one keypress. In TTY mode uses raw stdin (one byte per call,
 * no enter required). In non-TTY mode (piped input) loads the whole
 * stream once and yields one character per call -- this lets test
 * harnesses drive the prompt by piping a key sequence in.
 *
 * Ctrl-C resolves to '\x03'. EOF on piped stdin resolves to 'q' so
 * test runs terminate cleanly instead of hanging.
 */
async function readKey(): Promise<string> {
	const stdin = process.stdin;
	const isTty = typeof stdin.setRawMode === 'function' && stdin.isTTY === true;
	if (!isTty) {
		await ensurePipedBufferLoaded();
		const next = PIPED_STDIN_BUFFER.chars.shift();
		if (next === undefined) return 'q';
		return next;
	}
	return new Promise<string>((resolve) => {
		const wasRaw = stdin.isRaw === true;
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding('utf8');
		const onData = (chunk: string | Buffer): void => {
			stdin.removeListener('data', onData);
			stdin.pause();
			if (!wasRaw && typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
			const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
			// Yield only the first byte; multi-byte keypresses (arrows, etc)
			// are intentionally truncated since we only care about single-key
			// commands.
			resolve(text.length > 0 ? text[0] : '');
		};
		stdin.on('data', onData);
	});
}

function printDivider(): void {
	process.stdout.write(`${'-'.repeat(80)}\n`);
}

function renderCardPrompt(ctx: CardContext, suggestion: Suggestion, position: { idx: number; total: number }): void {
	process.stdout.write('\n');
	printDivider();
	process.stdout.write(`[${position.idx}/${position.total}]  ${ctx.relPath}\n`);
	process.stdout.write(`node:    ${ctx.nodeId}\n`);
	process.stdout.write(`section: ${ctx.headingPath}\n`);
	process.stdout.write(`entry:   #${ctx.entryIndex}\n`);
	if (ctx.acsCodes.length > 0) {
		process.stdout.write(`acs:     ${ctx.acsCodes.join(', ')}\n`);
	}
	if (ctx.sourceAuthority.length > 0) {
		const formatted = ctx.sourceAuthority.map((s) => `${s.kind}: ${s.cite}`).join(' | ');
		process.stdout.write(`source:  ${formatted}\n`);
	}
	if (ctx.tags.length > 0) {
		process.stdout.write(`tags:    ${ctx.tags.join(', ')}\n`);
	}
	process.stdout.write('\nfront:\n');
	process.stdout.write(`${wrapText(ctx.front, 76, '    ')}\n`);
	process.stdout.write('\nback:\n');
	process.stdout.write(`${wrapText(ctx.back, 76, '    ')}\n`);
	process.stdout.write(`\nsuggested: ${suggestion.tier}  (${suggestion.confidence} confidence)\n`);
	if (suggestion.reasoning !== '') {
		process.stdout.write(`reasoning: ${suggestion.reasoning}\n`);
	}
	printDivider();
}

function renderRunningTotal(c: Counters, total: number): void {
	const done = c.classified;
	const summary = `${c.faaWritten} faa-written, ${c.cfiEssential} cfi-essential, ${c.both} both, ${c.skipped} skipped`;
	process.stdout.write(`progress: ${done}/${total} classified (${summary})\n`);
}

interface NodeRecord {
	absPath: string;
	relPath: string;
	nodeId: string;
	bodyLines: string[];
	yamlText: string;
	blocks: Array<{ open: number; close: number }>;
}

function loadNode(absPath: string): NodeRecord | null {
	const raw = readFileSync(absPath, 'utf8');
	const split = splitFrontmatter(raw);
	if (!split) return null;
	const frontmatter = parseYaml(split.yamlText) as Record<string, unknown> | null;
	if (!frontmatter || typeof frontmatter.id !== 'string') return null;
	const bodyLines = split.bodyText.split('\n');
	const blocks = locateYamlCardsBlocks(bodyLines);
	if (blocks.length === 0) return null;
	return {
		absPath,
		relPath: relative(REPO_ROOT, absPath),
		nodeId: frontmatter.id,
		bodyLines,
		yamlText: split.yamlText,
		blocks,
	};
}

/**
 * Build the list of every unclassified card context across every node,
 * preserving file + block + entry order. The list is computed once and
 * the cursor walks it; per-card mutation re-reads the node from disk
 * because earlier classifications in the same node have shifted line
 * numbers. The pre-built list still reflects the BEFORE state, which
 * is fine: we only use it for ordering and to count `total`.
 */
function collectUnclassifiedCards(records: readonly NodeRecord[]): CardContext[] {
	const out: CardContext[] = [];
	for (const rec of records) {
		for (const range of rec.blocks) {
			const inner = rec.bodyLines.slice(range.open + 1, range.close);
			const indent = detectIndent(inner);
			const blockSource = inner.map((l) => (indent === '' ? l : l.replace(new RegExp(`^${indent}`), ''))).join('\n');
			const doc = parseDocument(blockSource);
			const seq = doc.contents;
			if (!(seq instanceof YAMLSeq)) continue;
			for (let entryIdx = 0; entryIdx < seq.items.length; entryIdx++) {
				const entry = seq.items[entryIdx];
				if (!(entry instanceof YAMLMap)) continue;
				const tierRaw = entry.get('question_tier');
				if (tierRaw !== undefined && tierRaw !== null) continue;
				const front = scalarString(entry.get('front', true)) ?? '(missing front)';
				const back = scalarString(entry.get('back', true)) ?? '(missing back)';
				const headingPath = headingPathAt(rec.bodyLines, range.open);
				out.push({
					absPath: rec.absPath,
					relPath: rec.relPath,
					nodeId: rec.nodeId,
					headingPath,
					entryIndex: entryIdx,
					front,
					back,
					acsCodes: readStringList(entry, 'acs_codes'),
					sourceAuthority: readSourceAuthority(entry),
					tags: readStringList(entry, 'tags'),
				});
			}
		}
	}
	return out;
}

/**
 * Apply one tier classification to a node.md file. Re-reads the file
 * from disk so prior classifications on the same node are not lost.
 * The block is located by entry index inside the Nth yaml-cards fence
 * (counted from the top of the body). Throws if the target entry is
 * not found or already has a tier set (race / drift detection).
 */
function applyTierMutation(absPath: string, entryIndex: number, blockIndex: number, tier: QuestionTier): void {
	const raw = readFileSync(absPath, 'utf8');
	const split = splitFrontmatter(raw);
	if (!split) throw new Error(`${absPath}: missing frontmatter`);
	const bodyLines = split.bodyText.split('\n');
	const blocks = locateYamlCardsBlocks(bodyLines);
	if (blockIndex >= blocks.length) {
		throw new Error(`${absPath}: block index ${blockIndex} out of range (have ${blocks.length})`);
	}
	const range = blocks[blockIndex];
	const inner = bodyLines.slice(range.open + 1, range.close);
	const indent = detectIndent(inner);
	const blockSource = inner.map((l) => (indent === '' ? l : l.replace(new RegExp(`^${indent}`), ''))).join('\n');
	const doc = parseDocument(blockSource);
	const seq = doc.contents;
	if (!(seq instanceof YAMLSeq)) {
		throw new Error(`${absPath}: yaml-cards block ${blockIndex} did not parse to a sequence`);
	}
	const entry = seq.items[entryIndex];
	if (!(entry instanceof YAMLMap)) {
		throw new Error(`${absPath}: yaml-cards[${blockIndex}][${entryIndex}] is not a mapping`);
	}
	const existing = entry.get('question_tier');
	if (existing !== undefined && existing !== null) {
		throw new Error(
			`${absPath}: yaml-cards[${blockIndex}][${entryIndex}] already has question_tier='${String(existing)}'`,
		);
	}
	entry.set('question_tier', tier);
	const rendered = doc.toString({
		flowCollectionPadding: false,
		lineWidth: 0,
	});
	const renderedLines = rendered.split('\n');
	while (renderedLines.length > 0 && renderedLines[renderedLines.length - 1] === '') renderedLines.pop();
	const reIndented = indent === '' ? renderedLines : renderedLines.map((l) => (l === '' ? l : `${indent}${l}`));
	const newBody = [...bodyLines];
	newBody.splice(range.open + 1, range.close - range.open - 1, ...reIndented);
	const newText = `${FRONTMATTER_DELIM}\n${split.yamlText}\n${FRONTMATTER_DELIM}\n${newBody.join('\n')}`;
	writeFileSync(absPath, newText, 'utf8');
}

/**
 * Locate which yaml-cards block a card sits in by re-reading the node
 * from disk. Returns the block index and the in-block entry index based
 * on matching the card's `front` field (which is stable across prior
 * mutations on the same node). Returns null if the entry has since been
 * classified or removed (caller should skip).
 */
function locateCardOnDisk(ctx: CardContext): { blockIndex: number; entryIndex: number } | null {
	const raw = readFileSync(ctx.absPath, 'utf8');
	const split = splitFrontmatter(raw);
	if (!split) return null;
	const bodyLines = split.bodyText.split('\n');
	const blocks = locateYamlCardsBlocks(bodyLines);
	for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
		const range = blocks[blockIdx];
		const inner = bodyLines.slice(range.open + 1, range.close);
		const indent = detectIndent(inner);
		const blockSource = inner.map((l) => (indent === '' ? l : l.replace(new RegExp(`^${indent}`), ''))).join('\n');
		const doc = parseDocument(blockSource);
		const seq = doc.contents;
		if (!(seq instanceof YAMLSeq)) continue;
		for (let entryIdx = 0; entryIdx < seq.items.length; entryIdx++) {
			const entry = seq.items[entryIdx];
			if (!(entry instanceof YAMLMap)) continue;
			const front = scalarString(entry.get('front', true));
			if (front !== ctx.front) continue;
			const tier = entry.get('question_tier');
			if (tier !== undefined && tier !== null) return null;
			return { blockIndex: blockIdx, entryIndex: entryIdx };
		}
	}
	return null;
}

function runAutoSuggest(cards: readonly CardContext[]): void {
	process.stdout.write(`auto-suggest: ${cards.length} unclassified cards\n\n`);
	const tallies = { faaWritten: 0, cfiEssential: 0, both: 0 };
	for (const ctx of cards) {
		const suggestion = computeSuggestion(ctx);
		if (suggestion.tier === QUESTION_TIERS.FAA_WRITTEN) tallies.faaWritten++;
		else if (suggestion.tier === QUESTION_TIERS.CFI_ESSENTIAL) tallies.cfiEssential++;
		else tallies.both++;
		const front = ctx.front.replace(/\s+/g, ' ').slice(0, 80);
		process.stdout.write(
			`${ctx.relPath}#${ctx.entryIndex}  ` + `tier=${suggestion.tier} (${suggestion.confidence})  ` + `-- ${front}\n`,
		);
		if (suggestion.reasoning !== '') {
			process.stdout.write(`    reasoning: ${suggestion.reasoning}\n`);
		}
	}
	process.stdout.write('\n');
	process.stdout.write(
		`tallies: faa-written=${tallies.faaWritten} cfi-essential=${tallies.cfiEssential} both=${tallies.both}\n`,
	);
}

function restoreStdinAndExit(code: number): never {
	const stdin = process.stdin;
	if (typeof stdin.setRawMode === 'function' && stdin.isRaw === true) stdin.setRawMode(false);
	stdin.pause();
	process.exit(code);
}

async function runInteractive(cards: readonly CardContext[], flags: CliFlags): Promise<void> {
	const counters: Counters = { classified: 0, faaWritten: 0, cfiEssential: 0, both: 0, skipped: 0 };
	const total = cards.length;

	if (total === 0) {
		process.stdout.write('No unclassified cards in scope. Nothing to do.\n');
		return;
	}

	process.stdout.write(`classify-card-tier: ${flags.dryRun ? 'DRY-RUN' : 'WRITE'}\n`);
	process.stdout.write(`${total} unclassified cards in scope.\n`);
	if (flags.nodeSlug !== null) process.stdout.write(`scope: node=${flags.nodeSlug}\n`);
	if (flags.startFrom !== null) process.stdout.write(`scope: start-from=${flags.startFrom}\n`);

	const onSigint = (): void => {
		process.stdout.write('\n(SIGINT) quitting; classifications already written are preserved.\n');
		restoreStdinAndExit(130);
	};
	process.on('SIGINT', onSigint);

	for (let i = 0; i < cards.length; i++) {
		const ctx = cards[i];
		const suggestion = computeSuggestion(ctx);

		let helpPending = false;
		// Inner keypress loop: `?` re-prints help without consuming the slot.
		// Any other valid key falls through to the mutation.
		for (;;) {
			if (!helpPending) renderCardPrompt(ctx, suggestion, { idx: i + 1, total });
			helpPending = false;
			process.stdout.write(`Tier? [f]aa-written / [c]fi-essential / [b]oth / [s]kip / [q]uit / [?]help `);
			process.stdout.write(`(suggested: ${suggestion.tier}) `);
			const key = await readKey();
			process.stdout.write(`${key === '\x03' ? '^C' : key}\n`);

			if (key === '\x03' || key === 'q' || key === 'Q') {
				process.removeListener('SIGINT', onSigint);
				process.stdout.write('\nquit. classifications already written are preserved.\n');
				renderRunningTotal(counters, total);
				restoreStdinAndExit(0);
			}
			if (key === '?' || key === 'h' || key === 'H') {
				process.stdout.write('\n');
				printHelp();
				helpPending = true;
				continue;
			}
			if (key === 's' || key === 'S') {
				counters.skipped++;
				renderRunningTotal(counters, total);
				break;
			}
			const tier = TIER_KEYS[key];
			if (tier === undefined) {
				process.stdout.write(`unknown key '${key}'. Press ? for help.\n`);
				helpPending = true;
				continue;
			}
			// Apply.
			if (flags.dryRun) {
				process.stdout.write(`(dry-run) would set question_tier=${tier} on ${ctx.relPath}#${ctx.entryIndex}\n`);
			} else {
				const located = locateCardOnDisk(ctx);
				if (located === null) {
					process.stdout.write(
						`WARN: ${ctx.relPath}#${ctx.entryIndex} no longer matches on disk (already classified or removed). Skipping.\n`,
					);
					counters.skipped++;
					renderRunningTotal(counters, total);
					break;
				}
				applyTierMutation(ctx.absPath, located.entryIndex, located.blockIndex, tier);
				process.stdout.write(`wrote question_tier=${tier} -> ${ctx.relPath}#${located.entryIndex}\n`);
			}
			counters.classified++;
			if (tier === QUESTION_TIERS.FAA_WRITTEN) counters.faaWritten++;
			else if (tier === QUESTION_TIERS.CFI_ESSENTIAL) counters.cfiEssential++;
			else counters.both++;
			renderRunningTotal(counters, total);
			break;
		}
	}

	process.removeListener('SIGINT', onSigint);
	process.stdout.write('\nDone. All unclassified cards walked.\n');
	renderRunningTotal(counters, total);
}

async function main(): Promise<void> {
	const flags = parseFlags(process.argv.slice(2));

	const glob = new Glob(NODE_GLOB);
	const targetPaths: string[] = [];
	for (const file of glob.scanSync({ cwd: REPO_ROOT, absolute: true })) targetPaths.push(file);
	targetPaths.sort();

	const records: NodeRecord[] = [];
	for (const absPath of targetPaths) {
		const rec = loadNode(absPath);
		if (rec === null) continue;
		if (flags.nodeSlug !== null && rec.nodeId !== flags.nodeSlug) continue;
		records.push(rec);
	}

	// `--start-from` filters AFTER node loading so users can pass either a
	// node id or a path prefix (we match against node id, falling back to
	// relpath prefix). The list is sorted alphabetically by relpath so
	// resume order is deterministic across sessions.
	let filtered = records;
	if (flags.startFrom !== null) {
		const startIdx = records.findIndex(
			(r) => r.nodeId === flags.startFrom || r.relPath.startsWith(flags.startFrom as string),
		);
		if (startIdx === -1) {
			process.stderr.write(`--start-from '${flags.startFrom}' did not match any node.\n`);
			process.exit(1);
		}
		filtered = records.slice(startIdx);
	}

	const cards = collectUnclassifiedCards(filtered);

	if (flags.autoSuggest) {
		runAutoSuggest(cards);
		return;
	}

	await runInteractive(cards, flags);
}

await main();
