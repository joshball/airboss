/**
 * Blank out the contents of TypeScript template literals so the downstream
 * markdown wiki-link parser never sees their backticks or inner text.
 *
 * The scanner hands TS source to a markdown-oriented parser that skips
 * fenced code blocks (```) and inline code spans. Stray backticks in TS
 * source (template literals) accidentally trip the inline-code skip,
 * which works for simple one-line templates but breaks down when a
 * template interpolation contains another backtick string:
 *
 *   const x = `outer ${`inner [[A::a]]`} tail [[B::b]]`;
 *
 * Here the markdown skip closes the first `..` at the inner opening
 * backtick, leaves `inner [[A::a]]` as main text (phantom match),
 * re-opens a span at the inner closing backtick, and so on. The fix is
 * to preprocess: walk the TS source with a minimal lexer that is aware of
 * comments, regular strings, and template literals (including nested
 * `${...}` that can themselves contain templates), and replace the
 * content of template literals with whitespace. Offsets and line numbers
 * are preserved so parser error spans still point at the right place.
 *
 * Scope choice: we blank the whole template literal, including
 * interpolation expressions. The brief allows scanning prose inside
 * `${...}` expressions, but untangling that from surrounding code
 * requires a real TS expression parser; templates inside interpolations
 * can themselves contain interpolations, strings, and comments. Skipping
 * the whole literal is conservative and matches the ask for TS-fenced
 * regions to behave like markdown code fences.
 *
 * Single- and double-quoted string literals are deliberately left intact:
 * help content authors embed `[[display::id]]` in single-quoted TS
 * strings and the scanner must still count those.
 */

interface Blank {
	start: number;
	end: number;
}

export function stripTsTemplateLiterals(source: string): string {
	const blanks: Blank[] = [];
	const len = source.length;
	let i = 0;

	while (i < len) {
		const ch = source[i];

		// Line comment: skip through to end-of-line. Do not blank -- comments
		// are prose the scanner is allowed to read.
		if (ch === '/' && source[i + 1] === '/') {
			i += 2;
			while (i < len && source[i] !== '\n') i += 1;
			continue;
		}

		// Block comment.
		if (ch === '/' && source[i + 1] === '*') {
			i += 2;
			while (i < len && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
			if (i < len) i += 2;
			continue;
		}

		// Regular string literal -- step past without blanking.
		if (ch === '"' || ch === "'") {
			const quote = ch;
			i += 1;
			while (i < len && source[i] !== quote) {
				if (source[i] === '\\' && i + 1 < len) {
					i += 2;
					continue;
				}
				if (source[i] === '\n') break; // unterminated; bail
				i += 1;
			}
			if (i < len && source[i] === quote) i += 1;
			continue;
		}

		// Template literal -- enter and capture the full span (including
		// interpolation bodies) for blanking.
		if (ch === '`') {
			const templateStart = i;
			i += 1;
			i = consumeTemplateBody(source, i, blanks);
			// `consumeTemplateBody` returns the index just past the closing
			// backtick (or EOF). Record the span between the opening and
			// closing backticks exclusive, so the backticks themselves remain
			// in the output and the parser sees a plain empty span.
			const closed = i <= len && source[i - 1] === '`';
			const contentEnd = closed ? i - 1 : i;
			if (contentEnd > templateStart + 1) {
				blanks.push({ start: templateStart + 1, end: contentEnd });
			}
			continue;
		}

		i += 1;
	}

	return applyBlanks(source, blanks);
}

/**
 * Consume a template-literal body starting at `start` (the index just
 * after the opening backtick). Returns the index just past the closing
 * backtick, or `source.length` on unterminated input.
 *
 * Any `${...}` interpolations are walked with matching braces, and any
 * nested template literals inside the interpolation are handled
 * recursively (their spans are appended to `blanks` so they also get
 * blanked in the final output).
 */
function consumeTemplateBody(source: string, start: number, blanks: Blank[]): number {
	const len = source.length;
	let i = start;
	while (i < len) {
		const ch = source[i];
		if (ch === '\\' && i + 1 < len) {
			i += 2;
			continue;
		}
		if (ch === '`') {
			return i + 1;
		}
		if (ch === '$' && source[i + 1] === '{') {
			i = consumeInterpolation(source, i + 2, blanks);
			continue;
		}
		i += 1;
	}
	return len;
}

/**
 * Consume an interpolation body starting at `start` (the index just after
 * `${`). Returns the index just past the closing `}`, or `source.length`
 * on unterminated input. Tracks nested braces, string literals, template
 * literals, and comments so the matching `}` is correctly identified.
 */
function consumeInterpolation(source: string, start: number, blanks: Blank[]): number {
	const len = source.length;
	let i = start;
	let depth = 1;
	while (i < len && depth > 0) {
		const ch = source[i];

		if (ch === '/' && source[i + 1] === '/') {
			i += 2;
			while (i < len && source[i] !== '\n') i += 1;
			continue;
		}
		if (ch === '/' && source[i + 1] === '*') {
			i += 2;
			while (i < len && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
			if (i < len) i += 2;
			continue;
		}
		if (ch === '"' || ch === "'") {
			const quote = ch;
			i += 1;
			while (i < len && source[i] !== quote) {
				if (source[i] === '\\' && i + 1 < len) {
					i += 2;
					continue;
				}
				if (source[i] === '\n') break;
				i += 1;
			}
			if (i < len && source[i] === quote) i += 1;
			continue;
		}
		if (ch === '`') {
			const innerStart = i;
			i += 1;
			i = consumeTemplateBody(source, i, blanks);
			const closed = i <= len && source[i - 1] === '`';
			const innerContentEnd = closed ? i - 1 : i;
			if (innerContentEnd > innerStart + 1) {
				blanks.push({ start: innerStart + 1, end: innerContentEnd });
			}
			continue;
		}
		if (ch === '{') {
			depth += 1;
			i += 1;
			continue;
		}
		if (ch === '}') {
			depth -= 1;
			i += 1;
			if (depth === 0) return i;
			continue;
		}
		i += 1;
	}
	return len;
}

/**
 * Replace every byte in `source` covered by any blank span with either a
 * space or a newline (preserving newlines so line numbers survive).
 */
function applyBlanks(source: string, blanks: readonly Blank[]): string {
	if (blanks.length === 0) return source;
	const chars = source.split('');
	for (const blank of blanks) {
		for (let k = blank.start; k < blank.end; k += 1) {
			if (chars[k] !== '\n') chars[k] = ' ';
		}
	}
	return chars.join('');
}
