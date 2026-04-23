/**
 * Package #2 acceptance: curated typography packs.
 *
 * Verifies that `airbossStandard` and `airbossCompact` ship full
 * bundle-per-role surfaces, that per-family size adjustments are
 * applied at emit time, and that every legacy `--ab-*` typography name
 * in `apps/study/src` resolves to a real `--type-*` role token (not a
 * raw literal, not a TODO sentinel).
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TypeBundle, TypographyPack } from '../contract';
import { AIRBOSS_COMPACT_PACK, AIRBOSS_STANDARD_PACK, TYPOGRAPHY_PACKS } from '../core/typography-packs';
import { emitAllThemes, LEGACY_ALIAS_MAP, themeToCss } from '../index';
import { getTheme } from '../registry';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const STUDY_SRC = resolve(REPO_ROOT, 'apps/study/src');

const READING = ['body', 'lead', 'caption', 'quote'] as const;
const HEADING = ['1', '2', '3', '4', '5', '6'] as const;
const UI = ['control', 'label', 'caption', 'badge'] as const;
const CODE = ['inline', 'block'] as const;
const DEFINITION = ['term', 'body'] as const;

function assertFullBundle(pack: TypographyPack): void {
	for (const v of READING) expect(pack.bundles.reading[v]).toBeDefined();
	for (const v of HEADING) expect(pack.bundles.heading[v]).toBeDefined();
	for (const v of UI) expect(pack.bundles.ui[v]).toBeDefined();
	for (const v of CODE) expect(pack.bundles.code[v]).toBeDefined();
	for (const v of DEFINITION) expect(pack.bundles.definition[v]).toBeDefined();
}

describe('typography packs', () => {
	it('exposes both curated packs in the catalogue', () => {
		expect(TYPOGRAPHY_PACKS['airboss-standard']).toBe(AIRBOSS_STANDARD_PACK);
		expect(TYPOGRAPHY_PACKS['airboss-compact']).toBe(AIRBOSS_COMPACT_PACK);
	});

	it('airboss-standard ships every bundle in every role', () => {
		assertFullBundle(AIRBOSS_STANDARD_PACK);
	});

	it('airboss-compact ships every bundle in every role', () => {
		assertFullBundle(AIRBOSS_COMPACT_PACK);
	});

	it('airboss-standard supplies serif + sans + mono font stacks', () => {
		expect(AIRBOSS_STANDARD_PACK.families.sans.length).toBeGreaterThan(0);
		expect(AIRBOSS_STANDARD_PACK.families.serif.length).toBeGreaterThan(0);
		expect(AIRBOSS_STANDARD_PACK.families.mono.length).toBeGreaterThan(0);
		expect(AIRBOSS_STANDARD_PACK.families.base.length).toBeGreaterThan(0);
	});

	it('airboss-standard serif adjustment is 0.95 (visual weight parity)', () => {
		expect(AIRBOSS_STANDARD_PACK.adjustments.serif).toBeCloseTo(0.95);
	});

	it('airboss-standard mono adjustment is 1.05', () => {
		expect(AIRBOSS_STANDARD_PACK.adjustments.mono).toBeCloseTo(1.05);
	});

	it('airboss-compact uses a mono stack across every family key', () => {
		const families = AIRBOSS_COMPACT_PACK.families;
		expect(families.base).toBe(families.mono);
		expect(families.sans).toBe(families.mono);
		expect(families.serif).toBe(families.mono);
	});
});

describe('registered theme typography', () => {
	it('airboss/default references airboss-standard', () => {
		expect(getTheme('airboss/default').typography.packId).toBe('airboss-standard');
	});

	it('study/sectional inherits airboss-standard', () => {
		expect(getTheme('study/sectional').typography.packId).toBe('airboss-standard');
	});

	it('study/flightdeck references airboss-compact', () => {
		expect(getTheme('study/flightdeck').typography.packId).toBe('airboss-compact');
	});
});

describe('emit: family adjustments', () => {
	it('multiplies bundle sizes by the bundle family adjustment', () => {
		// Build a synthetic pack with a mono adjustment of 2 so the
		// scaling is unambiguous in the emitted value.
		const probe: TypographyPack = {
			packId: 'probe',
			families: {
				sans: 'sans-stack',
				serif: 'serif-stack',
				mono: 'mono-stack',
				base: 'sans-stack',
			},
			adjustments: { sans: 1, serif: 1, mono: 2, base: 1 },
			bundles: {
				reading: {
					body: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					lead: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					caption: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					quote: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
				},
				heading: {
					1: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					2: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					3: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					4: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					5: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					6: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
				},
				ui: {
					control: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					label: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					caption: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					badge: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
				},
				code: {
					inline: { family: 'mono', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					block: { family: 'mono', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
				},
				definition: {
					term: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
					body: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' },
				},
			},
		};
		const css = themeToCss(
			{
				id: 'probe/theme',
				name: 'probe',
				description: 'probe',
				appearances: ['light'],
				defaultAppearance: 'light',
				layouts: { reading: './r.css' },
				defaultLayout: 'reading',
				palette: { light: getTheme('airboss/default').palette.light },
				typography: probe,
				chrome: getTheme('airboss/default').chrome,
				control: getTheme('airboss/default').control,
			},
			'light',
		);
		expect(css).toContain('--type-reading-body-size: 1rem;');
		expect(css).toContain('--type-code-inline-size: 2rem;');
	});
});

describe('legacy alias block — typography role bindings', () => {
	const aliasValueFor = (name: string): string | undefined => LEGACY_ALIAS_MAP.find(([n]) => n === name)?.[1];

	const ALIAS_EXPECTATIONS: ReadonlyArray<readonly [string, string]> = [
		['--ab-font-size-xs', 'var(--type-ui-caption-size)'],
		['--ab-font-size-sm', 'var(--type-ui-label-size)'],
		['--ab-font-size-body', 'var(--type-definition-body-size)'],
		['--ab-font-size-base', 'var(--type-reading-body-size)'],
		['--ab-font-size-lg', 'var(--type-reading-lead-size)'],
		['--ab-font-size-xl', 'var(--type-heading-2-size)'],
		['--ab-font-size-2xl', 'var(--type-heading-1-size)'],
		['--ab-font-weight-regular', 'var(--type-reading-body-weight)'],
		['--ab-font-weight-medium', 'var(--type-ui-control-weight)'],
		['--ab-font-weight-semibold', 'var(--type-heading-3-weight)'],
		['--ab-font-weight-bold', 'var(--type-heading-1-weight)'],
		['--ab-line-height-tight', 'var(--type-heading-1-line-height)'],
		['--ab-line-height-normal', 'var(--type-ui-label-line-height)'],
		['--ab-line-height-relaxed', 'var(--type-reading-body-line-height)'],
		['--ab-letter-spacing-tight', 'var(--type-heading-1-tracking)'],
		['--ab-letter-spacing-normal', 'var(--type-reading-body-tracking)'],
		['--ab-letter-spacing-wide', 'var(--type-ui-caption-tracking)'],
		['--ab-letter-spacing-caps', 'var(--type-ui-badge-tracking)'],
	];

	for (const [name, expected] of ALIAS_EXPECTATIONS) {
		it(`${name} -> ${expected}`, () => {
			expect(aliasValueFor(name)).toBe(expected);
		});
	}

	it('every apps/study/src typography atom alias resolves to a --type-* role token', () => {
		if (!existsSync(STUDY_SRC)) return;
		const pattern = '--ab-(font-size|font-weight|line-height|letter-spacing)-[a-z0-9-]+';
		const res = spawnSync('rg', ['-oNI', pattern, STUDY_SRC], { encoding: 'utf8' });
		const names = Array.from(new Set(res.stdout.split('\n').filter(Boolean))).sort();
		const lookup = new Map(LEGACY_ALIAS_MAP.map(([n, v]) => [n, v]));
		const offenders: string[] = [];
		for (const legacy of names) {
			const value = lookup.get(legacy);
			if (value === undefined || !value.startsWith('var(--type-')) {
				offenders.push(`${legacy} -> ${value ?? '(missing)'}`);
			}
		}
		expect(offenders, `legacy typography aliases not bound to --type-* roles: ${offenders.join('; ')}`).toEqual([]);
	});
});

describe('emit determinism', () => {
	it('two runs produce byte-identical output', () => {
		const a = emitAllThemes();
		const b = emitAllThemes();
		expect(a).toBe(b);
	});

	it('omits --font-family-display when no pack declares one', () => {
		const themes: TypographyPack[] = [AIRBOSS_STANDARD_PACK, AIRBOSS_COMPACT_PACK];
		for (const pack of themes) {
			expect(pack.families.display).toBeUndefined();
		}
		expect(emitAllThemes()).not.toContain('--font-family-display:');
	});

	// Keep `TypeBundle` import tied to a runtime reference so the test file
	// stays meaningful if someone deletes the type re-export.
	it('typebundle size is a string (unit-bearing)', () => {
		const probe: TypeBundle = AIRBOSS_STANDARD_PACK.bundles.reading.body;
		expect(typeof probe.size).toBe('string');
	});
});
