import { describe, expect, it } from 'vitest';
import {
	annotateAmbiguousColors,
	rewriteFontFamilyLiterals,
	rewriteLegacyAliases,
	rewriteMotionLiterals,
	rewriteRadiusLiterals,
	runAllTransforms,
} from '../transforms';

describe('rewriteLegacyAliases', () => {
	it('rewrites a legacy alias that maps to a role-token', () => {
		const input = '.x { color: var(--ab-color-fg); }';
		const { source, changes } = rewriteLegacyAliases(input);
		expect(source).toContain('var(--ink-body)');
		expect(changes[0]?.rule).toBe('legacy-alias');
	});

	it('leaves aliases that expand to literal values alone', () => {
		// `--ab-focus-ring-offset` maps to `2px`, not a var(). Should stay.
		const input = '.x { outline-offset: var(--ab-focus-ring-offset); }';
		const { source } = rewriteLegacyAliases(input);
		expect(source).toContain('var(--ab-focus-ring-offset)');
	});

	it('is idempotent', () => {
		const input = '.x { color: var(--ab-color-fg); }';
		const once = rewriteLegacyAliases(input).source;
		const twice = rewriteLegacyAliases(once).source;
		expect(once).toBe(twice);
	});
});

describe('rewriteRadiusLiterals', () => {
	it('rewrites 8px to --radius-md', () => {
		const { source } = rewriteRadiusLiterals('.x { border-radius: 8px; }');
		expect(source).toContain('var(--radius-md)');
	});

	it('rewrites 4px to --radius-sm', () => {
		const { source } = rewriteRadiusLiterals('.x { border-radius: 4px; }');
		expect(source).toContain('var(--radius-sm)');
	});

	it('leaves 0 alone', () => {
		const { source, changes } = rewriteRadiusLiterals('.x { border-radius: 0; }');
		expect(source).toContain('border-radius: 0');
		expect(changes).toHaveLength(0);
	});

	it('does not rewrite already-tokenized values', () => {
		const { changes } = rewriteRadiusLiterals('.x { border-radius: var(--radius-lg); }');
		expect(changes).toHaveLength(0);
	});
});

describe('rewriteMotionLiterals', () => {
	it('rewrites 120ms to --motion-fast', () => {
		const { source } = rewriteMotionLiterals('.x { transition: color 120ms; }');
		expect(source).toContain('var(--motion-fast)');
	});

	it('rewrites 200ms to --motion-normal', () => {
		const { source } = rewriteMotionLiterals('.x { transition: opacity 200ms ease; }');
		expect(source).toContain('var(--motion-normal)');
	});

	it('leaves 0s alone', () => {
		const { source } = rewriteMotionLiterals('.x { transition: 0s; }');
		expect(source).toContain('0s');
	});

	it('leaves exotic durations alone for human review', () => {
		const { changes } = rewriteMotionLiterals('.x { transition: all 875ms; }');
		expect(changes).toHaveLength(0);
	});
});

describe('rewriteFontFamilyLiterals', () => {
	it('maps a known sans stack', () => {
		const { source } = rewriteFontFamilyLiterals('.x { font-family: Inter, sans-serif; }');
		expect(source).toContain('var(--font-family-sans)');
	});

	it('maps a known mono stack', () => {
		const { source } = rewriteFontFamilyLiterals('.x { font-family: Menlo, monospace; }');
		expect(source).toContain('var(--font-family-mono)');
	});

	it('leaves `inherit` alone', () => {
		const { changes } = rewriteFontFamilyLiterals('.x { font-family: inherit; }');
		expect(changes).toHaveLength(0);
	});
});

describe('annotateAmbiguousColors', () => {
	it('adds a TODO comment above ambiguous `color: #fff`', () => {
		const { source } = annotateAmbiguousColors('.x { color: #fff; }');
		expect(source).toContain('TODO-theme');
	});

	it('is idempotent (second pass does not re-annotate)', () => {
		const once = annotateAmbiguousColors('.x { color: #fff; }').source;
		const twice = annotateAmbiguousColors(once).source;
		expect(twice).toBe(once);
	});
});

describe('runAllTransforms', () => {
	it('handles a realistic Svelte style block', () => {
		const input = [
			'.x {',
			'  color: var(--ab-color-fg);',
			'  border-radius: 8px;',
			'  transition: background 120ms ease;',
			'}',
		].join('\n');
		const { source, changes } = runAllTransforms(input);
		expect(source).toContain('var(--ink-body)');
		expect(source).toContain('var(--radius-md)');
		expect(source).toContain('var(--motion-fast)');
		expect(changes.length).toBeGreaterThanOrEqual(3);
	});

	it('is idempotent', () => {
		const input = '.x { color: var(--ab-color-fg); border-radius: 8px; transition: 120ms; }';
		const once = runAllTransforms(input).source;
		const twice = runAllTransforms(once).source;
		expect(twice).toBe(once);
	});
});
