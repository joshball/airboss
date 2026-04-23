/**
 * Theme registry.
 *
 * Each theme's `index.ts` calls `registerTheme({...})` at module-evaluation
 * time. `emit.ts` walks the registry to produce the CSS bundle. Consumers
 * use `getTheme`/`getThemeSafe`/`isValidThemeId` to resolve a theme id from
 * URL or user preference.
 *
 * Duplicate ids throw -- a theme registering the same id twice is almost
 * always an accidental re-import and silently winning would hide the bug.
 */

import type { Theme, ThemeId } from './contract';

const themes = new Map<ThemeId, Theme>();

export function registerTheme(theme: Theme): void {
	if (themes.has(theme.id)) {
		throw new Error(
			`Duplicate theme id: ${theme.id}. ` +
				`Each theme's index.ts should call registerTheme exactly once per process.`,
		);
	}
	themes.set(theme.id, theme);
}

export function getTheme(id: ThemeId): Theme {
	const t = themes.get(id);
	if (!t) {
		const known = [...themes.keys()].sort();
		throw new Error(`Unknown theme: ${id}. Registered: ${known.length ? known.join(', ') : '<none>'}`);
	}
	return t;
}

export function getThemeSafe(id: string): Theme | undefined {
	return themes.get(id as ThemeId);
}

export function isValidThemeId(id: string): id is ThemeId {
	return themes.has(id as ThemeId);
}

export function listThemes(): readonly Theme[] {
	return [...themes.values()];
}

/**
 * Test-only: drop every registered theme. Never call this in app code;
 * the registry is a process-global and unregistering a theme would leave
 * consumers that already captured a reference holding stale state.
 */
export function __resetRegistry(): void {
	themes.clear();
}
