import { beforeEach, describe, expect, it } from 'vitest';
import type { ControlSlots, ControlTokens, Theme, TypeBundle } from '../contract';
import {
	__resetRegistryForTests,
	getTheme,
	getThemeSafe,
	isValidThemeId,
	listThemes,
	registerTheme,
} from '../registry';

function makeBundle(): TypeBundle {
	return { family: 'base', size: '1rem', weight: 400, lineHeight: 1.5, tracking: '0' };
}

function makeSlots(): ControlSlots {
	return {
		bg: 'transparent',
		ink: 'currentColor',
		border: 'transparent',
		hoverBg: 'transparent',
		hoverInk: 'currentColor',
		activeBg: 'transparent',
		disabledBg: 'transparent',
		disabledInk: 'currentColor',
		ring: 'transparent',
	};
}

function makeControl(): ControlTokens {
	return {
		button: {
			default: makeSlots(),
			primary: makeSlots(),
			hazard: makeSlots(),
			neutral: makeSlots(),
			ghost: makeSlots(),
		},
		input: { default: makeSlots(), error: makeSlots() },
	};
}

function makeTheme(id: string): Theme {
	return {
		id,
		name: id,
		description: '',
		appearances: ['light'],
		defaultAppearance: 'light',
		layouts: { reading: '' },
		defaultLayout: 'reading',
		palette: {},
		typography: {
			packId: 'none',
			families: { sans: 'sans-serif', mono: 'monospace', base: 'sans-serif' },
			bundles: {
				reading: { body: makeBundle(), lead: makeBundle(), caption: makeBundle(), quote: makeBundle() },
				heading: {
					1: makeBundle(),
					2: makeBundle(),
					3: makeBundle(),
					4: makeBundle(),
					5: makeBundle(),
					6: makeBundle(),
				},
				ui: { control: makeBundle(), label: makeBundle(), caption: makeBundle(), badge: makeBundle() },
				code: { inline: makeBundle(), block: makeBundle() },
				definition: { term: makeBundle(), body: makeBundle() },
			},
		},
		chrome: {
			space: { '2xs': '0', xs: '0', sm: '0', md: '0', lg: '0', xl: '0', '2xl': '0' },
			radius: { sharp: '0', xs: '0', sm: '0', md: '0', lg: '0', pill: '0' },
			shadow: { none: 'none', sm: 'none', md: 'none', lg: 'none' },
			motion: { fast: '0ms', normal: '0ms', slow: '0ms' },
			layout: {
				containerMax: '0',
				containerPadding: '0',
				gridGap: '0',
				panelPadding: '0',
				panelGap: '0',
				panelHeaderSize: '0',
				panelHeaderWeight: '0',
				panelHeaderTransform: 'none',
				panelHeaderTracking: '0',
				panelHeaderFamily: 'sans-serif',
			},
		},
		control: makeControl(),
	};
}

describe('registry', () => {
	beforeEach(() => {
		__resetRegistryForTests();
	});

	it('round-trips a registered theme', () => {
		const theme = makeTheme('a/x');
		registerTheme(theme);
		expect(getTheme('a/x')).toBe(theme);
	});

	it('throws on duplicate id', () => {
		registerTheme(makeTheme('a/x'));
		expect(() => registerTheme(makeTheme('a/x'))).toThrow(/Duplicate theme id/);
	});

	it('throws on unknown id via getTheme', () => {
		expect(() => getTheme('missing')).toThrow(/Unknown theme/);
	});

	it('returns undefined on unknown id via getThemeSafe', () => {
		expect(getThemeSafe('missing')).toBeUndefined();
	});

	it('isValidThemeId is a correct predicate', () => {
		registerTheme(makeTheme('a/x'));
		expect(isValidThemeId('a/x')).toBe(true);
		expect(isValidThemeId('missing')).toBe(false);
	});

	it('listThemes returns every registered theme', () => {
		registerTheme(makeTheme('a/x'));
		registerTheme(makeTheme('b/y'));
		expect(listThemes()).toHaveLength(2);
	});
});
