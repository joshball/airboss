/**
 * Phase 3 -- eCFR XML walker.
 *
 * Source of truth: ADR 019 §1.2 (regulations corpus shape) + the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`. The eCFR Versioner
 * publishes Title-level XML with `<DIV1 TYPE="TITLE">` containing chapters,
 * subchapters, parts, subparts, and sections. We walk by `TYPE` attribute,
 * not by depth, so the walker tolerates schema variation between Titles.
 *
 * Two valid root shapes:
 *
 *   - `<DIV1 TYPE="TITLE">` -- full-title download (Title 14 path).
 *   - `<DIV5 TYPE="PART">` -- single-part download (Title 49 path; the eCFR
 *     Versioner returns part-rooted XML when `?part=` is supplied, even when
 *     multiple `?part=` filters are given -- only the first is honored, so
 *     each filtered part must be fetched separately and aggregated by the
 *     caller). When the root is a part, we treat the part as if it were a
 *     single child of an implicit title.
 *
 * Walking is read-only and pure. No I/O; no registry mutation.
 */

import { XMLParser } from 'fast-xml-parser';

const TYPE_PART = 'PART';
const TYPE_SUBPART = 'SUBPART';
const TYPE_SECTION = 'SECTION';
const TYPE_CHAPTER = 'CHAPTER';
// The eCFR XML uses the abbreviated form `SUBCHAP` for subchapter DIV4 nodes.
const TYPE_SUBCHAP = 'SUBCHAP';

const SECTION_HEAD_PATTERN = /^§\s*\d+(?:\.\d+[a-z]?)?\s+(.*?)\.?$/u;
const ISO_DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2})\b/u;
const HUMAN_DATE_PATTERN =
	/\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*\.?\s+\d{1,2},\s*\d{4})\b/u;

/** Raw section data emitted by the walker. */
export interface RawSection {
	readonly kind: 'section';
	readonly title: '14' | '49';
	readonly part: string;
	readonly subpart: string | null;
	readonly section: string;
	/** The section's display title (e.g. 'Preflight action'). */
	readonly headTitle: string;
	/** Concatenated paragraph text, blank-line-separated, in source order. */
	readonly bodyText: string;
	/** Last-amended date extracted from `<CITA>` text; null when absent. */
	readonly amendedDate: string | null;
	/** True when the section is `[Reserved]`. */
	readonly reserved: boolean;
}

/** Raw subpart data emitted by the walker. */
export interface RawSubpart {
	readonly kind: 'subpart';
	readonly title: '14' | '49';
	readonly part: string;
	readonly subpart: string;
	readonly headTitle: string;
}

/** Raw Part data emitted by the walker. */
export interface RawPart {
	readonly kind: 'part';
	readonly title: '14' | '49';
	readonly part: string;
	readonly headTitle: string;
}

/**
 * Title-level navigation skeleton emitted alongside the content tree.
 *
 * eCFR XML (`DIV1 TYPE="TITLE"` -> `DIV3 TYPE="CHAPTER"` ->
 * `DIV4 TYPE="SUBCHAP"` -> `DIV5 TYPE="PART"`) is the only place chapter +
 * subchapter context is preserved. The content walk drops it (the Part-level
 * grouping is what the BC keys on); this skeleton captures it as a sidecar
 * so the nav-tree YAML writer can emit it without re-parsing the XML.
 *
 * Empty when the walk root is a `DIV5 TYPE="PART"` (single-part download,
 * Title 49 path) -- those XMLs have no chapter / subchapter context.
 */
export interface RawNavSubchapter {
	readonly id: string;
	readonly name: string;
	readonly parts: readonly string[];
}
export interface RawNavChapter {
	readonly id: string;
	readonly name: string;
	readonly subchapters: readonly RawNavSubchapter[];
	/** Parts that sit directly under the chapter (no subchapter wrapper). */
	readonly directParts: readonly string[];
}
export interface RawNavTree {
	readonly title: '14' | '49';
	readonly titleName: string;
	readonly chapters: readonly RawNavChapter[];
}

export interface RawCfrTree {
	readonly title: '14' | '49';
	readonly parts: readonly RawPart[];
	readonly subparts: readonly RawSubpart[];
	readonly sections: readonly RawSection[];
	/**
	 * Optional Title-level structure (chapters / subchapters / part membership)
	 * extracted from the same walk. Absent when the walk root is a
	 * `DIV5 TYPE="PART"` (no chapter context to capture).
	 */
	readonly navTree: RawNavTree | null;
}

export interface WalkOptions {
	readonly title: '14' | '49';
	/**
	 * When set, skip parts not in this list. Used to filter Title 49 down to
	 * 830 + 1552 (the only Parts we ingest from Title 49).
	 */
	readonly partFilter?: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// preserveOrder shape helpers
//
// fast-xml-parser with preserveOrder=true returns nodes shaped like
// `{ TAGNAME: [child, child, ...], ":@"?: { @_ATTR: value, ... } }`. Every node
// has exactly one tag key (plus the optional `:@` attribute bag). Children are
// the same shape recursively. A `#text` "tag" carries text content.
// ---------------------------------------------------------------------------

interface Node {
	readonly [key: string]: unknown;
}

function tagOf(node: Node): string | undefined {
	for (const key of Object.keys(node)) {
		if (key === ':@') continue;
		return key;
	}
	return undefined;
}

function childrenOf(node: Node): readonly Node[] {
	const tag = tagOf(node);
	if (tag === undefined) return [];
	const value = (node as Record<string, unknown>)[tag];
	if (Array.isArray(value)) return value as Node[];
	return [];
}

function attrsOf(node: Node): Record<string, string> {
	const attrs = (node as Record<string, unknown>)[':@'];
	if (attrs !== undefined && attrs !== null && typeof attrs === 'object') {
		return attrs as Record<string, string>;
	}
	return {};
}

function getAttr(node: Node, attrName: string): string | undefined {
	return attrsOf(node)[`@_${attrName}`];
}

function getType(node: Node): string | undefined {
	return getAttr(node, 'TYPE');
}

function getN(node: Node): string | undefined {
	return getAttr(node, 'N');
}

/** Concatenate every #text descendant of `node`'s children, depth-first. */
function gatherText(node: Node): string {
	const tag = tagOf(node);
	if (tag === undefined) return '';
	if (tag === '#text') {
		const t = (node as Record<string, unknown>)['#text'];
		return typeof t === 'string' ? t : '';
	}
	const out: string[] = [];
	for (const child of childrenOf(node)) {
		out.push(gatherText(child));
	}
	return out.join('');
}

/** First child whose tag matches `tag`. */
function firstChild(node: Node, tag: string): Node | null {
	for (const child of childrenOf(node)) {
		if (tagOf(child) === tag) return child;
	}
	return null;
}

/** All immediate children whose tag matches `tag`. */
function childrenWithTag(node: Node, tag: string): readonly Node[] {
	const out: Node[] = [];
	for (const child of childrenOf(node)) {
		if (tagOf(child) === tag) out.push(child);
	}
	return out;
}

/**
 * Find every descendant DIVx node whose `TYPE` attribute equals `type`.
 * Stops descent INTO a matched node (so collecting PART -> SECTION works:
 * we collect the PART, then re-invoke for SECTION inside that PART).
 */
function collectDivByType(root: Node, type: string): readonly Node[] {
	const out: Node[] = [];
	const stack: Node[] = [...childrenOf(root)];
	while (stack.length > 0) {
		const cur = stack.pop();
		if (cur === undefined) continue;
		const tag = tagOf(cur);
		if (tag === undefined) continue;
		if (/^DIV\d+$/.test(tag)) {
			if (getType(cur) === type) {
				out.push(cur);
				continue; // matched; don't descend further into this branch
			}
			// not the target type; descend
			for (const child of childrenOf(cur)) {
				stack.push(child);
			}
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Section / subpart / part extraction
// ---------------------------------------------------------------------------

function extractHeadText(node: Node): string {
	const head = firstChild(node, 'HEAD');
	if (head === null) return '';
	return gatherText(head).trim();
}

function extractParagraphsText(node: Node): string {
	const parts: string[] = [];
	for (const child of childrenWithTag(node, 'P')) {
		const text = gatherText(child).trim();
		if (text.length > 0) parts.push(text);
	}
	return parts.join('\n\n');
}

function extractCitaText(node: Node): string {
	const cita = firstChild(node, 'CITA');
	if (cita === null) return '';
	return gatherText(cita).trim();
}

function extractSectionTitle(headRaw: string): string {
	const trimmed = headRaw.trim();
	const match = trimmed.match(SECTION_HEAD_PATTERN);
	if (match !== null) {
		return (match[1] ?? '').trim();
	}
	return trimmed
		.replace(/^§?\s*\d+(?:\.\d+[a-z]?)?\s*/u, '')
		.replace(/\.$/, '')
		.trim();
}

function extractAmendedDate(text: string): string | null {
	if (text.length === 0) return null;

	// Find the LAST date in the CITA text (most recent amendment).
	let lastIso: string | null = null;
	let lastHuman: string | null = null;

	for (const m of text.matchAll(new RegExp(ISO_DATE_PATTERN, 'gu'))) {
		const v = m[1];
		if (v !== undefined) lastIso = v;
	}
	for (const m of text.matchAll(new RegExp(HUMAN_DATE_PATTERN, 'gu'))) {
		const v = m[1];
		if (v !== undefined) lastHuman = v;
	}

	// Prefer human-format date when both present (CITA blocks read "as amended ...").
	if (lastHuman !== null) {
		const parsed = new Date(lastHuman);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed.toISOString().slice(0, 10);
		}
	}
	if (lastIso !== null) return lastIso;
	return null;
}

function cleanPartHead(raw: string): string {
	const stripped = raw.replace(/^PART\s+\d+\s*[-—–]+\s*/iu, '').trim();
	return titleCase(stripped);
}

function cleanSubpartHead(raw: string): string {
	return raw.replace(/^Subpart\s+\w+\s*[-—–]+\s*/iu, '').trim();
}

function titleCase(input: string): string {
	if (input.length === 0) return input;
	if (input !== input.toUpperCase()) return input;
	const SMALL_WORDS = new Set(['and', 'of', 'the', 'a', 'an', 'or', 'in', 'for', 'to']);
	return input
		.toLowerCase()
		.split(/\s+/u)
		.map((word, idx) => {
			if (idx > 0 && SMALL_WORDS.has(word)) return word;
			if (word.length === 0) return word;
			return (word[0]?.toUpperCase() ?? '') + word.slice(1);
		})
		.join(' ');
}

function sectionFromNode(node: Node, title: '14' | '49', part: string, subpart: string | null): RawSection | null {
	const sectionN = getN(node);
	if (sectionN === undefined) return null;

	// `N` attribute is the dotted form (e.g. "91.103"). Extract the section
	// portion after the part dot; fall back to the whole `N` if no dot.
	const dotIndex = sectionN.indexOf('.');
	const section = dotIndex >= 0 ? sectionN.slice(dotIndex + 1) : sectionN;

	const headRaw = extractHeadText(node);
	const bodyText = extractParagraphsText(node);
	const citaText = extractCitaText(node);

	const reserved = /\[Reserved\]/i.test(headRaw) || /\[Reserved\]/i.test(bodyText);

	return {
		kind: 'section',
		title,
		part,
		subpart,
		section,
		headTitle: reserved ? '[Reserved]' : extractSectionTitle(headRaw),
		bodyText,
		amendedDate: extractAmendedDate(citaText),
		reserved,
	};
}

/**
 * Walk parsed CFR XML and emit raw Part / Subpart / Section records.
 */
export function walkRegsXml(xmlSource: string, opts: WalkOptions): RawCfrTree {
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		parseTagValue: false,
		alwaysCreateTextNode: true,
		preserveOrder: true,
		trimValues: false,
		// Decode numeric character references (e.g. `&#xA7;` -> `§`,
		// `&#x2014;` -> `—`). The eCFR full-title download uses raw chars but
		// the part-filtered download leaves entities encoded; this normalizes
		// both shapes. (Default fast-xml-parser behavior leaves numeric
		// entities raw.)
		htmlEntities: true,
	});

	const root = parser.parse(xmlSource);
	if (!Array.isArray(root)) {
		throw new Error('eCFR XML parse produced non-array root');
	}

	// Find either a `<DIV1 TYPE="TITLE">` wrapper (full-title download) or a
	// `<DIV5 TYPE="PART">` wrapper (single-part download). The root array
	// contains an XML declaration node + an outer wrapper (often `<ECFR>` or
	// directly the `<DIV1>`/`<DIV5>`).
	const walkRoot = findWalkRoot(root as Node[]);
	if (walkRoot === null) {
		throw new Error('eCFR XML missing <DIV1 TYPE="TITLE"> or <DIV5 TYPE="PART"> root');
	}

	const parts: RawPart[] = [];
	const subparts: RawSubpart[] = [];
	const sections: RawSection[] = [];

	// When the root is a single PART, walk just that part. Otherwise, the root
	// is a TITLE; collect every PART under it.
	const partNodes: readonly Node[] =
		walkRoot.kind === 'part' ? [walkRoot.node] : collectDivByType(walkRoot.node, TYPE_PART);
	for (const partNode of partNodes) {
		const partN = getN(partNode);
		if (partN === undefined) continue;
		if (opts.partFilter !== undefined && !opts.partFilter.has(partN)) continue;

		parts.push({
			kind: 'part',
			title: opts.title,
			part: partN,
			headTitle: cleanPartHead(extractHeadText(partNode)),
		});

		// Subparts under this Part
		const subpartNodes = collectDivByType(partNode, TYPE_SUBPART);
		for (const subpartNode of subpartNodes) {
			const subpartN = getN(subpartNode);
			if (subpartN === undefined) continue;
			subparts.push({
				kind: 'subpart',
				title: opts.title,
				part: partN,
				subpart: subpartN.toLowerCase(),
				headTitle: cleanSubpartHead(extractHeadText(subpartNode)),
			});

			// Sections under this Subpart
			const sectionNodes = collectDivByType(subpartNode, TYPE_SECTION);
			for (const sectionNode of sectionNodes) {
				const sec = sectionFromNode(sectionNode, opts.title, partN, subpartN.toLowerCase());
				if (sec !== null) sections.push(sec);
			}
		}

		// Some Parts have sections directly under the Part (no subpart). Catch those
		// by walking ONLY immediate Part-level descendants that aren't inside a SUBPART.
		const directSections = collectDirectSections(partNode);
		for (const sectionNode of directSections) {
			const sec = sectionFromNode(sectionNode, opts.title, partN, null);
			if (sec !== null) sections.push(sec);
		}
	}

	const navTree = walkRoot.kind === 'title' ? buildNavTree(walkRoot.node, opts) : null;

	return {
		title: opts.title,
		parts,
		subparts,
		sections,
		navTree,
	};
}

/**
 * Walk the `DIV1 TYPE="TITLE"` root and capture its chapter / subchapter /
 * part skeleton. Order is preserved (eCFR XML emits chapters in roman-numeral
 * order, subchapters alphabetically within a chapter, parts in numeric order
 * within a subchapter); we don't re-sort.
 *
 * `partFilter`, when set, restricts which parts appear in the skeleton --
 * subchapters whose part lists collapse to empty are dropped.
 */
function buildNavTree(titleNode: Node, opts: WalkOptions): RawNavTree {
	const titleName = cleanTitleHead(extractHeadText(titleNode));
	const chapters: RawNavChapter[] = [];
	for (const chapterNode of childrenWithType(titleNode, TYPE_CHAPTER)) {
		const chapterId = getN(chapterNode);
		if (chapterId === undefined) continue;
		const chapterName = cleanChapterHead(extractHeadText(chapterNode));
		const subchapters: RawNavSubchapter[] = [];
		const directParts: string[] = [];
		for (const child of childrenOf(chapterNode)) {
			const childTag = tagOf(child);
			if (childTag === undefined) continue;
			if (!/^DIV\d+$/.test(childTag)) continue;
			const childType = getType(child);
			if (childType === TYPE_SUBCHAP) {
				const subId = getN(child);
				if (subId === undefined) continue;
				const subParts = collectImmediatePartNumbers(child, opts);
				if (subParts.length === 0) continue;
				subchapters.push({
					id: subId,
					name: cleanSubchapterHead(extractHeadText(child)),
					parts: subParts,
				});
			} else if (childType === TYPE_PART) {
				const partN = getN(child);
				if (partN === undefined) continue;
				if (opts.partFilter !== undefined && !opts.partFilter.has(partN)) continue;
				directParts.push(partN);
			}
		}
		if (subchapters.length === 0 && directParts.length === 0) continue;
		chapters.push({ id: chapterId, name: chapterName, subchapters, directParts });
	}
	return { title: opts.title, titleName, chapters };
}

function childrenWithType(node: Node, type: string): readonly Node[] {
	const out: Node[] = [];
	for (const child of childrenOf(node)) {
		const tag = tagOf(child);
		if (tag === undefined) continue;
		if (!/^DIV\d+$/.test(tag)) continue;
		if (getType(child) === type) out.push(child);
	}
	return out;
}

function collectImmediatePartNumbers(parent: Node, opts: WalkOptions): readonly string[] {
	const out: string[] = [];
	for (const child of childrenOf(parent)) {
		const tag = tagOf(child);
		if (tag === undefined) continue;
		if (!/^DIV\d+$/.test(tag)) continue;
		if (getType(child) !== TYPE_PART) continue;
		const partN = getN(child);
		if (partN === undefined) continue;
		if (opts.partFilter !== undefined && !opts.partFilter.has(partN)) continue;
		out.push(partN);
	}
	return out;
}

function cleanTitleHead(raw: string): string {
	return raw.replace(/^Title\s+\d+\s*[-—–]+\s*/iu, '').trim();
}

function cleanChapterHead(raw: string): string {
	const stripped = raw.replace(/^\s*CHAPTER\s+[IVXLCDM]+\s*[-—–]+\s*/iu, '').trim();
	return titleCase(stripped);
}

function cleanSubchapterHead(raw: string): string {
	const stripped = raw
		.replace(/^\s*SUBCHAPTER\s+[A-Z]+\s*[-—–]+\s*/iu, '')
		.replace(/\s+/gu, ' ')
		.trim();
	return titleCase(stripped);
}

/**
 * Collect SECTION-typed DIVs that are NOT inside a SUBPART. Used for Parts
 * that have undivided sections at the top level (e.g. some smaller Parts
 * in 49 CFR like Part 830).
 */
function collectDirectSections(partNode: Node): readonly Node[] {
	const out: Node[] = [];
	const stack: Node[] = [...childrenOf(partNode)];
	while (stack.length > 0) {
		const cur = stack.pop();
		if (cur === undefined) continue;
		const tag = tagOf(cur);
		if (tag === undefined) continue;
		if (/^DIV\d+$/.test(tag)) {
			const t = getType(cur);
			if (t === TYPE_SUBPART) continue; // Skip subpart subtrees -- handled by collectDivByType(partNode, SUBPART)
			if (t === TYPE_SECTION) {
				out.push(cur);
				continue;
			}
			for (const child of childrenOf(cur)) {
				stack.push(child);
			}
		}
	}
	return out;
}

interface WalkRoot {
	readonly kind: 'title' | 'part';
	readonly node: Node;
}

/**
 * Locate the first valid walk root: a `<DIV1 TYPE="TITLE">` (full-title
 * download) OR a `<DIV5 TYPE="PART">` (filtered single-part download).
 *
 * Title roots are preferred when both exist (a TITLE shape always has PART
 * descendants; if the parser yields TITLE first we want to walk the whole
 * tree, not stop at the first PART). The walk is breadth-first ordered via a
 * queue so a DIV1 sibling is checked before its DIV5 descendants.
 */
function findWalkRoot(nodes: readonly Node[]): WalkRoot | null {
	const queue: Node[] = [...nodes];
	while (queue.length > 0) {
		const cur = queue.shift();
		if (cur === undefined) continue;
		const tag = tagOf(cur);
		if (tag === undefined) continue;
		if (tag === 'DIV1' && getType(cur) === 'TITLE') {
			return { kind: 'title', node: cur };
		}
		if (tag === 'DIV5' && getType(cur) === TYPE_PART) {
			return { kind: 'part', node: cur };
		}
		for (const child of childrenOf(cur)) {
			queue.push(child);
		}
	}
	return null;
}

// Re-export for tests.
export const __xml_walker_internal__ = {
	extractAmendedDate,
	extractSectionTitle,
	titleCase,
	cleanTitleHead,
	cleanChapterHead,
	cleanSubchapterHead,
};
