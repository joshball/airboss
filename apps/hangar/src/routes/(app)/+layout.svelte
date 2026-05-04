<script lang="ts">
import { ROUTES } from '@ab/constants';
import HelpSearch from '@ab/help/ui/HelpSearch.svelte';
import {
	type AppearanceMode,
	type AppearancePreference,
	DEFAULT_APPEARANCE,
	DEFAULT_THEME_PREFERENCE,
	resolveThemeSelection,
	type ThemeId,
	type ThemePreference,
} from '@ab/themes';
import ThemePicker from '@ab/themes/picker/ThemePicker.svelte';
import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
import AppHeader from '@ab/ui/components/AppHeader.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import Nav from '$lib/components/Nav.svelte';
// Module-eval side-effect: register hangar-app help pages on first import.
// Required so `<PageHelp pageId="audit">` and the help-id validator both
// see the same set of authored pages.
import '$lib/help/register';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

// `$derived` over (optimistic-user-override | server-data) so theme picks
// flip immediately while the cookie catches up. Replaces the previous
// `$effect` mirror anti-pattern.
let themeOverride = $state<ThemeId | null>(null);
const appearancePref = $derived(data.appearance);
const themePref = $derived<ThemePreference>(themeOverride ?? data.theme ?? DEFAULT_THEME_PREFERENCE);
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

// Hangar has no theme-locked routes today, so the resolver effectively
// always returns the user's pick (or `airboss/default` when nothing is
// set). Wired through `resolveThemeSelection` for future-proofing -- if
// hangar ever grows a route that hard-requires a fixed theme (e.g. a
// preview pane that shows another app's theme), the lock works without
// editing layouts.
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
	// Optimistic override: derived `themePref` flips immediately so the
	// picker UI reflects the new pick without waiting for the round-trip.
	themeOverride = value;
	try {
		await fetch(ROUTES.THEME, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ value }),
		});
	} catch {
		// Non-fatal: cookie just won't persist this turn.
	}
}

async function setAppearance(value: AppearancePreference) {
	if (value === appearancePref) return;
	try {
		await fetch(ROUTES.APPEARANCE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ value }),
		});
		// Optimistically reflect the new appearance before the next
		// navigation re-hydrates the cookie-derived data. The root
		// +layout.svelte's $effect mirrors data.appearance -> the
		// <html data-appearance> attribute.
		if (typeof document !== 'undefined') {
			if (value !== 'system') {
				document.documentElement.setAttribute('data-appearance', value);
			} else if (typeof window !== 'undefined' && window.matchMedia) {
				document.documentElement.setAttribute(
					'data-appearance',
					window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
				);
			}
		}
	} catch {
		// Non-fatal: the cookie just doesn't persist this turn.
	}
}
</script>

<!--
	Skip-to-content stays at the layout root (not in AppHeader) so it
	is the first focusable element on the page.
-->
<a class="skip" href="#main">Skip to main content</a>

<ThemeProvider theme={selection.theme} appearance={selection.appearance} layout={selection.layout}>
	<AppHeader
		app="hangar"
		brandHref={ROUTES.HANGAR_HOME}
		flightbagHref={data.flightbagOrigin}
		helpHref={ROUTES.HELP}
		user={data.user}
		appearance={appearancePref}
		onAppearanceChange={setAppearance}
	>
		{#snippet nav()}
			<Nav />
		{/snippet}
		{#snippet helpSearch()}
			<HelpSearch />
		{/snippet}
		{#snippet themePicker()}
			<ThemePicker currentThemeId={selection.theme} onSelect={setTheme} locked={themePickerLocked} />
		{/snippet}
	</AppHeader>

	<main id="main" tabindex="-1">
		{@render children()}
	</main>
</ThemeProvider>

<style>
	:global(body) {
		min-height: 100dvh;
	}

	:global(#app) {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

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

	main {
		flex: 1 1 auto;
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		padding: var(--layout-container-padding);
		max-width: var(--layout-container-max);
		margin: 0 auto;
		background: var(--surface-page);
	}

	main:focus {
		outline: none;
	}
</style>
