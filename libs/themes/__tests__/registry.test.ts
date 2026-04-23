import { afterEach, describe, expect, it } from 'vitest';
import type { Theme } from '../contract';
import { __resetRegistry, getTheme, getThemeSafe, isValidThemeId, listThemes, registerTheme } from '../registry';

function stubTheme(id: string): Theme {
	return {
		id,
		name: id,
		description: 'test stub',
		appearances: ['light'],
		defaultAppearance: 'light',
		layouts: { reading: '' },
		defaultLayout: 'reading',
		palette: {},
	};
}

afterEach(() => {
	__resetRegistry();
});

describe('registerTheme', () => {
	it('registers a theme by id', () => {
		registerTheme(stubTheme('test/one'));
		expect(isValidThemeId('test/one')).toBe(true);
	});

	it('throws on duplicate ids', () => {
		registerTheme(stubTheme('test/dupe'));
		expect(() => registerTheme(stubTheme('test/dupe'))).toThrow(/Duplicate theme id/);
	});
});

describe('getTheme', () => {
	it('returns the registered theme', () => {
		registerTheme(stubTheme('test/get'));
		expect(getTheme('test/get').id).toBe('test/get');
	});

	it('throws on unknown ids', () => {
		expect(() => getTheme('test/missing')).toThrow(/Unknown theme: test\/missing/);
	});
});

describe('getThemeSafe', () => {
	it('returns undefined on unknown ids', () => {
		expect(getThemeSafe('test/missing')).toBeUndefined();
	});

	it('returns the registered theme when it exists', () => {
		registerTheme(stubTheme('test/safe'));
		expect(getThemeSafe('test/safe')?.id).toBe('test/safe');
	});
});

describe('isValidThemeId', () => {
	it('is a type predicate -- returns false for unknown ids', () => {
		expect(isValidThemeId('test/missing')).toBe(false);
	});

	it('returns true for registered ids', () => {
		registerTheme(stubTheme('test/pred'));
		expect(isValidThemeId('test/pred')).toBe(true);
	});
});

describe('listThemes', () => {
	it('returns every registered theme', () => {
		registerTheme(stubTheme('test/a'));
		registerTheme(stubTheme('test/b'));
		expect(
			listThemes()
				.map((t) => t.id)
				.sort(),
		).toEqual(['test/a', 'test/b']);
	});
});
