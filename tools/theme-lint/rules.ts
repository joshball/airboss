/**
 * Theme-lint rules -- pure functions over CSS source text.
 *
 * Scope: content of a Svelte `<style>` block or the whole body of a
 * `.css` file. The caller is responsible for extracting style blocks.
 *
 * Every rule reports `{ line, column, rule, message, snippet }`. Lines
 * and columns are 1-indexed relative to the original source file
 * (the caller passes a starting-line offset for Svelte blocks).
 *
 * Exception mechanism: a comment `\/* lint-disable-token-enforcement: <reason> *\/`
 * suppresses every violation on the *next* non-blank line. The reason
 * is required (non-empty trimmed content after the colon).
 *
 * Known-token list is sourced from `TOKENS` (vocab.ts). Any other
 * `var(--*)` reference is reported as an unknown-token violation.
 * Option A retired the legacy `--ab-*` alias surface entirely.
 */

import { TOKENS } from '@ab/themes';

export interface LintViolation {
	file: string;
	line: number;
	column: number;
	rule: LintRuleId;
	message: string;
	snippet: string;
}

export type LintRuleId =
	| 'hex-color'
	| 'rgb-color'
	| 'hsl-color'
	| 'oklch-literal'
	| 'named-color'
	| 'raw-length'
	| 'raw-duration'
	| 'font-family-literal'
	| 'unknown-token';

const EXCEPTION_RE = /\/\*\s*lint-disable-token-enforcement:\s*([^*]+?)\s*\*\//;

/** Tokens that are legal to reference as `var(--X)`. */
export function buildKnownTokens(): Set<string> {
	const known = new Set<string>();
	for (const value of Object.values(TOKENS)) known.add(value);
	// Atomic families emitted by emit.ts that aren't in TOKENS.
	const emittedExtras = [
		// font-size / font-weight / line-height / tracking atomic
		'--font-size-xs',
		'--font-size-sm',
		'--font-size-body',
		'--font-size-base',
		'--font-size-lg',
		'--font-size-xl',
		'--font-size-2xl',
		'--font-weight-regular',
		'--font-weight-medium',
		'--font-weight-semibold',
		'--font-weight-bold',
		'--line-height-tight',
		'--line-height-normal',
		'--line-height-relaxed',
		'--letter-spacing-tight',
		'--letter-spacing-normal',
		'--letter-spacing-wide',
		'--letter-spacing-caps',
		// controls atomic
		'--control-radius',
		'--control-padding-x-sm',
		'--control-padding-y-sm',
		'--control-padding-x-md',
		'--control-padding-y-md',
		'--control-padding-x-lg',
		'--control-padding-y-lg',
		'--control-font-size-sm',
		'--control-font-size-md',
		'--control-font-size-lg',
	];
	for (const extra of emittedExtras) known.add(extra);
	// Bundle + control + sim role tokens are emitted programmatically.
	// Match their shapes by prefix below (see isKnownTokenPrefix).
	return known;
}

const KNOWN_PREFIXES: ReadonlyArray<RegExp> = [
	/^--type-(reading|heading|ui|code|definition)-[a-z0-9-]+-(family|size|weight|line-height|tracking)$/,
	/^--button-(default|primary|hazard|neutral|ghost)-[a-z-]+$/,
	/^--button-height-(sm|md|lg)$/,
	/^--input-(default|error)-[a-z-]+$/,
	/^--input-height-(sm|md|lg)$/,
	/^--badge-height-(sm|md|lg)$/,
	/^--dialog-(scrim|bg|edge|radius|shadow)$/,
	/^--table-(header-bg|header-ink|row-edge|row-bg-hover|row-bg-selected)$/,
	/^--underline-offset-[a-z0-9]+$/,
	/^--sim-[a-z0-9-]+$/,
	/^--avionics-[a-z0-9-]+$/,
];

function isKnownToken(name: string, known: Set<string>): boolean {
	if (known.has(name)) return true;
	for (const re of KNOWN_PREFIXES) if (re.test(name)) return true;
	return false;
}

/** Named CSS colors that are blocked when used on color-ish properties. */
const NAMED_COLORS: ReadonlySet<string> = new Set([
	'white',
	'black',
	'red',
	'green',
	'blue',
	'yellow',
	'orange',
	'purple',
	'pink',
	'gray',
	'grey',
	'silver',
	'gold',
	'brown',
	'cyan',
	'magenta',
	'lime',
	'navy',
	'teal',
	'aqua',
	'maroon',
	'olive',
	'coral',
	'salmon',
	'khaki',
	'violet',
	'indigo',
	'crimson',
	'turquoise',
	'tan',
	'beige',
	'ivory',
	'lavender',
	'plum',
	'wheat',
]);

/** CSS values that are always allowed (keywords, identity). */
const ALLOWED_COLOR_KEYWORDS: ReadonlySet<string> = new Set([
	'transparent',
	'currentColor',
	'currentcolor',
	'inherit',
	'initial',
	'unset',
	'revert',
	'none',
	'auto',
]);

/** Properties where a color value is expected / enforced. */
const COLOR_PROPERTIES = new Set([
	'color',
	'background',
	'background-color',
	'border',
	'border-color',
	'border-top',
	'border-right',
	'border-bottom',
	'border-left',
	'border-top-color',
	'border-right-color',
	'border-bottom-color',
	'border-left-color',
	'outline',
	'outline-color',
	'fill',
	'stroke',
	'caret-color',
	'column-rule-color',
	'text-decoration-color',
	'box-shadow',
	'text-shadow',
]);

/** Properties where raw rem/px/em values are blocked. */
const LENGTH_BLOCKED_PROPERTIES = new Set([
	'padding',
	'padding-top',
	'padding-right',
	'padding-bottom',
	'padding-left',
	'padding-block',
	'padding-inline',
	'padding-block-start',
	'padding-block-end',
	'padding-inline-start',
	'padding-inline-end',
	'margin',
	'margin-top',
	'margin-right',
	'margin-bottom',
	'margin-left',
	'margin-block',
	'margin-inline',
	'margin-block-start',
	'margin-block-end',
	'margin-inline-start',
	'margin-inline-end',
	'gap',
	'row-gap',
	'column-gap',
	'font-size',
	'line-height',
	'letter-spacing',
	'border-radius',
	'border-top-left-radius',
	'border-top-right-radius',
	'border-bottom-left-radius',
	'border-bottom-right-radius',
]);

/** Properties where transition durations etc must be tokens. */
const DURATION_PROPERTIES = new Set([
	'transition',
	'transition-duration',
	'transition-delay',
	'animation',
	'animation-duration',
	'animation-delay',
]);

/** Parse property / value pairs from a CSS body. Ignores selectors, at-rules. */
interface Declaration {
	property: string;
	value: string;
	line: number;
	column: number;
}

/**
 * Tokenize declarations by walking the source character-by-character.
 * Tracks line/column, strips comments, respects nested braces.
 */
function parseDeclarations(source: string, startLine: number): Declaration[] {
	const decls: Declaration[] = [];
	let line = startLine;
	let col = 1;
	let i = 0;
	const n = source.length;
	// `propStart` / `propEnd` mark the active property name as we read.
	while (i < n) {
		// Skip whitespace.
		while (i < n && /\s/.test(source[i] ?? '')) {
			if (source[i] === '\n') {
				line++;
				col = 1;
			} else {
				col++;
			}
			i++;
		}
		if (i >= n) break;
		// Skip comments.
		if (source[i] === '/' && source[i + 1] === '*') {
			const end = source.indexOf('*/', i + 2);
			const endIdx = end === -1 ? n : end + 2;
			for (let j = i; j < endIdx; j++) {
				if (source[j] === '\n') {
					line++;
					col = 1;
				} else {
					col++;
				}
			}
			i = endIdx;
			continue;
		}
		// Skip at-rule prelude up to `{` or `;`.
		if (source[i] === '@') {
			while (i < n && source[i] !== '{' && source[i] !== ';') {
				if (source[i] === '\n') {
					line++;
					col = 1;
				} else {
					col++;
				}
				i++;
			}
			if (source[i] === ';') {
				i++;
				col++;
				continue;
			}
			// Consume `{` and continue; the body parses as normal.
			if (source[i] === '{') {
				i++;
				col++;
				continue;
			}
		}
		// `}` just pops -- we flatten nested blocks.
		if (source[i] === '}') {
			i++;
			col++;
			continue;
		}
		// Read up to `{` (selector) or `:` (property) or `;` (orphan).
		let start = i;
		let sawColon = false;
		let colonIdx = -1;
		let sLine = line;
		let sCol = col;
		while (i < n) {
			const ch = source[i];
			if (ch === '{' || ch === ';' || ch === '}') break;
			if (ch === ':' && !sawColon) {
				// Could be a pseudo-class (selector). Peek: if next non-space is `{` before `;`, it's a selector.
				// Heuristic: if we haven't yet seen `{`, a `:` followed by a letter inside what looks like a selector
				// path should not be treated as a declaration. We distinguish by searching ahead for `{` vs `;`.
				let j = i + 1;
				let saw: '{' | ';' | null = null;
				while (j < n) {
					const c2 = source[j];
					if (c2 === '{') {
						saw = '{';
						break;
					}
					if (c2 === ';') {
						saw = ';';
						break;
					}
					if (c2 === '}') break;
					j++;
				}
				if (saw === ';' || saw === null) {
					sawColon = true;
					colonIdx = i;
				} else {
					// Selector: skip rest to `{`.
					while (i < n && source[i] !== '{') {
						if (source[i] === '\n') {
							line++;
							col = 1;
						} else {
							col++;
						}
						i++;
					}
					// Consume `{`.
					if (source[i] === '{') {
						i++;
						col++;
					}
					start = i;
					sLine = line;
					sCol = col;
					sawColon = false;
					continue;
				}
			}
			if (ch === '\n') {
				line++;
				col = 1;
			} else {
				col++;
			}
			i++;
		}
		if (sawColon && colonIdx >= start) {
			const property = source.slice(start, colonIdx).trim().toLowerCase();
			const value = source.slice(colonIdx + 1, i).trim();
			if (property && value) {
				decls.push({ property, value, line: sLine, column: sCol });
			}
		}
		// Consume `;` or `{` or `}`.
		if (i < n && (source[i] === ';' || source[i] === '{' || source[i] === '}')) {
			if (source[i] === '\n') {
				line++;
				col = 1;
			} else {
				col++;
			}
			i++;
		}
	}
	return decls;
}

/**
 * Build a per-line set of "this line is suppressed" flags by scanning
 * for `lint-disable-token-enforcement` comments. A comment suppresses
 * the *next non-blank line* after the comment closes.
 */
function buildSuppressedLines(source: string, startLine: number): Set<number> {
	const suppressed = new Set<number>();
	const lines = source.split('\n');
	let awaitingNextLine = false;
	for (let idx = 0; idx < lines.length; idx++) {
		const line = lines[idx] ?? '';
		const match = EXCEPTION_RE.exec(line);
		const fileLine = startLine + idx;
		if (awaitingNextLine && line.trim().length > 0) {
			suppressed.add(fileLine);
			awaitingNextLine = false;
		}
		if (match) {
			// The reason must be non-empty.
			const reason = (match[1] ?? '').trim();
			if (reason.length === 0) continue;
			// If the comment is on a line with other code, suppress this same line.
			const beforeComment = line.slice(0, match.index).trim();
			const afterComment = line.slice(match.index + match[0].length).trim();
			if (beforeComment.length > 0 || afterComment.length > 0) {
				suppressed.add(fileLine);
			} else {
				awaitingNextLine = true;
			}
		}
	}
	return suppressed;
}

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_RE = /\brgba?\s*\(/gi;
const HSL_RE = /\bhsla?\s*\(/gi;
const OKLCH_RE = /\boklch\s*\(/gi;
const DURATION_RE = /(?<![\w-])(\d+(?:\.\d+)?)(ms|s)\b/g;
const LENGTH_RE = /(?<![\w.-])(\d+(?:\.\d+)?)(rem|em|px)\b/g;
const VAR_RE = /var\(\s*(--[a-z0-9-]+)/gi;
const FONT_FAMILY_RE = /[,\s]*(["']([^"']+)["']|([a-zA-Z][a-zA-Z0-9-]*))/g;

/** Filter inline `var(...)` calls so we can check bare tokens elsewhere. */
function stripVarCalls(value: string): string {
	// Non-greedy var(--name, fallback) -- we only care about the literal
	// values *outside* var() for color/length/duration detection. Strip
	// whole var() expressions (including nested fallbacks).
	let out = '';
	let depth = 0;
	let i = 0;
	while (i < value.length) {
		if (value.slice(i, i + 4).toLowerCase() === 'var(') {
			depth = 1;
			i += 4;
			while (i < value.length && depth > 0) {
				const ch = value[i];
				if (ch === '(') depth++;
				else if (ch === ')') depth--;
				i++;
			}
			out += ' ';
			continue;
		}
		out += value[i];
		i++;
	}
	return out;
}

/** Strip CSS comments so regex scans don't trip on documentation. */
function stripComments(value: string): string {
	return value.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function scanValue(
	decl: Declaration,
	file: string,
	suppressedLines: Set<number>,
	knownTokens: Set<string>,
): LintViolation[] {
	if (suppressedLines.has(decl.line)) return [];
	const violations: LintViolation[] = [];
	const { property, value, line, column } = decl;
	const cleaned = stripVarCalls(stripComments(value));

	// Color literals -- everywhere (hex/rgb/hsl/oklch).
	let m: RegExpExecArray | null;
	HEX_RE.lastIndex = 0;
	while ((m = HEX_RE.exec(cleaned)) !== null) {
		violations.push({
			file,
			line,
			column,
			rule: 'hex-color',
			message: `Hex color "${m[0]}" on \`${property}\` -- use a role token (var(--...)) instead`,
			snippet: value,
		});
	}
	RGB_RE.lastIndex = 0;
	if (RGB_RE.test(cleaned)) {
		violations.push({
			file,
			line,
			column,
			rule: 'rgb-color',
			message: `rgb()/rgba() literal on \`${property}\` -- use a role token`,
			snippet: value,
		});
	}
	HSL_RE.lastIndex = 0;
	if (HSL_RE.test(cleaned)) {
		violations.push({
			file,
			line,
			column,
			rule: 'hsl-color',
			message: `hsl()/hsla() literal on \`${property}\` -- use a role token`,
			snippet: value,
		});
	}
	OKLCH_RE.lastIndex = 0;
	if (OKLCH_RE.test(cleaned)) {
		violations.push({
			file,
			line,
			column,
			rule: 'oklch-literal',
			message: `oklch() literal on \`${property}\` -- palette OKLCH values belong in libs/themes, not call sites`,
			snippet: value,
		});
	}

	// Named colors on color-carrying properties.
	if (COLOR_PROPERTIES.has(property)) {
		const tokens = cleaned.split(/[\s,()/]+/).filter(Boolean);
		for (const tok of tokens) {
			const lower = tok.toLowerCase();
			if (ALLOWED_COLOR_KEYWORDS.has(lower)) continue;
			if (NAMED_COLORS.has(lower)) {
				violations.push({
					file,
					line,
					column,
					rule: 'named-color',
					message: `Named CSS color "${tok}" on \`${property}\` -- use a role token`,
					snippet: value,
				});
			}
		}
	}

	// Raw lengths on blocked properties. 1px borders + 0 allowed.
	if (LENGTH_BLOCKED_PROPERTIES.has(property)) {
		LENGTH_RE.lastIndex = 0;
		while ((m = LENGTH_RE.exec(cleaned)) !== null) {
			const numStr = m[1];
			const unit = m[2];
			if (numStr === undefined || unit === undefined) continue;
			const numeric = Number.parseFloat(numStr);
			// `1px` is an allowed convention (hairlines).
			if (unit === 'px' && numeric <= 1) continue;
			violations.push({
				file,
				line,
				column,
				rule: 'raw-length',
				message: `Raw length "${m[0]}" on \`${property}\` -- use a scale token (var(--space-*), var(--radius-*), var(--font-size-*))`,
				snippet: value,
			});
		}
	}

	// Raw transition durations (anywhere).
	if (DURATION_PROPERTIES.has(property)) {
		DURATION_RE.lastIndex = 0;
		while ((m = DURATION_RE.exec(cleaned)) !== null) {
			const unit = m[2];
			const numStr = m[1];
			if (unit === undefined || numStr === undefined) continue;
			// `0s` / `0ms` allowed.
			if (Number.parseFloat(numStr) === 0) continue;
			violations.push({
				file,
				line,
				column,
				rule: 'raw-duration',
				message: `Hardcoded duration "${m[0]}" -- use var(--motion-fast) or var(--motion-normal)`,
				snippet: value,
			});
		}
	}

	// Font family: must be `inherit` or a var(--...) reference. A raw
	// family name is a violation.
	if (property === 'font-family') {
		const trimmed = value.trim();
		const isInherit = /^(inherit|initial|unset|revert)$/i.test(trimmed);
		const isVarOnly = /^var\([^)]+\)$/i.test(trimmed);
		if (!isInherit && !isVarOnly) {
			violations.push({
				file,
				line,
				column,
				rule: 'font-family-literal',
				message: `font-family literal "${trimmed}" -- use var(--font-family-*) or a typography-bundle token`,
				snippet: value,
			});
		}
	}

	// Unknown `var(--*)` references.
	VAR_RE.lastIndex = 0;
	while ((m = VAR_RE.exec(value)) !== null) {
		const name = m[1];
		if (name === undefined) continue;
		if (!isKnownToken(name, knownTokens)) {
			violations.push({
				file,
				line,
				column,
				rule: 'unknown-token',
				message: `Unknown token "${name}" -- not in vocab.ts, legacy-aliases.ts, or emitted role-token families`,
				snippet: value,
			});
		}
	}
	return violations;
}

export interface ScanOptions {
	file: string;
	source: string;
	/** Line number the source's line 1 corresponds to in the file. Default 1. */
	startLine?: number;
	knownTokens?: Set<string>;
}

export function scanCssSource(opts: ScanOptions): LintViolation[] {
	const { file, source, startLine = 1 } = opts;
	const knownTokens = opts.knownTokens ?? buildKnownTokens();
	const suppressed = buildSuppressedLines(source, startLine);
	const decls = parseDeclarations(source, startLine);
	const all: LintViolation[] = [];
	for (const decl of decls) {
		all.push(...scanValue(decl, file, suppressed, knownTokens));
	}
	return all;
}

/** Extract every `<style>` block from a Svelte file with line offsets. */
export function extractStyleBlocks(source: string): { body: string; startLine: number }[] {
	const blocks: { body: string; startLine: number }[] = [];
	const re = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(source)) !== null) {
		const openTagEnd = match.index + match[0].indexOf('>') + 1;
		const before = source.slice(0, openTagEnd);
		const startLine = before.split('\n').length;
		const body = match[1] ?? '';
		blocks.push({ body, startLine });
	}
	return blocks;
}
