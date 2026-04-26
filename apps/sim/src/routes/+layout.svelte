<script lang="ts">
import '@ab/themes/generated/tokens.css';
import { ROUTES, SIM_STORAGE_KEYS } from '@ab/constants';
import {
	type AppearanceMode,
	DEFAULT_APPEARANCE,
	DEFAULT_THEME_PREFERENCE,
	resolveThemeSelection,
	type ThemeId,
	type ThemePreference,
} from '@ab/themes';
import ThemePicker from '@ab/themes/picker/ThemePicker.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
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

let themePref = $state<ThemePreference>(DEFAULT_THEME_PREFERENCE);
let systemAppearance = $state<AppearanceMode>(DEFAULT_APPEARANCE);

$effect(() => {
	themePref = data.theme;
});

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
		userAppearance: data.appearance,
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
	themePref = value;
	try {
		await fetch(ROUTES.THEME, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ value }),
		});
	} catch {
		// Non-fatal: cookie just won't persist. The data-theme attribute
		// has already flipped via the $effect above.
	}
}
</script>

<header class="sim-chrome">
	<span class="brand">airboss / sim</span>
	<ThemePicker currentThemeId={selection.theme} onSelect={setTheme} locked={themePickerLocked} />
</header>

{#if showAuthBanner}
	<div class="auth-banner-strip" data-testid="sim-auth-banner">
		<Banner tone="info" dismissible onDismiss={dismissAuthBanner}>
			<a class="auth-banner-link" href={data.studyLoginUrl}>Sign in via study</a> to record your flights.
			Without an account, runs play but aren't saved.
		</Banner>
	</div>
{/if}

{@render children()}

<style>
	.sim-chrome {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg);
		padding: var(--space-sm) var(--space-xl);
		border-bottom: 1px solid var(--edge-default);
		background: var(--surface-panel);
	}

	.brand {
		font-weight: var(--type-ui-control-weight);
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		letter-spacing: var(--letter-spacing-wide);
	}

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
