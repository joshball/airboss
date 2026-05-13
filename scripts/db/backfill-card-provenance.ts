#!/usr/bin/env bun

/**
 * Backfill `question_tier`, `source_authority`, and `acs_codes` on
 * existing yaml-cards entries from their surrounding context (entry
 * tags, knowledge-node frontmatter, existing prose references).
 *
 * Phase 2 of the card-question-tier WP: Phase 1 shipped the schema +
 * parser + seeder support and hand-promoted six pilot cards. Phase 2
 * (this script) auto-populates wherever the inference is safe, leaving
 * the genuine FAA-vs-CFI judgement calls for a separate hand pass.
 *
 * The script is idempotent: running it twice produces no second-pass
 * diff because every inference rule short-circuits on "field already
 * populated."
 *
 * Inference rules (applied in order, first match wins; "skip" means the
 * entry already has the field set and we leave it untouched):
 *
 *   acs_codes
 *     1. If `acs_codes:` already present -> skip.
 *     2. If `tags:` contains any token matching `ACS_CODE_PATTERN` ->
 *        promote those tokens to `acs_codes` and remove them from tags.
 *     3. Else if the node's frontmatter has a top-level `acs_codes:`
 *        list -> propagate.
 *     4. Else leave null.
 *
 *   source_authority
 *     1. If `source_authority:` already present -> skip.
 *     2. If the node's frontmatter `references:` block has FAA-H-* and
 *        other authority entries (AC, AIM, CFR, PHAK), map each to the
 *        existing `SOURCE_AUTHORITY_KINDS` and emit one entry per ref.
 *        FAA-H-8083-25* -> phak, FAA-H-8083-3* -> afh, other FAA-H-*
 *        and POH / FAA-S / SAFO / etc. -> other.
 *     3. Else leave null.
 *
 *     Note: the task brief mentions a `handbook-citation` kind, but
 *     `SOURCE_AUTHORITY_KIND_VALUES` only accepts cfr / ac / aim / phak
 *     / afh / other. Emitting an unknown kind would crash the seed-cards
 *     parser at every subsequent `bun run db reset`. The script maps
 *     handbook citations onto the existing kinds and the seeder
 *     round-trips clean.
 *
 *   question_tier
 *     1. If `question_tier:` already present -> skip.
 *     2. If tags contain `faa-written` or `private-pilot-written` ->
 *        `faa-written`.
 *     3. If tags contain `cfi-fundamentals` or
 *        `cfi-elements-of-instruction` -> `cfi-essential`.
 *     4. If both groups present -> `both`.
 *     5. Else leave null.
 *
 *     The current corpus has zero tier-indicating tags, so the
 *     conservative rule leaves all ~256 unset entries null -- those are
 *     the WP's hand-classification work, not this script's.
 *
 * The script edits each yaml-cards block via `yaml.parseDocument` so
 * block-scalar (`|`) literals, flow-style tag arrays, comments, and key
 * order survive untouched. The rest of the node.md file (frontmatter
 * text, markdown body, fence boundaries) is preserved exactly.
 *
 * Usage:
 *   bun scripts/db/backfill-card-provenance.ts             # dry-run, default
 *   bun scripts/db/backfill-card-provenance.ts --apply     # write changes
 *   bun scripts/db/backfill-card-provenance.ts --node <slug>
 */

import { Glob } from 'bun';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
	ACS_CODE_PATTERN,
	QUESTION_TIERS,
	type QuestionTier,
	SOURCE_AUTHORITY_KINDS,
	type SourceAuthority,
} from '@ab/constants';
import { parseDocument, parse as parseYaml, Scalar, YAMLMap, YAMLSeq } from 'yaml';

const REPO_ROOT = new URL('../../', import.meta.url).pathname;
const NODE_GLOB = 'course/knowledge/**/node.md';
const FRONTMATTER_DELIM = '---';
const YAML_CARDS_FENCE_OPEN = /^```yaml-cards\s*$/;
const FENCE_CLOSE = /^```\s*$/;
const TIER_FAA_TAGS = new Set(['faa-written', 'private-pilot-written']);
const TIER_CFI_TAGS = new Set(['cfi-fundamentals', 'cfi-elements-of-instruction']);

interface CliFlags {
	apply: boolean;
	nodeSlug: string | null;
}

interface FrontmatterContext {
	acsCodes: string[] | null;
	references: SourceAuthority[] | null;
}

interface Counters {
	nodesWalked: number;
	nodesChanged: number;
	cardsWalked: number;
	tierInferred: number;
	tierSkipped: number;
	tierNull: number;
	authorityInferred: number;
	authoritySkipped: number;
	authorityNull: number;
	codesInferred: number;
	codesSkipped: number;
	codesNull: number;
}

function emptyCounters(): Counters {
	return {
		nodesWalked: 0,
		nodesChanged: 0,
		cardsWalked: 0,
		tierInferred: 0,
		tierSkipped: 0,
		tierNull: 0,
		authorityInferred: 0,
		authoritySkipped: 0,
		authorityNull: 0,
		codesInferred: 0,
		codesSkipped: 0,
		codesNull: 0,
	};
}

function parseFlags(argv: readonly string[]): CliFlags {
	let apply = false;
	let nodeSlug: string | null = null;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--apply') {
			apply = true;
			continue;
		}
		if (a === '--dry-run') {
			apply = false;
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
		if (a === '-h' || a === '--help' || a === 'help') {
			printHelp();
			process.exit(0);
		}
		throw new Error(`Unknown flag: ${a}`);
	}
	return { apply, nodeSlug };
}

function printHelp(): void {
	process.stdout.write(
		[
			'Usage: bun scripts/db/backfill-card-provenance.ts [--apply] [--node <slug>]',
			'',
			'  --dry-run        (default) Print what would change; do not write.',
			'  --apply          Write changes to disk.',
			'  --node <slug>    Restrict to one node by frontmatter id (e.g. wx-reading-metars-tafs).',
			'',
		].join('\n'),
	);
}

function splitFrontmatter(text: string): { yamlText: string; bodyText: string; bodyStart: number } | null {
	if (!text.startsWith(`${FRONTMATTER_DELIM}\n`)) return null;
	const end = text.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length + 1);
	if (end === -1) return null;
	const yamlText = text.slice(FRONTMATTER_DELIM.length + 1, end);
	const bodyStart = end + `\n${FRONTMATTER_DELIM}`.length;
	const rawBody = text.slice(bodyStart);
	const trimmed = rawBody.replace(/^\r?\n/, '');
	return { yamlText, bodyText: trimmed, bodyStart: bodyStart + (rawBody.length - trimmed.length) };
}

/**
 * Map a free-form `source:` string from a node's frontmatter
 * `references:` block onto a `{ kind, cite }` entry, or null when the
 * source doesn't look like a citable authority (e.g. a freeform note).
 * The mapping is conservative -- when in doubt we emit `other` rather
 * than guessing wrong.
 */
function mapFrontmatterRefToAuthority(source: string, detail?: string): SourceAuthority | null {
	const s = source.trim();
	if (s === '') return null;
	const compact = (() => {
		// "FAA-H-8083-3, Chapter 5" -> "FAA-H-8083-3 Chapter 5"
		if (detail && detail.trim() !== '') return `${s} ${detail.trim()}`;
		return s;
	})();
	// 14 CFR (any part)
	if (/^14\s*CFR\b/i.test(s) || /^CFR\b/i.test(s)) {
		return { kind: SOURCE_AUTHORITY_KINDS.CFR, cite: compact };
	}
	if (/^AC\s+/i.test(s) || /^AC-/i.test(s)) {
		return { kind: SOURCE_AUTHORITY_KINDS.AC, cite: compact };
	}
	if (/^AIM\b/i.test(s)) {
		return { kind: SOURCE_AUTHORITY_KINDS.AIM, cite: compact };
	}
	if (/^PHAK\b/i.test(s)) {
		return { kind: SOURCE_AUTHORITY_KINDS.PHAK, cite: compact };
	}
	if (/^AFH\b/i.test(s)) {
		return { kind: SOURCE_AUTHORITY_KINDS.AFH, cite: compact };
	}
	// FAA-H-8083-25 -> PHAK; -3 -> AFH; otherwise -> OTHER.
	const faaHandbook = s.match(/^FAA-H-8083-(\d+)([A-Z]*)/i);
	if (faaHandbook) {
		const series = faaHandbook[1];
		if (series === '25') return { kind: SOURCE_AUTHORITY_KINDS.PHAK, cite: compact };
		if (series === '3') return { kind: SOURCE_AUTHORITY_KINDS.AFH, cite: compact };
		return { kind: SOURCE_AUTHORITY_KINDS.OTHER, cite: compact };
	}
	return null;
}

function extractFrontmatterContext(yamlText: string): FrontmatterContext {
	const parsed = parseYaml(yamlText) as Record<string, unknown> | null;
	if (!parsed || typeof parsed !== 'object') {
		return { acsCodes: null, references: null };
	}
	const acsCodes = (() => {
		const raw = parsed.acs_codes;
		if (!Array.isArray(raw)) return null;
		const out: string[] = [];
		for (const item of raw) {
			if (typeof item !== 'string') continue;
			const trimmed = item.trim();
			if (ACS_CODE_PATTERN.test(trimmed)) out.push(trimmed);
		}
		return out.length > 0 ? out : null;
	})();
	const references = (() => {
		const raw = parsed.references;
		if (!Array.isArray(raw)) return null;
		const out: SourceAuthority[] = [];
		const seen = new Set<string>();
		for (const item of raw) {
			if (typeof item !== 'object' || item === null) continue;
			const rec = item as Record<string, unknown>;
			const source = typeof rec.source === 'string' ? rec.source : null;
			if (source === null) continue;
			const detail = typeof rec.detail === 'string' ? rec.detail : undefined;
			const authority = mapFrontmatterRefToAuthority(source, detail);
			if (authority === null) continue;
			const key = `${authority.kind}::${authority.cite}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(authority);
		}
		return out.length > 0 ? out : null;
	})();
	return { acsCodes, references };
}

function inferAcsCodesFromTags(entry: YAMLMap): string[] | null {
	const tags = entry.get('tags', true);
	if (!(tags instanceof YAMLSeq)) return null;
	const matched: string[] = [];
	for (const item of tags.items) {
		const v = item instanceof Scalar ? item.value : item;
		if (typeof v !== 'string') continue;
		const trimmed = v.trim();
		if (ACS_CODE_PATTERN.test(trimmed) && !matched.includes(trimmed)) {
			matched.push(trimmed);
		}
	}
	return matched.length > 0 ? matched : null;
}

function removeTagsFromEntry(entry: YAMLMap, toRemove: ReadonlySet<string>): void {
	if (toRemove.size === 0) return;
	const tags = entry.get('tags', true);
	if (!(tags instanceof YAMLSeq)) return;
	tags.items = tags.items.filter((item) => {
		const v = item instanceof Scalar ? item.value : item;
		return typeof v !== 'string' || !toRemove.has(v.trim());
	});
}

function inferQuestionTierFromTags(entry: YAMLMap): QuestionTier | null {
	const tags = entry.get('tags', true);
	if (!(tags instanceof YAMLSeq)) return null;
	let hasFaa = false;
	let hasCfi = false;
	for (const item of tags.items) {
		const v = item instanceof Scalar ? item.value : item;
		if (typeof v !== 'string') continue;
		const trimmed = v.trim();
		if (TIER_FAA_TAGS.has(trimmed)) hasFaa = true;
		if (TIER_CFI_TAGS.has(trimmed)) hasCfi = true;
	}
	if (hasFaa && hasCfi) return QUESTION_TIERS.BOTH;
	if (hasFaa) return QUESTION_TIERS.FAA_WRITTEN;
	if (hasCfi) return QUESTION_TIERS.CFI_ESSENTIAL;
	return null;
}

function hasKey(entry: YAMLMap, key: string): boolean {
	const v = entry.get(key);
	return v !== undefined && v !== null;
}

interface EntryMutation {
	entryIndex: number;
	front: string;
	addedTier: QuestionTier | null;
	addedAuthority: SourceAuthority[] | null;
	addedCodes: string[] | null;
	removedTags: string[];
}

interface NodeProcessResult {
	relPath: string;
	nodeId: string;
	originalText: string;
	newText: string;
	changed: boolean;
	mutations: EntryMutation[];
	cardCount: number;
	tierFreshlyNull: number;
	tierAlreadySet: number;
	tierInferred: number;
	authorityFreshlyNull: number;
	authorityAlreadySet: number;
	authorityInferred: number;
	codesFreshlyNull: number;
	codesAlreadySet: number;
	codesInferred: number;
}

/**
 * Locate every yaml-cards fenced block in a body's line stream and
 * return [startLine, endLine) ranges. `startLine` points at the opening
 * fence, `endLine` at the closing fence. Both are inclusive when used
 * with `slice` semantics where appropriate.
 */
function locateYamlCardsBlocks(bodyLines: readonly string[]): Array<{ open: number; close: number }> {
	const out: Array<{ open: number; close: number }> = [];
	let i = 0;
	while (i < bodyLines.length) {
		if (YAML_CARDS_FENCE_OPEN.test(bodyLines[i])) {
			let j = i + 1;
			while (j < bodyLines.length && !FENCE_CLOSE.test(bodyLines[j])) j++;
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

/**
 * Detect the indent prefix used for the block-content lines. yaml-cards
 * blocks inside the markdown body are always flush-left (the fence and
 * the YAML share column 0), but the helper guards against indented
 * variants in case authoring drifts.
 */
function detectIndent(blockLines: readonly string[]): string {
	for (const line of blockLines) {
		if (line.trim() === '') continue;
		const m = line.match(/^(\s*)/);
		return m ? m[1] : '';
	}
	return '';
}

function processNode(absPath: string): NodeProcessResult | null {
	const raw = readFileSync(absPath, 'utf8');
	const relPath = relative(REPO_ROOT, absPath);
	const split = splitFrontmatter(raw);
	if (!split) return null;
	const frontmatter = parseYaml(split.yamlText) as Record<string, unknown> | null;
	if (!frontmatter || typeof frontmatter.id !== 'string') return null;
	const nodeId = frontmatter.id;
	const fmCtx = extractFrontmatterContext(split.yamlText);

	const bodyLines = split.bodyText.split('\n');
	const blocks = locateYamlCardsBlocks(bodyLines);
	if (blocks.length === 0) return null;

	const mutations: EntryMutation[] = [];
	let cardCount = 0;
	let tierFreshlyNull = 0;
	let tierAlreadySet = 0;
	let tierInferred = 0;
	let authorityFreshlyNull = 0;
	let authorityAlreadySet = 0;
	let authorityInferred = 0;
	let codesFreshlyNull = 0;
	let codesAlreadySet = 0;
	let codesInferred = 0;

	// Walk blocks back-to-front so line-index based replacement is safe.
	const blocksReversed = [...blocks].reverse();
	const replacedBody = [...bodyLines];

	for (const range of blocksReversed) {
		const inner = bodyLines.slice(range.open + 1, range.close);
		const indent = detectIndent(inner);
		const blockSource = inner.map((l) => (indent === '' ? l : l.replace(new RegExp(`^${indent}`), ''))).join('\n');
		const doc = parseDocument(blockSource);
		const seq = doc.contents;
		if (!(seq instanceof YAMLSeq)) {
			throw new Error(`${relPath}: yaml-cards block did not parse to a sequence`);
		}

		let blockChanged = false;

		for (let entryIdx = 0; entryIdx < seq.items.length; entryIdx++) {
			const entry = seq.items[entryIdx];
			if (!(entry instanceof YAMLMap)) {
				throw new Error(`${relPath}: yaml-cards[${entryIdx}] is not an object`);
			}
			cardCount++;

			const frontVal = entry.get('front');
			const frontText = typeof frontVal === 'string' ? frontVal.slice(0, 80) : `(entry ${entryIdx})`;

			let mutTier: QuestionTier | null = null;
			let mutAuthority: SourceAuthority[] | null = null;
			let mutCodes: string[] | null = null;
			const removedTags: string[] = [];

			// --- acs_codes ---
			if (hasKey(entry, 'acs_codes')) {
				codesAlreadySet++;
			} else {
				const fromTags = inferAcsCodesFromTags(entry);
				if (fromTags !== null) {
					mutCodes = fromTags;
					codesInferred++;
				} else if (fmCtx.acsCodes !== null) {
					mutCodes = [...fmCtx.acsCodes];
					codesInferred++;
				} else {
					codesFreshlyNull++;
				}
			}

			// --- source_authority ---
			if (hasKey(entry, 'source_authority')) {
				authorityAlreadySet++;
			} else if (fmCtx.references !== null) {
				mutAuthority = fmCtx.references.map((r) => ({ ...r }));
				authorityInferred++;
			} else {
				authorityFreshlyNull++;
			}

			// --- question_tier ---
			if (hasKey(entry, 'question_tier')) {
				tierAlreadySet++;
			} else {
				const tier = inferQuestionTierFromTags(entry);
				if (tier !== null) {
					mutTier = tier;
					tierInferred++;
				} else {
					tierFreshlyNull++;
				}
			}

			// Apply mutations to the YAMLMap.
			if (mutCodes !== null) {
				const codesNode = doc.createNode(mutCodes, { flow: true });
				entry.set('acs_codes', codesNode);
				const toRemove = new Set(mutCodes);
				removeTagsFromEntry(entry, toRemove);
				for (const t of mutCodes) removedTags.push(t);
				blockChanged = true;
			}
			if (mutAuthority !== null) {
				// Block-style sequence-of-mappings -- matches the pilot cards.
				entry.set(
					'source_authority',
					mutAuthority.map((a) => ({ kind: a.kind, cite: a.cite })),
				);
				blockChanged = true;
			}
			if (mutTier !== null) {
				entry.set('question_tier', mutTier);
				blockChanged = true;
			}

			if (mutTier !== null || mutAuthority !== null || mutCodes !== null) {
				mutations.push({
					entryIndex: entryIdx,
					front: frontText,
					addedTier: mutTier,
					addedAuthority: mutAuthority,
					addedCodes: mutCodes,
					removedTags,
				});
			}
		}

		if (blockChanged) {
			const rendered = doc.toString({
				flowCollectionPadding: false,
				lineWidth: 0,
			});
			const renderedLines = rendered.split('\n');
			// Drop trailing empty line that yaml.toString adds.
			while (renderedLines.length > 0 && renderedLines[renderedLines.length - 1] === '') {
				renderedLines.pop();
			}
			const reIndented = indent === '' ? renderedLines : renderedLines.map((l) => (l === '' ? l : `${indent}${l}`));
			replacedBody.splice(range.open + 1, range.close - range.open - 1, ...reIndented);
		}
	}

	const newBody = replacedBody.join('\n');
	const newText = `${FRONTMATTER_DELIM}\n${split.yamlText}\n${FRONTMATTER_DELIM}\n${newBody}`;
	const changed = newText !== raw;

	return {
		relPath,
		nodeId,
		originalText: raw,
		newText,
		changed,
		mutations,
		cardCount,
		tierFreshlyNull,
		tierAlreadySet,
		tierInferred,
		authorityFreshlyNull,
		authorityAlreadySet,
		authorityInferred,
		codesFreshlyNull,
		codesAlreadySet,
		codesInferred,
	};
}

function formatMutationLine(m: EntryMutation): string {
	const parts: string[] = [];
	if (m.addedTier !== null) parts.push(`tier=${m.addedTier}`);
	if (m.addedAuthority !== null) parts.push(`authority=${m.addedAuthority.map((a) => a.kind).join(',')}`);
	if (m.addedCodes !== null) parts.push(`codes=${m.addedCodes.join(',')}`);
	if (m.removedTags.length > 0) parts.push(`-tags=${m.removedTags.join(',')}`);
	return `    [${m.entryIndex}] ${parts.join(' ')}  -- ${m.front}`;
}

async function main(): Promise<void> {
	const flags = parseFlags(process.argv.slice(2));
	const counters = emptyCounters();

	const glob = new Glob(NODE_GLOB);
	const targetPaths: string[] = [];
	for (const file of glob.scanSync({ cwd: REPO_ROOT, absolute: true })) targetPaths.push(file);
	targetPaths.sort();

	process.stdout.write(
		`backfill-card-provenance: ${flags.apply ? 'APPLY' : 'dry-run'}${flags.nodeSlug ? ` node=${flags.nodeSlug}` : ''}\n`,
	);
	process.stdout.write(`Walking ${targetPaths.length} node.md files...\n\n`);

	for (const absPath of targetPaths) {
		const result = processNode(absPath);
		if (result === null) continue;
		if (flags.nodeSlug !== null && result.nodeId !== flags.nodeSlug) continue;

		counters.nodesWalked++;
		counters.cardsWalked += result.cardCount;
		counters.tierInferred += result.tierInferred;
		counters.tierSkipped += result.tierAlreadySet;
		counters.tierNull += result.tierFreshlyNull;
		counters.authorityInferred += result.authorityInferred;
		counters.authoritySkipped += result.authorityAlreadySet;
		counters.authorityNull += result.authorityFreshlyNull;
		counters.codesInferred += result.codesInferred;
		counters.codesSkipped += result.codesAlreadySet;
		counters.codesNull += result.codesFreshlyNull;

		if (!result.changed) continue;
		counters.nodesChanged++;

		process.stdout.write(
			`${result.relPath}  (${result.mutations.length} mutation${result.mutations.length === 1 ? '' : 's'})\n`,
		);
		for (const m of result.mutations) process.stdout.write(`${formatMutationLine(m)}\n`);

		if (flags.apply) writeFileSync(absPath, result.newText, 'utf8');
	}

	process.stdout.write('\n');
	process.stdout.write(`Walked ${counters.nodesWalked} nodes / ${counters.cardsWalked} cards.\n`);
	process.stdout.write(
		`Inferred: ${counters.tierInferred} tier, ${counters.authorityInferred} authority, ${counters.codesInferred} codes.\n`,
	);
	process.stdout.write(
		`Skipped (already populated): tier=${counters.tierSkipped} authority=${counters.authoritySkipped} codes=${counters.codesSkipped}.\n`,
	);
	process.stdout.write(
		`Genuinely null: tier=${counters.tierNull} authority=${counters.authorityNull} codes=${counters.codesNull}.\n`,
	);
	process.stdout.write(`Nodes mutated: ${counters.nodesChanged}.\n`);

	if (!flags.apply && counters.nodesChanged > 0) {
		process.stdout.write('\n(dry-run; re-run with --apply to write.)\n');
	}
}

await main();
