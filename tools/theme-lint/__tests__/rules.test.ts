import { describe, expect, it } from 'vitest';
import { buildKnownTokens, extractStyleBlocks, scanCssSource } from '../rules';

const knownTokens = buildKnownTokens();

function scan(source: string): ReturnType<typeof scanCssSource> {
	return scanCssSource({ file: 'test.css', source, knownTokens });
}

describe('theme-lint rules', () => {
	it('flags hex colors', () => {
		const v = scan('.x { background: #fff; }');
		expect(v.some((e) => e.rule === 'hex-color')).toBe(true);
	});

	it('flags rgb() literals', () => {
		const v = scan('.x { background: rgb(255, 255, 255); }');
		expect(v.some((e) => e.rule === 'rgb-color')).toBe(true);
	});

	it('flags rgba() literals', () => {
		const v = scan('.x { background: rgba(0, 0, 0, 0.4); }');
		expect(v.some((e) => e.rule === 'rgb-color')).toBe(true);
	});

	it('flags hsl() literals', () => {
		const v = scan('.x { color: hsl(200 50% 50%); }');
		expect(v.some((e) => e.rule === 'hsl-color')).toBe(true);
	});

	it('flags oklch() literals in call sites', () => {
		const v = scan('.x { color: oklch(0.5 0.1 200); }');
		expect(v.some((e) => e.rule === 'oklch-literal')).toBe(true);
	});

	it('flags named CSS colors on color props', () => {
		const v = scan('.x { background: white; }');
		expect(v.some((e) => e.rule === 'named-color')).toBe(true);
	});

	it('allows `transparent` keyword', () => {
		const v = scan('.x { background: transparent; }');
		expect(v.filter((e) => e.rule === 'named-color')).toHaveLength(0);
	});

	it('allows `currentColor` keyword', () => {
		const v = scan('.x { color: currentColor; }');
		expect(v.filter((e) => e.rule === 'named-color')).toHaveLength(0);
	});

	it('passes var(--surface-page)', () => {
		const v = scan('.x { background: var(--surface-page); }');
		expect(v).toHaveLength(0);
	});

	it('flags raw rem padding', () => {
		const v = scan('.x { padding: 1rem; }');
		expect(v.some((e) => e.rule === 'raw-length')).toBe(true);
	});

	it('passes var(--space-lg) padding', () => {
		const v = scan('.x { padding: var(--space-lg); }');
		expect(v).toHaveLength(0);
	});

	it('allows `1px` in borders as a convention', () => {
		const v = scan('.x { border: 1px solid var(--edge-default); }');
		expect(v).toHaveLength(0);
	});

	it('flags hardcoded transition durations', () => {
		const v = scan('.x { transition: color 120ms; }');
		expect(v.some((e) => e.rule === 'raw-duration')).toBe(true);
	});

	it('passes var(--motion-fast) transitions', () => {
		const v = scan('.x { transition: color var(--motion-fast); }');
		expect(v).toHaveLength(0);
	});

	it('flags hardcoded font-family literals', () => {
		const v = scan('.x { font-family: Inter, sans-serif; }');
		expect(v.some((e) => e.rule === 'font-family-literal')).toBe(true);
	});

	it('allows font-family: inherit', () => {
		const v = scan('.x { font-family: inherit; }');
		expect(v).toHaveLength(0);
	});

	it('allows font-family via var() only', () => {
		const v = scan('.x { font-family: var(--font-family-sans); }');
		expect(v).toHaveLength(0);
	});

	it('flags unknown var(--*) references', () => {
		const v = scan('.x { color: var(--ink-wrongname); }');
		expect(v.some((e) => e.rule === 'unknown-token' && e.message.includes('--ink-wrongname'))).toBe(true);
	});

	it('passes legacy --ab-* aliases (they exist)', () => {
		const v = scan('.x { background: var(--ab-color-surface); }');
		expect(v.filter((e) => e.rule === 'unknown-token')).toHaveLength(0);
	});

	it('suppresses violations after a lint-disable comment on its own line', () => {
		const source = [
			'.x {',
			'  /* lint-disable-token-enforcement: debug border */',
			'  border: 2px solid #ff00ff;',
			'}',
		].join('\n');
		const v = scan(source);
		expect(v.filter((e) => e.rule === 'hex-color')).toHaveLength(0);
	});

	it('requires a non-empty reason on the exception comment', () => {
		const source = ['.x {', '  /* lint-disable-token-enforcement: */', '  background: #fff;', '}'].join('\n');
		const v = scan(source);
		expect(v.some((e) => e.rule === 'hex-color')).toBe(true);
	});

	it('extracts style blocks from Svelte files', () => {
		const src = '<script>let x = 1;</script>\n<style>\n.a { background: #fff; }\n</style>\n';
		const blocks = extractStyleBlocks(src);
		expect(blocks).toHaveLength(1);
		const block = blocks[0];
		expect(block).toBeDefined();
		if (!block) return;
		expect(block.body).toContain('background: #fff');
	});

	it('reports line numbers within Svelte style blocks using the startLine offset', () => {
		const src = '<script>let x = 1;</script>\n<style>\n.a { background: #fff; }\n</style>\n';
		const blocks = extractStyleBlocks(src);
		const block = blocks[0];
		expect(block).toBeDefined();
		if (!block) return;
		const v = scanCssSource({ file: 'Foo.svelte', source: block.body, startLine: block.startLine, knownTokens });
		// The style tag is on source line 2, so `.a { ... }` on line 3.
		expect(v[0]?.line).toBe(3);
	});
});
