/**
 * Static extractor for `helpId` / `pageId` references in Svelte source.
 *
 * Scans a Svelte file's text for every prop assignment that targets one of
 * the help-registry-linked prop names (`helpId` on `<InfoTip>`, `pageId` on
 * `<PageHelp>`, or anywhere else in the tree -- the extractor is prop-name
 * driven, not component-name driven, because apps occasionally wrap the
 * primitives and we want to catch every site that ultimately lands in the
 * registry lookup).
 *
 * Three prop-value shapes:
 *
 *   - Static string:   `helpId="session-start"`            -> captured
 *   - Static template: ``helpId={`session-start`}``        -> captured
 *   - Dynamic:         `helpId={someVar}` or any other expr -> skipped,
 *                                                              counted,
 *                                                              warned
 *
 * The scanner is line-oriented so it can report an accurate (1-based) line
 * number for every hit. It never reads the Svelte AST; regex is sufficient
 * for the prop shapes the codebase actually uses and has zero runtime
 * cost. If a future prop shape emerges that needs a real parser, this
 * module is the single point to upgrade.
 */

/** Prop names the validator treats as help-registry references. */
export const HELP_ID_PROP_NAMES: readonly string[] = ['helpId', 'pageId'];

/** A statically-resolved help id reference. */
export interface StaticHelpIdRef {
	readonly kind: 'static';
	readonly propName: string;
	readonly helpId: string;
	readonly filePath: string;
	readonly line: number;
}

/** A dynamic reference we cannot resolve at build time. */
export interface DynamicHelpIdRef {
	readonly kind: 'dynamic';
	readonly propName: string;
	readonly expression: string;
	readonly filePath: string;
	readonly line: number;
}

export type HelpIdRef = StaticHelpIdRef | DynamicHelpIdRef;

/**
 * Build the regex that matches one prop assignment. Matches any of:
 *
 *   helpId="some-id"
 *   helpId='some-id'
 *   helpId={`some-id`}          (no interpolation)
 *   helpId={anyExpr}            (captured as dynamic)
 *
 * Anchored by the prop name and `=`; JSX-style whitespace around `=` is
 * tolerated. Capturing groups:
 *
 *   1: prop name
 *   2: double-quoted string body (undefined if not this shape)
 *   3: single-quoted string body (undefined if not this shape)
 *   4: expression body inside `{...}` (undefined if not this shape)
 */
function buildPropRegex(propNames: readonly string[]): RegExp {
	const alternation = propNames.join('|');
	// The expression body `([^{}]*)` deliberately rejects nested braces --
	// a help-id prop with nested braces is, by construction, dynamic, and
	// our static-template sniff lives inside this branch after capture.
	return new RegExp(`\\b(${alternation})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^{}]*)\\})`, 'g');
}

const PROP_REGEX = buildPropRegex(HELP_ID_PROP_NAMES);

/** Match a bare template literal with no interpolation: `` `foo-bar` `` */
const STATIC_TEMPLATE_REGEX = /^\s*`([^`$]*)`\s*$/;

/**
 * Scan a single Svelte source file's text. Pure, no I/O. Caller owns file
 * reading so tests can pass fixtures directly.
 */
export function extractHelpIdRefs(content: string, filePath: string): readonly HelpIdRef[] {
	const refs: HelpIdRef[] = [];
	// Compute line numbers up-front to avoid O(n^2) scans for every hit.
	const lineStarts = computeLineStarts(content);
	// Reset regex state -- the module-level regex is `g`-flagged.
	PROP_REGEX.lastIndex = 0;
	let match: RegExpExecArray | null = PROP_REGEX.exec(content);
	while (match !== null) {
		const propName = match[1];
		const doubleQuoted = match[2];
		const singleQuoted = match[3];
		const expression = match[4];
		const line = offsetToLine(lineStarts, match.index);
		if (propName === undefined) {
			match = PROP_REGEX.exec(content);
			continue;
		}
		if (doubleQuoted !== undefined) {
			refs.push({ kind: 'static', propName, helpId: doubleQuoted, filePath, line });
		} else if (singleQuoted !== undefined) {
			refs.push({ kind: 'static', propName, helpId: singleQuoted, filePath, line });
		} else if (expression !== undefined) {
			const staticTemplate = STATIC_TEMPLATE_REGEX.exec(expression);
			if (staticTemplate !== null && staticTemplate[1] !== undefined) {
				refs.push({ kind: 'static', propName, helpId: staticTemplate[1], filePath, line });
			} else {
				refs.push({ kind: 'dynamic', propName, expression: expression.trim(), filePath, line });
			}
		}
		match = PROP_REGEX.exec(content);
	}
	return refs;
}

/** Precompute the offset at which each (1-based) line starts. */
function computeLineStarts(content: string): readonly number[] {
	const starts: number[] = [0];
	for (let i = 0; i < content.length; i++) {
		if (content.charCodeAt(i) === 10) {
			starts.push(i + 1);
		}
	}
	return starts;
}

/** Binary search `lineStarts` for the 1-based line number containing `offset`. */
function offsetToLine(lineStarts: readonly number[], offset: number): number {
	let lo = 0;
	let hi = lineStarts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >>> 1;
		const start = lineStarts[mid];
		if (start === undefined || start > offset) {
			hi = mid - 1;
		} else {
			lo = mid;
		}
	}
	return lo + 1;
}
