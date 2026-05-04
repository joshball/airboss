<script lang="ts">
import '@ab/themes/generated/tokens.css';
import { ROUTES, SIM_STORAGE_KEYS } from '@ab/constants';
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
import Banner from '@ab/ui/components/Banner.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import '$lib/help/register';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

// Auth banner: server-renders when the visitor is unauthenticated, so
// there's no client-side flash. Dismissal is sessionStorage-scoped --
// the banner reappears next session start (e.g. fresh tab) so the
// silent-no-record state stays legible.
let authBannerDismissed = $state(false);

$effect(() => {
	if (typeof window === 'undefined') return;
	try {
		authBannerDismissed = window.sessionStorage.getItem(SIM_STORAGE_KEYS.AUTH_BANNER_DISMISSED) === '1';
	} catch {
		// Private mode / storage disabled: leave the banner visible.
	}
});

const showAuthBanner = $derived(!data.isAuthenticated && !authBannerDismissed);

function dismissAuthBanner() {
	authBannerDismissed = true;
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.setItem(SIM_STORAGE_KEYS.AUTH_BANNER_DISMISSED, '1');
	} catch {
		// Non-fatal: dismissal just won't persist within the session.
	}
}

// `$derived` over (optimistic-user-override | server-data) so theme picks
// flip immediately while the cookie catches up. Replaces the previous
// `$effect` mirror anti-pattern.
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

// `resolveThemeSelection` enforces the route safety lock for /sim/* and
// the sim/glass forced-dark rule. The locked picker variant tells the
// user why their pick isn't taking effect on this route.
const selection = $derived(
	resolveThemeSelection({
		pathname: page.url.pathname,
		userTheme: themePref,
		userAppearance: appearancePref,
		systemAppearance,
	}),
);

// Reflect the effective theme on <html> so the chrome around <main>
// follows the user's pick, and so navigation between locked and free
// routes flips the attribute without waiting for a reload.
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
		// Non-fatal: cookie just won't persist. The data-theme attribute
		// has already flipped via the $derived above.
	}
}

async function setAppearance(value: AppearancePreference) {
	if (value === appearancePref) return;
	// Optimistic override mirrors the study layout pattern -- the derived
	// `appearancePref` flips before the round-trip lands so the user sees
	// the change immediately.
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

<AppHeader
	app="sim"
	flightbagHref={data.flightbagOrigin}
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

{#if showAuthBanner}
	<div class="auth-banner-strip" data-testid="sim-auth-banner">
		<Banner tone="info" dismissible onDismiss={dismissAuthBanner}>
			<a class="auth-banner-link" href={data.signInUrl}>Sign in via study</a> to record your flights.
			Without an account, runs play but aren't saved.
		</Banner>
	</div>
{/if}

{@render children()}

<style>
	.auth-banner-strip {
		padding: var(--space-xs) var(--space-xl);
		border-bottom: 1px solid var(--edge-default);
		background: var(--surface-panel);
	}

	.auth-banner-link {
		color: inherit;
		font-weight: var(--font-weight-semibold);
		text-decoration: underline;
	}

	.auth-banner-link:hover,
	.auth-banner-link:focus-visible {
		text-decoration: none;
	}
</style>
