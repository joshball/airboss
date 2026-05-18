<script lang="ts">
import '@ab/themes/generated/tokens.css';
import {
	type AppearanceMode,
	type AppearancePreference,
	DEFAULT_APPEARANCE,
	DEFAULT_APPEARANCE_PREFERENCE,
	DEFAULT_THEME_PREFERENCE,
	resolveThemeSelection,
	type ThemePreference,
} from '@ab/themes';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

const themePref = $derived<ThemePreference>(data.theme ?? DEFAULT_THEME_PREFERENCE);
const appearancePref = $derived<AppearancePreference>(data.appearance ?? DEFAULT_APPEARANCE_PREFERENCE);
let systemAppearance = $state<AppearanceMode>(DEFAULT_APPEARANCE);

$effect(() => {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	systemAppearance = mq.matches ? 'dark' : 'light';
	const handler = (e: MediaQueryListEvent) => {
		systemAppearance = e.matches ? 'dark' : 'light';
	};
	mq.addEventListener('change', handler);
	return () => mq.removeEventListener('change', handler);
});

const selection = $derived(
	resolveThemeSelection({
		pathname: page.url.pathname,
		userTheme: themePref,
		userAppearance: appearancePref,
		systemAppearance,
	}),
);

$effect(() => {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', selection.theme);
	document.documentElement.setAttribute('data-appearance', selection.appearance);
	document.documentElement.setAttribute('data-layout', selection.layout);
});
</script>

<div class="spatial-shell">
	{@render children()}
</div>

<style>
	.spatial-shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--surface-page);
		color: var(--ink-body);
	}
</style>
