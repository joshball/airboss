/**
 * Codemod transforms -- pure functions over CSS source text.
 *
 * The transforms are:
 *   1. Legacy alias rewrite (historical -- the alias surface was retired
 *      when Option A closed, so `rewriteLegacyAliases` is now a no-op
 *      kept for future --ab-* stragglers that might appear).
 *   2. Radius literals: `border-radius: 8px` -> `border-radius: var(--radius-md)`
 *      (nearest rung).
 *   3. Transition durations: `120ms` -> `var(--motion-fast)`, `200ms` ->
 *      `var(--motion-normal)`.
 *   4. Font family literals: known stacks -> `var(--font-family-sans)`
 *      / `var(--font-family-mono)`.
 *
 * Context-dependent rewrites (is this `#fff` a background or a text
 * color?) are not auto-fixed; they get a `/* TODO-theme: ... *\/`
 * comment appended above the declaration.
 *
 * Every transform is idempotent: running twice is equivalent to once.
 */

export interface CodemodChange {
	rule: CodemodRuleId;
	line: number;
	before: string;
	after: string;
}

export type CodemodRuleId =
	| 'legacy-alias'
	| 'radius-literal'
	| 'motion-literal'
	| 'font-family-literal'
	| 'todo-color';

export interface CodemodResult {
	source: string;
	changes: CodemodChange[];
}

// Alias surface retired with Option A. Map is empty so the transform
// becomes a structural no-op without changing the codemod contract.
const LEGACY_MAP: Map<string, string> = new Map();

const RADIUS_RUNG_ORDER: ReadonlyArray<readonly [number, string]> = [
	[0, 'var(--radius-sharp)'],
	[2, 'var(--radius-xs)'],
	[4, 'var(--radius-sm)'],
	[6, 'var(--radius-md)'],
	[8, 'var(--radius-md)'],
	[10, 'var(--radius-lg)'],
	[12, 'var(--radius-lg)'],
	[9999, 'var(--radius-pill)'],
];

function nearestRadius(px: number): string {
	let best = RADIUS_RUNG_ORDER[0];
	if (!best) return 'var(--radius-md)';
	let bestDiff = Math.abs(px - best[0]);
	for (const entry of RADIUS_RUNG_ORDER) {
		const diff = Math.abs(px - entry[0]);
		if (diff < bestDiff) {
			best = entry;
			bestDiff = diff;
		}
	}
	return best[1];
}

const MOTION_MAP: ReadonlyArray<readonly [number, string]> = [
	[80, 'var(--motion-fast)'],
	[120, 'var(--motion-fast)'],
	[150, 'var(--motion-fast)'],
	[180, 'var(--motion-normal)'],
	[200, 'var(--motion-normal)'],
	[240, 'var(--motion-normal)'],
	[300, 'var(--motion-normal)'],
];

function nearestMotion(ms: number): string | undefined {
	let best: string | undefined;
	let bestDiff = Number.POSITIVE_INFINITY;
	for (const [rungMs, token] of MOTION_MAP) {
		const diff = Math.abs(ms - rungMs);
		if (diff < bestDiff) {
			best = token;
			bestDiff = diff;
		}
	}
	// Only remap if within 60ms of a known rung -- otherwise leave a TODO.
	if (bestDiff > 60) return undefined;
	return best;
}

const FONT_FAMILY_MAPPINGS: ReadonlyArray<readonly [RegExp, string]> = [
	[/["']?(?:SF Mono|Monaco|Menlo|Consolas|Roboto Mono|Fira Code|JetBrains Mono|Courier New)["']?/i, 'var(--font-family-mono)'],
	[/["']?(?:Inter|system-ui|-apple-system|BlinkMacSystemFont|Segoe UI|Roboto|Helvetica Neue|Arial)["']?/i, 'var(--font-family-sans)'],
];

/** Replace every legacy alias reference inside a block of source text. */
export function rewriteLegacyAliases(source: string): CodemodResult {
	const changes: CodemodChange[] = [];
	const re = /var\(\s*(--ab-[a-z0-9-]+)\s*(,[^)]*)?\)/g;
	const lines = source.split('\n');
	const updated = source.replace(re, (match, name: string, fallback: string | undefined, offset: number) => {
		const replacement = LEGACY_MAP.get(name);
		if (!replacement) return match;
		// Only rewrite if the alias is itself a `var(--role)` reference.
		// Aliases that expand to pixel values (2px, 1.75rem) stay as legacy
		// names so the emitted `--ab-*` block keeps resolving them.
		if (!replacement.startsWith('var(')) return match;
		const line = source.slice(0, offset).split('\n').length;
		const next = fallback ? `${replacement.slice(0, -1)}${fallback})` : replacement;
		changes.push({ rule: 'legacy-alias', line, before: match, after: next });
		return next;
	});
	void lines;
	return { source: updated, changes };
}

/** Rewrite literal `border-radius: Npx` declarations. */
export function rewriteRadiusLiterals(source: string): CodemodResult {
	const changes: CodemodChange[] = [];
	const re = /(border(?:-top|-bottom)?(?:-left|-right)?-radius)\s*:\s*([^;\n]+)(;|\n)/g;
	const updated = source.replace(re, (match, prop: string, value: string, term: string, offset: number) => {
		const trimmed = value.trim();
		// Skip if already using a var().
		if (/var\(/.test(trimmed)) return match;
		const pxMatch = trimmed.match(/^(\d+(?:\.\d+)?)px$/);
		if (!pxMatch) return match;
		const pxStr = pxMatch[1];
		if (pxStr === undefined) return match;
		const px = Number.parseFloat(pxStr);
		if (px === 0) return match;
		const token = nearestRadius(px);
		const line = source.slice(0, offset).split('\n').length;
		const next = `${prop}: ${token}${term}`;
		changes.push({ rule: 'radius-literal', line, before: match, after: next });
		return next;
	});
	return { source: updated, changes };
}

/** Rewrite literal durations in transition-* / animation-* values. */
export function rewriteMotionLiterals(source: string): CodemodResult {
	const changes: CodemodChange[] = [];
	// Match any `transition: ...` / `transition-duration: ...` / `animation-duration: ...`.
	const re = /((?:transition|transition-duration|animation-duration|animation))\s*:\s*([^;\n]+)(;|\n)/g;
	const updated = source.replace(re, (match, prop: string, value: string, term: string, offset: number) => {
		let changed = false;
		const replaced = value.replace(/(\d+(?:\.\d+)?)(ms|s)\b/g, (dur, numStr: string, unit: string) => {
			const num = Number.parseFloat(numStr);
			if (num === 0) return dur;
			const ms = unit === 's' ? num * 1000 : num;
			const token = nearestMotion(ms);
			if (!token) return dur;
			changed = true;
			return token;
		});
		if (!changed) return match;
		const line = source.slice(0, offset).split('\n').length;
		const next = `${prop}: ${replaced}${term}`;
		changes.push({ rule: 'motion-literal', line, before: match, after: next });
		return next;
	});
	return { source: updated, changes };
}

/** Rewrite `font-family: <known-stack>` declarations. */
export function rewriteFontFamilyLiterals(source: string): CodemodResult {
	const changes: CodemodChange[] = [];
	const re = /(font-family)\s*:\s*([^;\n]+)(;|\n)/g;
	const updated = source.replace(re, (match, prop: string, value: string, term: string, offset: number) => {
		const trimmed = value.trim();
		if (/^var\(/.test(trimmed) || /^(inherit|initial|unset|revert)$/i.test(trimmed)) return match;
		for (const [re2, token] of FONT_FAMILY_MAPPINGS) {
			if (re2.test(trimmed)) {
				const line = source.slice(0, offset).split('\n').length;
				const next = `${prop}: ${token}${term}`;
				changes.push({ rule: 'font-family-literal', line, before: match, after: next });
				return next;
			}
		}
		return match;
	});
	return { source: updated, changes };
}

/**
 * Add `/* TODO-theme: ... *\/` comments above context-ambiguous color
 * literals. Intentionally does not rewrite -- a human must decide.
 */
export function annotateAmbiguousColors(source: string): CodemodResult {
	const changes: CodemodChange[] = [];
	const re = /((?:color|background|background-color|border|border-color|fill|stroke)\s*:\s*(?:#[0-9a-fA-F]{3,8}|white|black|rgba?\([^)]+\))[^;\n}]*)(;|(?=\}))/g;
	const updated = source.replace(re, (match, decl: string, term: string, offset: number) => {
		// Skip if already preceded by a TODO-theme marker within 200 chars.
		const ahead = source.slice(Math.max(0, offset - 200), offset);
		if (/TODO-theme/.test(ahead)) return match;
		const line = source.slice(0, offset).split('\n').length;
		// Insert the TODO comment inline before the declaration so the codemod
		// works whether or not the declaration is on its own line.
		const replacement = `/* TODO-theme: pick a role token for this literal. */ ${decl}${term}`;
		changes.push({ rule: 'todo-color', line, before: decl, after: replacement });
		return replacement;
	});
	return { source: updated, changes };
}

/** Run every transform in a deterministic order. Returns merged result. */
export function runAllTransforms(source: string): CodemodResult {
	const all: CodemodChange[] = [];
	let current = source;
	for (const transform of [
		rewriteLegacyAliases,
		rewriteRadiusLiterals,
		rewriteMotionLiterals,
		rewriteFontFamilyLiterals,
		annotateAmbiguousColors,
	]) {
		const r = transform(current);
		current = r.source;
		all.push(...r.changes);
	}
	return { source: current, changes: all };
}
