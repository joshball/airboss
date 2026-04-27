/**
 * Lesson Markdown walker for the `airboss-ref:` system.
 *
 * Source of truth: ADR 019 §3.4 (frontmatter acks) + §1.1 (URL form) + §1.5 rows
 * 7-9 (link-text-aware ERROR/NOTICE).
 *
 * Walks one lesson file, splits frontmatter from body, parses YAML acks, and
 * emits a list of `IdentifierOccurrence`s for the rule engine. The walker is
 * regex + state-machine, mirroring `libs/aviation/src/wikilink/parser.ts`.
 *
 * What this module owns directly (lesson-parser-internal findings, not §1.5
 * rule-engine findings, so they ship with `ruleId: -1`):
 *
 *   - Malformed frontmatter YAML
 *   - Frontmatter ack shape errors (missing `target`, etc.)
 *   - Undefined Markdown reference labels
 *   - Two acks for the same target without explicit `id` labels (§3.4)
 *   - Orphan acks (target not referenced in body) -- WARNING per §3.4
 *
 * What this module surfaces but doesn't decide:
 *
 *   - Identifier occurrences (with link text, source span, bare-or-not flag)
 *     -- the validator processes them.
 */

import { parse as parseYaml, YAMLParseError } from 'yaml';
import type {
	IdentifierOccurrence,
	LessonAcknowledgment,
	LessonParseResult,
	SourceId,
	SourceLocation,
	ValidationFinding,
} from './types.ts';

const SCHEME_PREFIX = 'airboss-ref:';
const FRONTMATTER_FENCE = '---';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Parse one lesson file. `source` is the file contents; `filePath` is the
 * absolute or repo-relative path used for source locations.
 *
 * Never throws. All failures are returned on the `findings` array.
 */
export function parseLesson(filePath: string, source: string): LessonParseResult {
	const findings: ValidationFinding[] = [];

	const split = splitFrontmatter(source);
	const body = split.body;
	const lineOffset = split.bodyStartLine - 1; // body line N => file line N + lineOffset

	// ---- Frontmatter --------------------------------------------------
	const acks = parseFrontmatterAcks(filePath, split.frontmatter, split.frontmatterStartLine, findings);

	// ---- Body walk ----------------------------------------------------
	const labelDefs = collectReferenceLabelDefinitions(body, filePath, lineOffset);
	const occurrences = walkBody(body, filePath, lineOffset, labelDefs, findings);

	// ---- Cross-checks -------------------------------------------------
	if (acks.length > 0) {
		emitOrphanAckWarnings(filePath, acks, occurrences, findings);
		emitMultipleAckSameTargetErrors(acks, occurrences, findings);
	}

	return { file: filePath, acknowledgments: acks, occurrences, findings };
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

interface FrontmatterSplit {
	frontmatter: string | null;
	/** 1-based line number in the original file where the YAML body starts. */
	frontmatterStartLine: number;
	body: string;
	/** 1-based line number in the original file where the body content starts. */
	bodyStartLine: number;
}

function splitFrontmatter(source: string): FrontmatterSplit {
	if (!source.startsWith(`${FRONTMATTER_FENCE}\n`) && !source.startsWith(`${FRONTMATTER_FENCE}\r\n`)) {
		return { frontmatter: null, frontmatterStartLine: 0, body: source, bodyStartLine: 1 };
	}

	const firstNewline = source.indexOf('\n');
	const startOfFrontmatter = firstNewline + 1;
	const closingFence = source.indexOf(`\n${FRONTMATTER_FENCE}`, startOfFrontmatter);
	if (closingFence === -1) {
		return { frontmatter: null, frontmatterStartLine: 0, body: source, bodyStartLine: 1 };
	}

	const frontmatter = source.slice(startOfFrontmatter, closingFence);
	// Walk past the closing `---` and the trailing newline (if any).
	let cursor = closingFence + 1 + FRONTMATTER_FENCE.length;
	if (source[cursor] === '\r') cursor += 1;
	if (source[cursor] === '\n') cursor += 1;

	// Line number in the file where body[0] sits: count newlines in the prefix
	// `source[0..cursor)` and add 1.
	let prefixNewlines = 0;
	for (let i = 0; i < cursor; i += 1) {
		if (source.charCodeAt(i) === 10) prefixNewlines += 1;
	}
	const bodyStartLine = prefixNewlines + 1;

	return {
		frontmatter,
		frontmatterStartLine: 2, // line 1 is `---`, frontmatter starts at line 2
		body: source.slice(cursor),
		bodyStartLine,
	};
}

function parseFrontmatterAcks(
	file: string,
	frontmatter: string | null,
	startLine: number,
	findings: ValidationFinding[],
): readonly LessonAcknowledgment[] {
	if (frontmatter === null) return [];

	let parsed: unknown;
	try {
		parsed = parseYaml(frontmatter);
	} catch (err) {
		const message = err instanceof YAMLParseError ? err.message : (err as Error).message;
		findings.push({
			severity: 'error',
			ruleId: -1,
			message: `frontmatter YAML is malformed: ${message}`,
			location: { file, line: startLine, column: 1 },
			identifier: null,
		});
		return [];
	}

	if (parsed === null || typeof parsed !== 'object') return [];
	const block = parsed as Record<string, unknown>;
	const raw = block.acknowledgments;
	if (raw === undefined) return [];
	if (!Array.isArray(raw)) {
		findings.push({
			severity: 'error',
			ruleId: -1,
			message: 'frontmatter `acknowledgments` must be a list',
			location: { file, line: startLine, column: 1 },
			identifier: null,
		});
		return [];
	}

	const acks: LessonAcknowledgment[] = [];
	for (let index = 0; index < raw.length; index += 1) {
		const entry = raw[index];
		if (entry === null || typeof entry !== 'object') {
			findings.push({
				severity: 'error',
				ruleId: -1,
				message: `frontmatter \`acknowledgments[${index}]\` must be an object`,
				location: { file, line: startLine, column: 1 },
				identifier: null,
			});
			continue;
		}
		const e = entry as Record<string, unknown>;
		const target = e.target;
		if (typeof target !== 'string' || target.length === 0) {
			findings.push({
				severity: 'error',
				ruleId: -1,
				message: `frontmatter \`acknowledgments[${index}].target\` is required and must be a string`,
				location: { file, line: startLine, column: 1 },
				identifier: null,
			});
			continue;
		}
		const id = typeof e.id === 'string' && e.id.length > 0 ? e.id : undefined;
		const superseder = typeof e.superseder === 'string' && e.superseder.length > 0 ? e.superseder : undefined;
		const reason = typeof e.reason === 'string' && e.reason.length > 0 ? e.reason : undefined;
		const historical = e.historical === true;
		const note = typeof e.note === 'string' ? e.note : undefined;

		const ack: LessonAcknowledgment = {
			id,
			target: target as SourceId,
			superseder: superseder as SourceId | undefined,
			reason,
			historical,
			note,
		};
		acks.push(ack);
	}

	return acks;
}

// ---------------------------------------------------------------------------
// Reference-style link definitions: `[label]: airboss-ref:...`
// ---------------------------------------------------------------------------

/** Map from lower-case label to the URL it resolves to. */
type LabelDefs = Map<string, { url: string; location: SourceLocation }>;

const REF_DEF_REGEX = /^\s{0,3}\[([^\]\n]+)\]:\s*(\S+)/gm;

function collectReferenceLabelDefinitions(body: string, file: string, lineOffset: number): LabelDefs {
	const defs: LabelDefs = new Map();
	REF_DEF_REGEX.lastIndex = 0;
	for (const match of body.matchAll(REF_DEF_REGEX)) {
		const label = match[1];
		const url = match[2];
		if (label === undefined || url === undefined) continue;
		const labelKey = label.toLowerCase();
		if (defs.has(labelKey)) continue; // first wins, matches CommonMark
		const offsetInBody = match.index ?? 0;
		const location = locationFromOffset(file, body, offsetInBody, lineOffset);
		defs.set(labelKey, { url, location });
	}
	return defs;
}

// ---------------------------------------------------------------------------
// Body walk: regex + fence-tracking state machine
// ---------------------------------------------------------------------------

interface SkipRange {
	readonly start: number;
	readonly end: number;
}

function walkBody(
	body: string,
	file: string,
	lineOffset: number,
	labelDefs: LabelDefs,
	findings: ValidationFinding[],
): readonly IdentifierOccurrence[] {
	const skipRanges = computeSkipRanges(body);

	const occurrences: IdentifierOccurrence[] = [];

	// Pass 1: inline links `[text](airboss-ref:...)` and reference-style links `[text][label]`.
	collectLinks(body, file, lineOffset, labelDefs, skipRanges, occurrences, findings);

	// Pass 2: bare URLs anywhere in body that aren't inside an existing
	// occurrence's link, code, or reference-definition span.
	collectBareUrls(body, file, lineOffset, skipRanges, occurrences);

	return occurrences;
}

/**
 * Identify byte ranges within `body` that should be skipped during scans:
 *
 *  - Fenced code blocks (` ``` ` and `~~~`)
 *  - Inline code spans (single or multi backtick)
 *  - Reference-definition lines (their URLs are link targets, not bare URLs)
 *
 * Returns a sorted array of half-open `[start, end)` ranges.
 */
function computeSkipRanges(body: string): readonly SkipRange[] {
	const ranges: { start: number; end: number }[] = [];
	const len = body.length;
	let i = 0;

	while (i < len) {
		const ch = body[i];

		// Fenced code block at line start (allow up to 3 leading spaces).
		if (ch === '`' || ch === '~') {
			const fenceEnd = tryEnterFence(body, i);
			if (fenceEnd !== null) {
				ranges.push({ start: i, end: fenceEnd });
				i = fenceEnd;
				continue;
			}
		}

		// Inline code span.
		if (ch === '`') {
			const spanEnd = skipInlineCode(body, i);
			if (spanEnd !== null) {
				ranges.push({ start: i, end: spanEnd });
				i = spanEnd;
				continue;
			}
		}

		i += 1;
	}

	// Reference-definition lines: `[label]: <url>` -- treat the URL portion
	// only as a skip range so we don't double-count it as a bare URL.
	REF_DEF_REGEX.lastIndex = 0;
	for (const match of body.matchAll(REF_DEF_REGEX)) {
		const fullStart = match.index ?? 0;
		const fullEnd = fullStart + match[0].length;
		ranges.push({ start: fullStart, end: fullEnd });
	}

	ranges.sort((a, b) => a.start - b.start);
	return ranges;
}

function isInSkipRange(offset: number, ranges: readonly SkipRange[]): boolean {
	for (const range of ranges) {
		if (offset >= range.start && offset < range.end) return true;
		if (offset < range.start) break; // ranges are sorted
	}
	return false;
}

// ---------------------------------------------------------------------------
// Inline + reference-style link extraction
// ---------------------------------------------------------------------------

const INLINE_LINK_REGEX = /\[([^\]\n]*)\]\((airboss-ref:[^)\s]+)\)/g;
const REF_STYLE_LINK_REGEX = /\[([^\]\n]+)\]\[([^\]\n]*)\]/g;

function collectLinks(
	body: string,
	file: string,
	lineOffset: number,
	labelDefs: LabelDefs,
	skipRanges: readonly SkipRange[],
	out: IdentifierOccurrence[],
	findings: ValidationFinding[],
): void {
	// Inline links.
	INLINE_LINK_REGEX.lastIndex = 0;
	for (const match of body.matchAll(INLINE_LINK_REGEX)) {
		const offsetInBody = match.index ?? 0;
		if (isInSkipRange(offsetInBody, skipRanges)) continue;
		const linkText = match[1];
		const url = match[2];
		if (linkText === undefined || url === undefined) continue;

		const location = locationFromOffset(file, body, offsetInBody, lineOffset);
		out.push({
			raw: url,
			location,
			linkText,
			strippedText: stripMarkdown(linkText),
			isBare: false,
			referenceLabel: null,
		});
	}

	// Reference-style links.
	REF_STYLE_LINK_REGEX.lastIndex = 0;
	for (const match of body.matchAll(REF_STYLE_LINK_REGEX)) {
		const offsetInBody = match.index ?? 0;
		if (isInSkipRange(offsetInBody, skipRanges)) continue;
		const linkText = match[1];
		let labelRaw = match[2];
		if (linkText === undefined || labelRaw === undefined) continue;
		// "Collapsed" reference: `[text][]` -> use linkText as label.
		if (labelRaw.length === 0) labelRaw = linkText;

		const location = locationFromOffset(file, body, offsetInBody, lineOffset);
		const def = labelDefs.get(labelRaw.toLowerCase());

		if (def === undefined) {
			findings.push({
				severity: 'error',
				ruleId: -1,
				message: `undefined reference label \`${labelRaw}\``,
				location,
				identifier: null,
			});
			continue;
		}
		if (!def.url.startsWith(SCHEME_PREFIX)) {
			// Reference-style links to non-airboss-ref URLs are ignored by this
			// validator -- they're outside the system.
			continue;
		}
		out.push({
			raw: def.url,
			location,
			linkText,
			strippedText: stripMarkdown(linkText),
			isBare: false,
			referenceLabel: labelRaw,
		});
	}
}

// ---------------------------------------------------------------------------
// Bare URL detection (NOTICE row 8)
// ---------------------------------------------------------------------------

const BARE_URL_REGEX = /airboss-ref:[^\s)\]]+/g;

function collectBareUrls(
	body: string,
	file: string,
	lineOffset: number,
	skipRanges: readonly SkipRange[],
	out: IdentifierOccurrence[],
): void {
	BARE_URL_REGEX.lastIndex = 0;
	for (const match of body.matchAll(BARE_URL_REGEX)) {
		const offsetInBody = match.index ?? 0;
		if (isInSkipRange(offsetInBody, skipRanges)) continue;
		// If the preceding char is `(` then this is the URL of an inline link;
		// already captured above.
		const prev = body[offsetInBody - 1];
		if (prev === '(') continue;
		const url = match[0];
		const location = locationFromOffset(file, body, offsetInBody, lineOffset);
		out.push({
			raw: url,
			location,
			linkText: null,
			strippedText: null,
			isBare: true,
			referenceLabel: null,
		});
	}
}

// ---------------------------------------------------------------------------
// Cross-check: orphan acks + multiple acks same target
// ---------------------------------------------------------------------------

function emitOrphanAckWarnings(
	file: string,
	acks: readonly LessonAcknowledgment[],
	occurrences: readonly IdentifierOccurrence[],
	findings: ValidationFinding[],
): void {
	const referencedTargets = new Set<string>();
	for (const occ of occurrences) referencedTargets.add(occ.raw);

	for (const ack of acks) {
		if (referencedTargets.has(ack.target)) continue;
		findings.push({
			severity: 'warning',
			ruleId: -1,
			message: `acknowledgments entry has no body reference: ${ack.target}`,
			location: { file, line: 1, column: 1 },
			identifier: null,
		});
	}
}

function emitMultipleAckSameTargetErrors(
	acks: readonly LessonAcknowledgment[],
	occurrences: readonly IdentifierOccurrence[],
	findings: ValidationFinding[],
): void {
	// Group acks by target.
	const byTarget = new Map<string, LessonAcknowledgment[]>();
	for (const ack of acks) {
		const list = byTarget.get(ack.target) ?? [];
		list.push(ack);
		byTarget.set(ack.target, list);
	}

	for (const [target, group] of byTarget.entries()) {
		if (group.length < 2) continue;
		// Multiple acks for same target -- every binding link must have an explicit reference label.
		for (const occ of occurrences) {
			if (occ.raw !== target) continue;
			if (occ.referenceLabel === null) {
				findings.push({
					severity: 'error',
					ruleId: -1,
					message: `§3.4: lesson has multiple acks for ${target}; this binding link must have an explicit reference label`,
					location: occ.location,
					identifier: occ.raw,
				});
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Markdown markup stripping for row-7 emptiness check
// ---------------------------------------------------------------------------

/**
 * Strip Markdown emphasis markers (`*`, `_`, `` ` ``), inline images, and
 * surrounding whitespace from `text` for row-7's "is this empty after strip"
 * check. Not a full Markdown parser; the goal is to detect "the link text is
 * just emphasis markers and whitespace."
 */
export function stripMarkdown(text: string): string {
	// Remove inline-image syntax `![alt](url)` -> `alt`
	let out = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
	// Strip emphasis runs of `*` and `_` (one or more).
	out = out.replace(/[*_]+/g, '');
	// Strip backticks.
	out = out.replace(/`+/g, '');
	// Trim outer whitespace.
	return out.trim();
}

// ---------------------------------------------------------------------------
// Source-location helpers
// ---------------------------------------------------------------------------

/**
 * Translate a byte offset within `body` into a `SourceLocation` for the file.
 * `lineOffset` is the number of lines that precede `body` in the source file
 * (0 when there's no frontmatter; positive when frontmatter consumed leading
 * lines). Lines and columns are 1-based.
 */
function locationFromOffset(file: string, body: string, offsetInBody: number, lineOffset: number): SourceLocation {
	let line = 1;
	let lastNewline = -1;
	for (let i = 0; i < offsetInBody; i += 1) {
		if (body.charCodeAt(i) === 10) {
			line += 1;
			lastNewline = i;
		}
	}
	const column = offsetInBody - lastNewline;
	return { file, line: line + lineOffset, column };
}

// ---------------------------------------------------------------------------
// Fence + inline-code helpers (mirrors libs/aviation/src/wikilink/parser.ts)
// ---------------------------------------------------------------------------

function tryEnterFence(source: string, i: number): number | null {
	let lineStart = i;
	while (lineStart > 0 && source[lineStart - 1] !== '\n') {
		const prev = source[lineStart - 1];
		if (prev !== ' ' && prev !== '\t') return null;
		lineStart -= 1;
	}
	const indent = i - lineStart;
	if (indent > 3) return null;

	const marker = source[i];
	if (marker !== '`' && marker !== '~') return null;

	let runLen = 0;
	while (source[i + runLen] === marker) runLen += 1;
	if (runLen < 3) return null;

	let afterOpen = i + runLen;
	while (afterOpen < source.length && source[afterOpen] !== '\n') afterOpen += 1;
	if (source[afterOpen] === '\n') afterOpen += 1;

	let cursor = afterOpen;
	while (cursor < source.length) {
		const nextNewline = source.indexOf('\n', cursor);
		const lineEnd = nextNewline === -1 ? source.length : nextNewline;
		const line = source.slice(cursor, lineEnd);

		let j = 0;
		while (j < 3 && line[j] === ' ') j += 1;
		let closeLen = 0;
		while (line[j + closeLen] === marker) closeLen += 1;
		if (closeLen >= runLen) {
			const tail = line.slice(j + closeLen);
			if (/^\s*$/.test(tail)) {
				return nextNewline === -1 ? source.length : nextNewline + 1;
			}
		}
		cursor = nextNewline === -1 ? source.length : nextNewline + 1;
	}

	return source.length;
}

function skipInlineCode(source: string, i: number): number | null {
	let runLen = 0;
	while (source[i + runLen] === '`') runLen += 1;
	if (runLen === 0) return null;

	const contentStart = i + runLen;
	let cursor = contentStart;
	while (cursor < source.length) {
		if (source.charCodeAt(cursor) === 10) {
			// CommonMark inline code spans must not contain newlines (close on EOL).
			return null;
		}
		if (source[cursor] === '`') {
			let endRun = 0;
			while (source[cursor + endRun] === '`') endRun += 1;
			if (endRun === runLen) return cursor + endRun;
			cursor += endRun;
			continue;
		}
		cursor += 1;
	}
	return null;
}
