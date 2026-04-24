import { describe, expect, it } from 'vitest';
import { highlight, SHIKI_THEME_DARK, SHIKI_THEME_LIGHT } from './highlight';

describe('shiki highlight (dual theme)', () => {
	it('falls back to an escaped plain block for text lang', async () => {
		const html = await highlight('plain <ok>', 'text');
		expect(html).toContain('md-code-plain');
		expect(html).toContain('&lt;ok&gt;');
		// No shiki variables on the passthrough path.
		expect(html).not.toContain('--shiki-light');
	});

	it('emits both light and dark CSS variables for a supported lang', async () => {
		const html = await highlight('const x = 1;', 'typescript');
		// With `defaultColor: false`, Shiki emits every token with both
		// CSS variables so our CSS can pick by data-appearance.
		expect(html).toContain('--shiki-light');
		expect(html).toContain('--shiki-dark');
		// Class list carries both theme names so scoped selectors can target either.
		expect(html).toContain(SHIKI_THEME_LIGHT);
		expect(html).toContain(SHIKI_THEME_DARK);
	});

	it('does not emit an inline `color:` default on spans when defaultColor is false', async () => {
		// Shiki normally adds `color:#xxx` inline for the default theme.
		// With `defaultColor: false`, spans should only carry CSS variables.
		const html = await highlight('const x = 1;', 'typescript');
		// The outer <pre> carries background-color:var(--shiki-light-bg) with our
		// config, which is fine. Spans should not hardcode a color value.
		const spanColorInline = /<span[^>]*style="[^"]*\bcolor:\s*#[0-9a-fA-F]{3,8}/.test(html);
		expect(spanColorInline).toBe(false);
	});
});
