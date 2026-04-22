<script lang="ts">
import { ROUTES } from '@ab/constants';
import { resolveThemeForPath } from '@ab/themes';
import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';

let { children }: { children: Snippet } = $props();

const dashboardActive = $derived(page.url.pathname === ROUTES.DASHBOARD);
const memoryActive = $derived(page.url.pathname.startsWith(ROUTES.MEMORY));
const repsActive = $derived(page.url.pathname.startsWith(ROUTES.REPS));
const knowledgeActive = $derived(page.url.pathname.startsWith(ROUTES.KNOWLEDGE));
const calibrationActive = $derived(page.url.pathname.startsWith(ROUTES.CALIBRATION));
// Plans, /session/start and /sessions/* roll under one nav item -- they're
// the same flow from the user's perspective.
const plansActive = $derived(
	page.url.pathname.startsWith(ROUTES.PLANS) ||
		page.url.pathname.startsWith(ROUTES.SESSION_START) ||
		page.url.pathname.startsWith(ROUTES.SESSIONS),
);

// Dashboard renders as a full-bleed TUI grid; every other surface keeps the
// centered reading-column layout.
const fullBleed = $derived(dashboardActive);

// Route-driven theme. `resolveThemeForPath` returns 'tui' for /dashboard
// and 'web' everywhere else. The outer provider wraps the nav + main so
// every component inside picks up the right tokens automatically.
const theme = $derived(resolveThemeForPath(page.url.pathname));
</script>

<ThemeProvider {theme}>
	<a class="skip" href="#main">Skip to main content</a>

	<nav aria-label="Primary">
		<a href={ROUTES.DASHBOARD} aria-current={dashboardActive ? 'page' : undefined}>Dashboard</a>
		<a href={ROUTES.PLANS} aria-current={plansActive ? 'page' : undefined}>Plans</a>
		<a href={ROUTES.MEMORY} aria-current={memoryActive ? 'page' : undefined}>Memory</a>
		<a href={ROUTES.REPS} aria-current={repsActive ? 'page' : undefined}>Reps</a>
		<a href={ROUTES.KNOWLEDGE} aria-current={knowledgeActive ? 'page' : undefined}>Knowledge</a>
		<a href={ROUTES.CALIBRATION} aria-current={calibrationActive ? 'page' : undefined}>Calibration</a>
	</nav>

	<main id="main" tabindex="-1" class:full-bleed={fullBleed}>
		{@render children()}
	</main>
</ThemeProvider>

<style>
	.skip {
		position: absolute;
		top: -3rem;
		left: var(--ab-space-sm);
		background: var(--ab-color-fg);
		color: var(--ab-color-fg-inverse);
		padding: var(--ab-space-sm) var(--ab-space-md);
		border-radius: var(--ab-radius-sm);
		z-index: 100;
	}

	.skip:focus {
		top: var(--ab-space-sm);
	}

	nav {
		display: flex;
		gap: var(--ab-space-xl);
		padding: var(--ab-space-lg) var(--ab-space-xl);
		border-bottom: 1px solid var(--ab-color-border);
		background: var(--ab-color-surface);
	}

	nav a {
		color: var(--ab-color-fg-muted);
		text-decoration: none;
		font-weight: var(--ab-font-weight-medium);
		padding: var(--ab-space-2xs) var(--ab-space-sm);
		border-radius: var(--ab-radius-sm);
	}

	nav a:hover {
		color: var(--ab-color-fg);
		background: var(--ab-color-surface-sunken);
	}

	nav a[aria-current='page'] {
		color: var(--ab-color-primary-hover);
		background: var(--ab-color-primary-subtle);
	}

	/*
	 * `main` defaults to the reading column (`web` theme). When the active
	 * route switches the provider to `tui`, it also flips `.full-bleed` on
	 * so the dashboard grid stretches edge-to-edge. The actual padding +
	 * max-width are driven by layout tokens so either theme can evolve
	 * without editing this file.
	 */
	main {
		padding: var(--ab-layout-container-padding);
		max-width: var(--ab-layout-container-max);
		margin: 0 auto;
		background: var(--ab-color-bg);
	}

	main.full-bleed {
		max-width: none;
		margin: 0;
	}

	main:focus {
		outline: none;
	}
</style>
