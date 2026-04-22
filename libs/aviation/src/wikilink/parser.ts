/**
 * `[[DISPLAY::id]]` wiki-link lexer + AST.
 *
 * Three valid modes (architecture doc, wiki-link syntax table):
 *   [[VFR minimums::cfr-14-91-155]]   both known
 *   [[VFR minimums::]]                display known, id TBD
 *   [[::cfr-14-91-155]]               id known, render displayName from registry
 *
 * Invalid (parser reports as error):
 *   [[::]]          empty both sides of ::
 *   [[a[[b::c]]d::e]]  nested brackets
 *   [[x::y         unterminated
 *
 * Non-wiki-link brackets (no `::` inside) are left as plain text -- normal
 * markdown `[[foo]]` is intentionally tolerated so existing author habits
 * don't collide with the syntax.
 *
 * Skips fenced code blocks (``` and ~~~, opening fence language tag OK) and
 * inline code spans (single-backtick and multi-backtick per CommonMark's
 * matching rule).
 *
 * Output is a flat list of `WikilinkAstNode`s. Plain text segments between
 * wiki-links are emitted as `{ kind: 'text' }` nodes. Errors are captured on
 * the returned `errors` array rather than thrown; consumers (the validator)
 * decide whether to fail the build.
 */

/** A parsed fragment of input prose. */
export type WikilinkAstNode =
	| { kind: 'text'; text: string; sourceSpan: readonly [number, number] }
	| {
			kind: 'wikilink';
			/** Display portion. `null` when the input used `[[::id]]` form. */
			display: string | null;
			/** Id portion. `null` when the input used `[[text::]]` form. */
			id: string | null;
			/** Half-open [start, end) byte offsets into the original input. */
			sourceSpan: readonly [number, number];
			/** Exact raw source (for error messages + renderer round-trip). */
			raw: string;
	  };

export interface WikilinkParseError {
	message: string;
	sourceSpan: readonly [number, number];
}

export interface WikilinkParseResult {
	nodes: readonly WikilinkAstNode[];
	errors: readonly WikilinkParseError[];
}

/**
 * Parse `source` into a list of wiki-link + text nodes. Never throws. All
 * errors land on the `errors` array; offending spans are still emitted as
 * `text` nodes so renderers can survive and fall back to plain text.
 */
export function parseWikilinks(source: string): WikilinkParseResult {
	const nodes: WikilinkAstNode[] = [];
	const errors: WikilinkParseError[] = [];

	let i = 0;
	const len = source.length;
	let textStart = 0;

	function flushText(end: number): void {
		if (end > textStart) {
			nodes.push({
				kind: 'text',
				text: source.slice(textStart, end),
				sourceSpan: [textStart, end] as const,
			});
		}
	}

	while (i < len) {
		const ch = source[i];

		// Fenced code block (``` or ~~~ at line start, possibly indented).
		if (ch === '`' || ch === '~') {
			const fence = tryEnterFence(source, i);
			if (fence !== null) {
				// Fall through to skip the whole fence.
				i = fence;
				continue;
			}
		}

		// Inline code span (backtick-delimited, CommonMark-ish). Recognized
		// mid-text only; the fence-at-line-start check above consumes the
		// triple-backtick case first.
		if (ch === '`') {
			const spanEnd = skipInlineCode(source, i);
			if (spanEnd !== null) {
				i = spanEnd;
				continue;
			}
		}

		// Fenced tilde block handled above via tryEnterFence.

		// Wiki-link start -- must be exactly `[[` AND not immediately preceded
		// by a wiki-link-start (the nested-bracket case).
		if (ch === '[' && source[i + 1] === '[') {
			const linkStart = i;
			const inner = readWikilinkInner(source, i + 2);

			if (inner.kind === 'nested') {
				flushText(linkStart);
				errors.push({
					message: 'Nested wiki-link brackets are not allowed.',
					sourceSpan: [linkStart, inner.endIndex] as const,
				});
				// Emit the raw span as text so the renderer still sees something.
				nodes.push({
					kind: 'text',
					text: source.slice(linkStart, inner.endIndex),
					sourceSpan: [linkStart, inner.endIndex] as const,
				});
				i = inner.endIndex;
				textStart = i;
				continue;
			}

			if (inner.kind === 'unterminated') {
				// Not a wiki-link -- leave brackets as plain text. No error: the
				// author may just have typed `[[` casually. A true wiki-link
				// typo (`[[x::y` with no close) is hard to distinguish from
				// prose containing `[[` without being overly noisy, so we
				// surface it only when `::` actually appeared.
				if (inner.sawDoubleColon) {
					flushText(linkStart);
					errors.push({
						message: 'Unterminated wiki-link: missing closing `]]`.',
						sourceSpan: [linkStart, len] as const,
					});
					nodes.push({
						kind: 'text',
						text: source.slice(linkStart, len),
						sourceSpan: [linkStart, len] as const,
					});
					i = len;
					textStart = i;
					continue;
				}
				i = linkStart + 1;
				continue;
			}

			if (inner.kind === 'not-wikilink') {
				// `[[...]]` without `::` -- leave as plain text. Advance past
				// the opening bracket only so nested `[[` isn't consumed.
				i = linkStart + 1;
				continue;
			}

			// inner.kind === 'parsed'
			flushText(linkStart);
			const display = inner.displayRaw.trim();
			const id = inner.idRaw.trim();
			if (display === '' && id === '') {
				errors.push({
					message: 'Empty wiki-link `[[::]]` is not allowed; provide either a display text, an id, or both.',
					sourceSpan: [linkStart, inner.endIndex] as const,
				});
				nodes.push({
					kind: 'text',
					text: source.slice(linkStart, inner.endIndex),
					sourceSpan: [linkStart, inner.endIndex] as const,
				});
			} else {
				nodes.push({
					kind: 'wikilink',
					display: display === '' ? null : display,
					id: id === '' ? null : id,
					sourceSpan: [linkStart, inner.endIndex] as const,
					raw: source.slice(linkStart, inner.endIndex),
				});
			}
			i = inner.endIndex;
			textStart = i;
			continue;
		}

		i += 1;
	}

	flushText(len);

	return { nodes, errors };
}

// -------- helpers --------

type WikilinkInnerResult =
	| { kind: 'parsed'; displayRaw: string; idRaw: string; endIndex: number }
	| { kind: 'nested'; endIndex: number }
	| { kind: 'unterminated'; sawDoubleColon: boolean }
	| { kind: 'not-wikilink' };

/**
 * Read from just after `[[` up to the matching `]]`. Returns:
 *   - `parsed` with display + id + end (exclusive of the closing `]]`).
 *   - `nested` when a second `[[` appears before closing.
 *   - `unterminated` when no `]]` before EOF.
 *   - `not-wikilink` when `]]` closes without seeing `::`.
 */
function readWikilinkInner(source: string, startAfterBrackets: number): WikilinkInnerResult {
	let i = startAfterBrackets;
	const len = source.length;
	let sawDoubleColon = false;
	let doubleColonIndex = -1;

	while (i < len) {
		const ch = source[i];

		if (ch === '[' && source[i + 1] === '[') {
			// Nested wiki-link. Advance to matching `]]` at the same depth to
			// cleanly report the outer span.
			let depth = 2;
			let j = i + 2;
			while (j < len && depth > 0) {
				if (source[j] === '[' && source[j + 1] === '[') {
					depth += 1;
					j += 2;
				} else if (source[j] === ']' && source[j + 1] === ']') {
					depth -= 1;
					j += 2;
				} else {
					j += 1;
				}
			}
			return { kind: 'nested', endIndex: j };
		}

		if (ch === ']' && source[i + 1] === ']') {
			if (!sawDoubleColon) {
				return { kind: 'not-wikilink' };
			}
			const displayRaw = source.slice(startAfterBrackets, doubleColonIndex);
			const idRaw = source.slice(doubleColonIndex + 2, i);
			return {
				kind: 'parsed',
				displayRaw,
				idRaw,
				endIndex: i + 2,
			};
		}

		if (ch === ':' && source[i + 1] === ':' && !sawDoubleColon) {
			sawDoubleColon = true;
			doubleColonIndex = i;
			i += 2;
			continue;
		}

		i += 1;
	}

	return { kind: 'unterminated', sawDoubleColon };
}

/**
 * If `source[i]` opens a fenced code block, return the index past the
 * closing fence (or EOF if unclosed). Otherwise returns `null`.
 *
 * A fence is `\`\`\`` or `~~~` at the start of a line (possibly after up to
 * three spaces). The closing fence must be the same marker and at least as
 * long, again at line start.
 */
function tryEnterFence(source: string, i: number): number | null {
	// Must be at the start of a line (or start of source).
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

	// Find end of the opening-fence line (language-tag consumed).
	let afterOpen = i + runLen;
	while (afterOpen < source.length && source[afterOpen] !== '\n') afterOpen += 1;
	if (source[afterOpen] === '\n') afterOpen += 1;

	// Scan line-by-line for a closing fence of the same marker, length >=
	// runLen.
	let cursor = afterOpen;
	while (cursor < source.length) {
		const nextNewline = source.indexOf('\n', cursor);
		const lineEnd = nextNewline === -1 ? source.length : nextNewline;
		const line = source.slice(cursor, lineEnd);

		// Trim up to 3 leading spaces.
		let j = 0;
		while (j < 3 && line[j] === ' ') j += 1;
		let closeLen = 0;
		while (line[j + closeLen] === marker) closeLen += 1;
		if (closeLen >= runLen) {
			// Everything after must be whitespace.
			const tail = line.slice(j + closeLen);
			if (/^\s*$/.test(tail)) {
				return nextNewline === -1 ? source.length : nextNewline + 1;
			}
		}
		cursor = nextNewline === -1 ? source.length : nextNewline + 1;
	}

	// Unclosed fence -- everything to EOF is inside the fence.
	return source.length;
}

/**
 * Skip an inline code span starting at `source[i] === '\`'`. CommonMark says
 * the closing run must be the same length as the opening run. Returns the
 * index past the closing backticks, or `null` if this isn't an inline span
 * (e.g. lone backtick without a matching closer).
 */
function skipInlineCode(source: string, i: number): number | null {
	let runLen = 0;
	while (source[i + runLen] === '`') runLen += 1;
	if (runLen === 0) return null;

	const contentStart = i + runLen;
	let cursor = contentStart;
	while (cursor < source.length) {
		if (source[cursor] === '`') {
			let closeLen = 0;
			while (source[cursor + closeLen] === '`') closeLen += 1;
			if (closeLen === runLen) {
				return cursor + closeLen;
			}
			cursor += closeLen;
			continue;
		}
		cursor += 1;
	}
	return null;
}

// -------- caller helpers --------

/**
 * Extract just the wiki-link nodes (drop plain-text nodes) -- convenient for
 * validators / scanners that don't care about the interleaved prose.
 */
export function extractWikilinks(source: string): {
	wikilinks: readonly Extract<WikilinkAstNode, { kind: 'wikilink' }>[];
	errors: readonly WikilinkParseError[];
} {
	const { nodes, errors } = parseWikilinks(source);
	const wikilinks = nodes.filter((n): n is Extract<WikilinkAstNode, { kind: 'wikilink' }> => n.kind === 'wikilink');
	return { wikilinks, errors };
}
