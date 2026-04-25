/**
 * Pre-hydration script generator tests.
 *
 * The script is what stops FOUC; if its allow-list drifts from
 * `listThemes()` or its forced-dark check stops naming `sim/glass`, dark
 * users see a light flash on every reload. These tests pin the
 * generator's contract so the codegen step can't silently regress.
 */

import { describe, expect, it } from 'vitest';
import '../core/defaults/airboss-default/index';
import '../sim/glass/index';
import '../study/flightdeck/index';
import '../study/sectional/index';
import {
	buildPreHydrationCspHash,
	buildPreHydrationScript,
	injectPreHydrationScript,
	PRE_HYDRATION_PLACEHOLDER,
} from '../picker/pre-hydration';
import { listThemes } from '../registry';
import { THEMES } from '../resolve';

describe('buildPreHydrationScript', () => {
	const script = buildPreHydrationScript();

	it('embeds every registered theme id in the allow-list', () => {
		for (const theme of listThemes()) {
			expect(script).toContain(`'${theme.id}': 1`);
		}
	});

	it('hard-codes the path-default mapping (sim, dashboard, fallback)', () => {
		expect(script).toContain(`sim ? '${THEMES.SIM_GLASS}'`);
		expect(script).toContain(`flightdeck ? '${THEMES.STUDY_FLIGHTDECK}'`);
		expect(script).toContain(`: '${THEMES.STUDY_SECTIONAL}'`);
	});

	it('forces dark only for sim/glass', () => {
		expect(script).toContain(`forcedDark = theme === '${THEMES.SIM_GLASS}'`);
	});

	it('reads both `theme` and `appearance` cookies', () => {
		expect(script).toContain('theme=([^;]+)');
		expect(script).toContain('appearance=(system|light|dark)');
	});

	it('sets the three data-* attributes on <html>', () => {
		expect(script).toContain("setAttribute('data-theme'");
		expect(script).toContain("setAttribute('data-appearance'");
		expect(script).toContain("setAttribute('data-layout'");
	});

	it('is deterministic across calls (alphabetical allow-list)', () => {
		expect(buildPreHydrationScript()).toBe(script);
	});
});

describe('buildPreHydrationCspHash', () => {
	it('returns a sha256-prefixed base64 hash', async () => {
		const hash = await buildPreHydrationCspHash('console.log("ok")');
		expect(hash).toMatch(/^sha256-[A-Za-z0-9+/=]+$/);
	});

	it('changes when the body changes', async () => {
		const a = await buildPreHydrationCspHash('a');
		const b = await buildPreHydrationCspHash('b');
		expect(a).not.toBe(b);
	});

	it('matches the script body it was computed for', async () => {
		const body = buildPreHydrationScript();
		const a = await buildPreHydrationCspHash(body);
		const b = await buildPreHydrationCspHash(body);
		expect(a).toBe(b);
	});
});

describe('injectPreHydrationScript', () => {
	it('replaces the placeholder with the body', () => {
		const html = `<script>${PRE_HYDRATION_PLACEHOLDER}</script>`;
		const out = injectPreHydrationScript(html, 'doStuff();');
		expect(out).toBe('<script>doStuff();</script>');
	});

	it('is a no-op when the placeholder is missing', () => {
		const html = '<script>nothing</script>';
		expect(injectPreHydrationScript(html, 'whatever')).toBe(html);
	});

	it('does NOT interpret $-style replacement patterns in the body', () => {
		const html = `<head>${PRE_HYDRATION_PLACEHOLDER}</head>`;
		// `$&` would expand to the matched text under naive `replace` callers.
		const body = 'var x = "$&"';
		expect(injectPreHydrationScript(html, body)).toBe('<head>var x = "$&"</head>');
	});
});
