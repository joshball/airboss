/**
 * Query parser for the help + aviation cross-library search widget.
 *
 * Grammar (documented in spec.md / design.md, mirrored here):
 *
 *   query       := term (WS term)*
 *   term        := facet | quoted-phrase | free-token
 *   facet       := KEY ':' value-list
 *   KEY         := 'tag' | 'source' | 'rules' | 'kind' | 'surface' | 'lib'
 *                    (case-insensitive; unknown keys degrade to free-text)
 *   value-list  := VALUE (',' VALUE)*
 *   VALUE       := non-whitespace non-comma tokens; `\:` escapes a colon;
 *                    `\,` escapes a comma. A quoted VALUE is NOT supported
 *                    (quote the free-text outside the facet instead).
 *   quoted-phrase := '"' chars-without-quote '"'
 *   free-token  := any run of non-whitespace characters that does not
 *                    satisfy `KEY:VALUE`
 *
 * Escape rules (apply only to bare tokens; quoted strings are verbatim):
 *   `\:` -> literal colon (prevents key:value interpretation)
 *   `\,` -> literal comma
 *   `\\` -> literal backslash
 *
 * The parser is intentionally permissive:
 *   - Empty input returns an empty free-text + no filters.
 *   - Unknown facet keys degrade to free-text (the raw `foo:bar` token
 *     joins the free-text bag) rather than erroring, so authors' typos
 *     don't produce empty result sets.
 *   - Multiple filters with the same key OR together (`tag:weather tag:ifr`
 *     becomes `tag` with values `[weather, ifr]`).
 *   - Empty values are dropped (`tag:` with nothing after is free-text).
 *
 * Not supported:
 *   - Parentheses / boolean operators (YAGNI until user asks).
 *   - Negation (same).
 *   - Wildcards.
 */

import type { FilterKey, ParsedFilter, ParsedQuery } from './schema/help-registry';

const KNOWN_KEYS: readonly string[] = ['tag', 'source', 'rules', 'kind', 'surface', 'lib'];

export function parseQuery(raw: string): ParsedQuery {
	const tokens = tokenize(raw);
	const freeTextPieces: string[] = [];
	const filterMap = new Map<FilterKey, string[]>();

	for (const token of tokens) {
		if (token.kind === 'quoted') {
			freeTextPieces.push(token.text);
			continue;
		}
		const facet = tryParseFacet(token.text);
		if (facet) {
			const existing = filterMap.get(facet.key) ?? [];
			for (const value of facet.values) {
				if (!existing.includes(value)) existing.push(value);
			}
			filterMap.set(facet.key, existing);
		} else {
			freeTextPieces.push(unescapeToken(token.text));
		}
	}

	const filters: ParsedFilter[] = [];
	for (const [key, values] of filterMap) {
		filters.push({ key, values });
	}

	return {
		freeText: freeTextPieces.join(' ').trim(),
		filters,
	};
}

// -------- tokenizer --------

interface BareToken {
	kind: 'bare';
	text: string;
}
interface QuotedToken {
	kind: 'quoted';
	text: string;
}
type Token = BareToken | QuotedToken;

function tokenize(raw: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	const n = raw.length;
	while (i < n) {
		const c = raw[i];
		if (c === undefined) break;
		if (/\s/.test(c)) {
			i += 1;
			continue;
		}
		if (c === '"') {
			const start = i + 1;
			let end = start;
			while (end < n && raw[end] !== '"') end += 1;
			const text = raw.slice(start, end);
			tokens.push({ kind: 'quoted', text });
			i = end < n ? end + 1 : end;
			continue;
		}
		// Bare token: consume until next whitespace, respecting `\<c>`.
		let j = i;
		let out = '';
		while (j < n) {
			const ch = raw[j];
			if (ch === undefined) break;
			if (/\s/.test(ch)) break;
			if (ch === '\\' && j + 1 < n) {
				const next = raw[j + 1];
				if (next === ':' || next === ',' || next === '\\') {
					out += `\\${next}`;
					j += 2;
					continue;
				}
			}
			out += ch;
			j += 1;
		}
		tokens.push({ kind: 'bare', text: out });
		i = j;
	}
	return tokens;
}

// -------- facet parsing --------

function tryParseFacet(token: string): { key: FilterKey; values: string[] } | null {
	// Find the first UNESCAPED colon.
	const colonIndex = firstUnescapedColon(token);
	if (colonIndex < 0) return null;
	const keyRaw = token.slice(0, colonIndex).toLowerCase();
	const valueRaw = token.slice(colonIndex + 1);
	if (!KNOWN_KEYS.includes(keyRaw)) return null;
	const key = keyRaw as FilterKey;
	const values = splitValues(valueRaw)
		.map((v) => unescapeToken(v).trim().toLowerCase())
		.filter((v) => v.length > 0);
	if (values.length === 0) return null;
	return { key, values };
}

function firstUnescapedColon(text: string): number {
	for (let i = 0; i < text.length; i += 1) {
		if (text[i] === '\\') {
			i += 1;
			continue;
		}
		if (text[i] === ':') return i;
	}
	return -1;
}

function splitValues(text: string): string[] {
	const out: string[] = [];
	let current = '';
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (ch === undefined) continue;
		if (ch === '\\' && i + 1 < text.length) {
			const next = text[i + 1];
			if (next === ',' || next === ':' || next === '\\') {
				current += `\\${next}`;
				i += 1;
				continue;
			}
		}
		if (ch === ',') {
			out.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	out.push(current);
	return out;
}

function unescapeToken(text: string): string {
	let out = '';
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (ch === undefined) continue;
		if (ch === '\\' && i + 1 < text.length) {
			const next = text[i + 1];
			if (next === ':' || next === ',' || next === '\\') {
				out += next;
				i += 1;
				continue;
			}
		}
		out += ch;
	}
	return out;
}
