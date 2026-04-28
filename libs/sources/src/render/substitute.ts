/**
 * `substituteTokens` -- the third (and primary) function on
 * `@ab/sources/render`.
 *
 * Source of truth: ADR 019 §2.5, §3.1. Walks the body's link matches,
 * substitutes tokens per the mode, splices the result into the output
 * string. Mode-specific link rendering lives in `modes/*.ts`.
 *
 * Group handling (§1.4 multi-reference adjacency):
 *   - When a link is part of an adjacency group of size > 1, only the
 *     FIRST occurrence emits an anchor. Later occurrences (and their
 *     interstitial separators) are swallowed so the source
 *     `[a], [b], and [c]` collapses to a single anchor.
 *   - A 1-element group emits one anchor like a plain link.
 */

import type {
	AdjacencyGroup,
	LinkRenderContext,
	RenderMode,
	ResolvedIdentifier,
	ResolvedIdentifierMap,
} from '../types.ts';
import { computeAdjacencyGroups, indexGroupsByMember, memberIndex } from './adjacency.ts';
import { renderDefaultModeLink } from './modes/default.ts';
import { renderPlainTextLink } from './modes/plain-text.ts';
import { type PrintFootnoteSink, renderPrintLink } from './modes/print.ts';
import { renderTtsLink } from './modes/tts.ts';
import { renderWebLink } from './modes/web.ts';
import { getToken } from './tokens.ts';

const INLINE_LINK_REGEX = /\[([^\]\n]*)\]\((airboss-ref:[^)\s]+)\)/g;

export function substituteTokens(body: string, resolved: ResolvedIdentifierMap, mode: RenderMode = 'web'): string {
	const groups = computeAdjacencyGroups(body);
	const groupIndex = indexGroupsByMember(groups);

	// Print mode collects footnotes; the sink returns the 1-based footnote number.
	const footnotes: string[] = [];
	const footnoteSink: PrintFootnoteSink = (text: string) => {
		footnotes.push(text);
		return footnotes.length;
	};

	const out: string[] = [];
	let lastEnd = 0;
	const matches = collectLinkMatches(body);

	for (let i = 0; i < matches.length; i += 1) {
		const m = matches[i];
		if (m === undefined) continue;

		// Append the slice between the previous match and this one. For grouped
		// links beyond the first member, the previous match was a member of the
		// same group; the interstitial separator is consumed (replaced with empty).
		const prevMatch = matches[i - 1];
		const interstitial = body.slice(lastEnd, m.start);
		const isGroupContinuation = (() => {
			if (prevMatch === undefined) return false;
			const prevGroup = groupIndex.get(prevMatch.url);
			const curGroup = groupIndex.get(m.url);
			return prevGroup !== undefined && prevGroup === curGroup && prevGroup.members.length > 1;
		})();

		if (isGroupContinuation) {
			// Swallow the interstitial separator (comma, " and ", etc.).
		} else {
			out.push(interstitial);
		}

		const r = resolved.get(m.url);
		const group = groupIndex.get(m.url);
		if (r === undefined) {
			// Unknown id (extractIdentifiers should have populated, but defensive).
			out.push(m.fullMatch);
			lastEnd = m.end;
			continue;
		}

		const ctx = buildLinkRenderContext({
			match: m,
			resolved: r,
			resolvedMap: resolved,
			mode,
			group,
			footnoteSink: mode === 'print' ? footnoteSink : undefined,
		});

		// Suppress non-first members of a group of size > 1.
		if (group !== undefined && group.members.length > 1 && ctx.groupIndex > 0) {
			lastEnd = m.end;
			continue;
		}

		out.push(dispatchMode(ctx));
		lastEnd = m.end;
	}

	out.push(body.slice(lastEnd));

	let result = out.join('');

	if (mode === 'print' && footnotes.length > 0) {
		result += renderPrintFootnotesAside(footnotes);
	}

	return result;
}

// ---------------------------------------------------------------------------
// Mode dispatch
// ---------------------------------------------------------------------------

function dispatchMode(ctx: LinkRenderContext): string {
	switch (ctx.mode) {
		case 'web':
			return renderWebLink(ctx);
		case 'plain-text':
			return renderPlainTextLink(ctx);
		case 'print':
			return renderPrintLink(ctx);
		case 'tts':
			return renderTtsLink(ctx);
		default:
			return renderDefaultModeLink(ctx);
	}
}

function renderPrintFootnotesAside(footnotes: readonly string[]): string {
	const items = footnotes.map((f, i) => `<li id="ab-fn-${i + 1}">${f}</li>`).join('');
	return `\n<aside class="ab-ref-footnotes"><ol>${items}</ol></aside>`;
}

// ---------------------------------------------------------------------------
// Link-match collection (mirrors lesson-parser INLINE_LINK_REGEX)
// ---------------------------------------------------------------------------

interface LinkMatch {
	readonly fullMatch: string;
	readonly linkText: string;
	readonly url: string;
	readonly start: number;
	readonly end: number;
}

function collectLinkMatches(body: string): readonly LinkMatch[] {
	const matches: LinkMatch[] = [];
	INLINE_LINK_REGEX.lastIndex = 0;
	for (const m of body.matchAll(INLINE_LINK_REGEX)) {
		const linkText = m[1];
		const url = m[2];
		const start = m.index ?? 0;
		if (linkText === undefined || url === undefined) continue;
		matches.push({
			fullMatch: m[0],
			linkText,
			url,
			start,
			end: start + m[0].length,
		});
	}
	return matches;
}

// ---------------------------------------------------------------------------
// LinkRenderContext construction (token substitution per mode)
// ---------------------------------------------------------------------------

interface BuildLinkContextInput {
	readonly match: LinkMatch;
	readonly resolved: ResolvedIdentifier;
	readonly resolvedMap: ResolvedIdentifierMap;
	readonly mode: RenderMode;
	readonly group?: AdjacencyGroup;
	readonly footnoteSink?: PrintFootnoteSink;
}

function buildLinkRenderContext(input: BuildLinkContextInput): LinkRenderContext {
	const { match, resolved, resolvedMap, mode, group, footnoteSink } = input;
	const idx = group !== undefined ? memberIndex(group, match.url) : 0;
	const substituted = substituteLinkText(match.linkText, resolved, resolvedMap, group, mode);
	const groupListText =
		group !== undefined && group.members.length > 1 ? buildGroupListText(group, resolvedMap) : undefined;

	return {
		raw: match.url,
		linkText: match.linkText,
		substituted,
		resolved,
		mode,
		group,
		groupIndex: idx,
		groupListText,
		footnoteSink,
	};
}

/**
 * Replace every `@<token>` in `linkText` via the token registry. Tokens that
 * aren't registered are left as the literal `@name` so the author sees the
 * mistake in the rendered output.
 */
function substituteLinkText(
	linkText: string,
	resolved: ResolvedIdentifier,
	resolvedMap: ResolvedIdentifierMap,
	group: AdjacencyGroup | undefined,
	mode: RenderMode,
): string {
	const TOKEN_REGEX = /@[a-zA-Z][a-zA-Z0-9-]*/g;
	return linkText.replace(TOKEN_REGEX, (match) => {
		const tok = getToken(match);
		if (tok === null) return match;
		return tok.substitute({
			resolved,
			mode,
			group,
			pin: resolved.parsed.pin,
			resolvedMap,
		});
	});
}

/**
 * The combined link text for a group of size > 1. Built once and attached to
 * `LinkRenderContext.groupListText` so each mode can use it directly.
 */
function buildGroupListText(group: AdjacencyGroup, resolvedMap: ResolvedIdentifierMap): string {
	// Reuse the @list token's machinery for a consistent format. Construct a
	// minimal token-context with the first member as `resolved`.
	const first = group.members[0];
	if (first === undefined) return '';
	const r = resolvedMap.get(first);
	if (r === undefined) return '';
	const tok = getToken('@list');
	if (tok === null) return '';
	return tok.substitute({
		resolved: r,
		mode: 'web',
		group,
		pin: r.parsed.pin,
		resolvedMap,
	});
}
