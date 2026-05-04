<script lang="ts">
import '@ab/themes/generated/tokens.css';
import { ROUTES } from '@ab/constants';
import HelpSearch from '@ab/help/ui/HelpSearch.svelte';
import {
	type AppearanceMode,
	type AppearancePreference,
	DEFAULT_APPEARANCE,
	DEFAULT_APPEARANCE_PREFERENCE,
	DEFAULT_THEME_PREFERENCE,
	resolveThemeSelection,
	type ThemeId,
	type ThemePreference,
} from '@ab/themes';
import ThemePicker from '@ab/themes/picker/ThemePicker.svelte';
import AppHeader from '@ab/ui/components/AppHeader.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import '$lib/help/register';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

// Optimistic-override pattern mirrors sim/avionics: the derived prefs flip
// immediately on user interaction so the UI doesn't wait on the cookie
// round-trip. Replaces the previous "no theme picker on flightbag" gap --
// the picker now lives inside the AppHeader account dropdown so it's
// available on every surface.
let themeOverride = $state<ThemeId | null>(null);
let appearanceOverride = $state<AppearancePreference | null>(null);
const themePref = $derived<ThemePreference>(themeOverride ?? data.theme ?? DEFAULT_THEME_PREFERENCE);
const appearancePref = $derived<AppearancePreference>(
	appearanceOverride ?? data.appearance ?? DEFAULT_APPEARANCE_PREFERENCE,
);
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

const themePickerLocked = $derived(themePref != null && selection.theme !== themePref);

async function setTheme(value: ThemeId) {
	if (value === themePref) return;
	themeOverride = value;
	try {
		await fetch(ROUTES.THEME, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ value }),
		});
	} catch {
		// Non-fatal: cookie just won't persist. The data-theme attribute
		// has already flipped via the $derived above.
	}
}

async function setAppearance(value: AppearancePreference) {
	if (value === appearancePref) return;
	appearanceOverride = value;
	try {
		await fetch(ROUTES.APPEARANCE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ value }),
		});
	} catch {
		// Non-fatal: the cookie just won't persist this turn.
	}
}
</script>

<!--
	Skip-to-content stays at the layout root (not in AppHeader) so it
	is the first focusable element on the page -- a keyboard user
	reaches it on the very first Tab press, before the brand link.
-->
<a class="skip" href="#main">Skip to main content</a>

<AppHeader
	app="flightbag"
	brandHref={ROUTES.FLIGHTBAG_HOME}
	helpHref={ROUTES.HELP}
	user={data.user}
	signInHref={data.signInUrl}
	appearance={appearancePref}
	onAppearanceChange={setAppearance}
>
	{#snippet helpSearch()}
		<HelpSearch />
	{/snippet}
	{#snippet themePicker()}
		<ThemePicker currentThemeId={selection.theme} onSelect={setTheme} locked={themePickerLocked} />
	{/snippet}
</AppHeader>

<main id="main" tabindex="-1" class="page">
	{@render children()}
</main>

<style>
	.skip {
		position: absolute;
		top: calc(var(--space-2xl) * -1);
		left: var(--space-sm);
		background: var(--ink-body);
		color: var(--ink-inverse);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-sm);
		z-index: var(--z-modal);
	}

	.skip:focus {
		top: var(--space-sm);
	}

	.page {
		padding: var(--space-xl);
	}

	main:focus {
		outline: none;
	}
</style>
