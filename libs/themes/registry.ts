/**
 * Central theme registry.
 *
 * Every theme's `index.ts` calls `registerTheme(...)` at module-eval
 * time. The emit pipeline walks `listThemes()` and produces one
 * selector block per (theme, appearance) pair.
 *
 * Safe getters mirror the runtime/type-predicate split: `getTheme`
 * throws (use in server code that expects a valid id); `getThemeSafe`
 * returns `undefined` (use in resolvers that fall back to default);
 * `isValidThemeId` is the type predicate for user input.
 */

import type { Theme, ThemeId } from './contract';

const themes = new Map<ThemeId, Theme>();

export function registerTheme(theme: Theme): void {
	if (themes.has(theme.id)) {
		throw new Error(`Duplicate theme id: ${theme.id}`);
	}
	themes.set(theme.id, theme);
}

export function getTheme(id: ThemeId): Theme {
	const theme = themes.get(id);
	if (!theme) {
		const known = [...themes.keys()].join(', ') || '(none)';
		throw new Error(`Unknown theme: ${id}. Registered: ${known}`);
	}
	return theme;
}

export function getThemeSafe(id: string): Theme | undefined {
	return themes.get(id as ThemeId);
}

export function isValidThemeId(id: string): id is ThemeId {
	return themes.has(id as ThemeId);
}

export function listThemes(): Theme[] {
	return [...themes.values()];
}

/** Test hook -- do not use in app code. */
export function __resetRegistryForTests(): void {
	themes.clear();
}
