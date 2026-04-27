/**
 * Multi-reference adjacency detection per ADR 019 §1.4.
 *
 * Walks the body's inline-link matches in source order; groups runs whose
 * interstitial text matches the §1.4 separator set (whitespace, `,`, `;`,
 * `and`, `or`, parens, emphasis markers); emits an `AdjacencyGroup` record
 * per run.
 *
 * Range-form vs comma-list-form decision lives here too: when every member
 * shares the same locator-prefix and the only varying segment is a
 * contiguous numeric run, the group is `'range'`; otherwise `'list'`.
 */

import { parseIdentifier } from '../parser.ts';
import type { AdjacencyGroup, ParsedIdentifier } from '../types.ts';

/** The same regex `lesson-parser.ts` uses for inline links. */
const INLINE_LINK_REGEX = /\[([^\]\n]*)\]\((airboss-ref:[^)\s]+)\)/g;

/** Characters allowed between two adjacent identifier links per §1.4. */
const SEPARATOR_PATTERN = /^[\s,;()*_]*(?:and|or)?[\s,;()*_]*$/i;

interface LinkMatch {
	readonly raw: string;
	readonly start: number;
	readonly end: number;
	readonly parsed: ParsedIdentifier;
}

/**
 * Walk `body`, find every `airboss-ref:` inline link, return them with byte
 * ranges. Skip-range awareness (fenced code, inline code) is NOT handled
 * here -- callers should be aware that adjacency grouping is purely a
 * presentation concern; identifiers inside skip ranges shouldn't appear in
 * the link match at all because `extractIdentifiers` filtered them. In
 * practice the regex match itself doesn't fire inside fenced code blocks
 * because the body passed to substituteTokens is the same body that
 * extractIdentifiers walked.
 *
 * For correctness, this function only consumes inline `[text](airboss-ref:...)`
 * matches; bare URLs and reference-style links are treated as 1-element groups
 * (they don't participate in adjacency since their syntactic context isn't a
 * comma-list-of-links).
 */
function collectLinkMatches(body: string): readonly LinkMatch[] {
	const matches: LinkMatch[] = [];
	INLINE_LINK_REGEX.lastIndex = 0;
	for (const m of body.matchAll(INLINE_LINK_REGEX)) {
		const raw = m[2];
		const start = m.index ?? 0;
		const end = start + m[0].length;
		if (raw === undefined) continue;
		const parsed = parseIdentifier(raw);
		if ('kind' in parsed && parsed.kind !== 'not-airboss-ref' && parsed.kind !== 'authority-based') {
			// it's a ParseError variant other than... we want to filter to the success path
		}
		// `parseIdentifier` returns either ParsedIdentifier or ParseError. ParsedIdentifier
		// has `corpus` etc.; ParseError has `kind`.
		if ('corpus' in parsed) {
			matches.push({ raw, start, end, parsed });
		}
	}
	return matches;
}

/** True when `body[a..b)` is empty-ish-or-separator-only per §1.4. */
function isAdjacentSeparator(body: string, a: number, b: number): boolean {
	if (a >= b) return true;
	const slice = body.slice(a, b);
	return SEPARATOR_PATTERN.test(slice);
}

/**
 * Compute adjacency groups from a body. Each group has `members` in source
 * order; single-member groups are emitted for identifiers with no neighbors.
 */
export function computeAdjacencyGroups(body: string): readonly AdjacencyGroup[] {
	const matches = collectLinkMatches(body);
	if (matches.length === 0) return [];

	const groups: AdjacencyGroup[] = [];
	let runStart = 0;
	for (let i = 1; i <= matches.length; i += 1) {
		const prev = matches[i - 1];
		const cur = matches[i];
		const closeRun = (() => {
			if (cur === undefined || prev === undefined) return true;
			if (cur.parsed.corpus !== prev.parsed.corpus) return true;
			if (cur.parsed.pin !== prev.parsed.pin) return true;
			if (!isAdjacentSeparator(body, prev.end, cur.start)) return true;
			return false;
		})();
		if (closeRun) {
			const runMatches = matches.slice(runStart, i);
			groups.push(buildGroup(runMatches));
			runStart = i;
		}
	}
	return groups;
}

function buildGroup(matches: readonly LinkMatch[]): AdjacencyGroup {
	const members = matches.map((m) => m.raw);
	const first = matches[0];
	if (first === undefined) {
		return { corpus: '', pin: null, members: [], shape: 'list' };
	}
	const shape = computeShape(matches);
	return {
		corpus: first.parsed.corpus,
		pin: first.parsed.pin,
		members,
		shape,
	};
}

/**
 * Determine `'range'` vs `'list'`. A group is range-shaped when:
 *   - All members share the same locator-prefix up to the last segment.
 *   - Every last segment is a pure numeric run with no decimal / paragraph suffix.
 *   - The numeric values are contiguous (N, N+1, N+2, ...).
 *
 * Otherwise the group is list-shaped.
 */
function computeShape(matches: readonly LinkMatch[]): 'range' | 'list' {
	if (matches.length < 2) return 'list';
	const segs = matches.map((m) => m.parsed.locator.split('/'));
	const last = segs[0];
	if (last === undefined) return 'list';
	const prefixLen = last.length - 1;
	if (prefixLen <= 0) return 'list';
	const prefix = last.slice(0, prefixLen).join('/');
	for (const s of segs) {
		if (s.length !== last.length) return 'list';
		if (s.slice(0, prefixLen).join('/') !== prefix) return 'list';
	}
	const lastSegs = segs.map((s) => s[s.length - 1]);
	const numbers: number[] = [];
	for (const lastSeg of lastSegs) {
		if (lastSeg === undefined) return 'list';
		// Reject non-pure-numeric (e.g. '103a', '103.b', '103-1').
		if (!/^\d+$/.test(lastSeg)) return 'list';
		numbers.push(Number.parseInt(lastSeg, 10));
	}
	for (let i = 1; i < numbers.length; i += 1) {
		const prev = numbers[i - 1];
		const cur = numbers[i];
		if (prev === undefined || cur === undefined) return 'list';
		if (cur !== prev + 1) return 'list';
	}
	return 'range';
}

/**
 * Build a quick lookup from raw identifier -> the group it belongs to. Used
 * by `substituteTokens` to attach group context per link match.
 */
export function indexGroupsByMember(groups: readonly AdjacencyGroup[]): ReadonlyMap<string, AdjacencyGroup> {
	const map = new Map<string, AdjacencyGroup>();
	for (const group of groups) {
		for (const member of group.members) {
			map.set(member, group);
		}
	}
	return map;
}

/**
 * Position of `id` within `group.members`. Returns 0 for the first member,
 * 1 for the second, etc. Returns -1 when `id` is not in the group.
 */
export function memberIndex(group: AdjacencyGroup, id: string): number {
	return group.members.indexOf(id);
}
