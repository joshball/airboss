<script lang="ts">
import { ROUTES } from '@ab/constants';
import HelpSearch from '@ab/help/ui/HelpSearch.svelte';
import { resolveThemeForPath } from '@ab/themes';
import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import '$lib/help/register';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

const dashboardActive = $derived(page.url.pathname === ROUTES.DASHBOARD);
const memoryActive = $derived(page.url.pathname.startsWith(ROUTES.MEMORY));
const repsActive = $derived(page.url.pathname.startsWith(ROUTES.REPS));
const knowledgeActive = $derived(page.url.pathname.startsWith(ROUTES.KNOWLEDGE));
const glossaryActive = $derived(page.url.pathname.startsWith(ROUTES.GLOSSARY));
const helpActive = $derived(page.url.pathname.startsWith(ROUTES.HELP));
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

// Identity anchor. Primary label is the user's name; fall back to email if
// no name is set. The disclosure reveals the email (when it isn't already
// the label) and the Sign out form action.
const identityLabel = $derived(data.user.name.trim() || data.user.email);
const showEmailRow = $derived(identityLabel !== data.user.email);
// Narrow-viewport fallback: two-letter initials or first letter of the email.
// Keeps the nav from wrapping when the name is long or the viewport is tight.
const initials = $derived(computeInitials(data.user.name, data.user.email));

function computeInitials(name: string, email: string): string {
	const trimmed = name.trim();
	if (trimmed) {
		const parts = trimmed.split(/\s+/);
		const first = parts[0]?.[0] ?? '';
		const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
		const combined = `${first}${last}`.toUpperCase();
		if (combined) return combined;
	}
	return (email[0] ?? '?').toUpperCase();
}

let menu = $state<HTMLDetailsElement | null>(null);

function handleMenuKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape' && menu?.open) {
		menu.open = false;
		const summary = menu.querySelector('summary');
		if (summary instanceof HTMLElement) summary.focus();
	}
}
</script>

<svelte:window onkeydown={handleMenuKeydown} />

<ThemeProvider {theme}>
	<a class="skip" href="#main">Skip to main content</a>

	<nav aria-label="Primary">
		<div class="nav-sections">
			<a href={ROUTES.DASHBOARD} aria-current={dashboardActive ? 'page' : undefined}>Dashboard</a>
			<a href={ROUTES.PLANS} aria-current={plansActive ? 'page' : undefined}>Plans</a>
			<a href={ROUTES.MEMORY} aria-current={memoryActive ? 'page' : undefined}>Memory</a>
			<a href={ROUTES.REPS} aria-current={repsActive ? 'page' : undefined}>Reps</a>
			<a href={ROUTES.KNOWLEDGE} aria-current={knowledgeActive ? 'page' : undefined}>Knowledge</a>
			<a href={ROUTES.GLOSSARY} aria-current={glossaryActive ? 'page' : undefined}>Glossary</a>
			<a href={ROUTES.CALIBRATION} aria-current={calibrationActive ? 'page' : undefined}>Calibration</a>
			<a href={ROUTES.HELP} aria-current={helpActive ? 'page' : undefined}>Help</a>
		</div>

		<div class="nav-search">
			<HelpSearch />
		</div>

		<details class="identity" bind:this={menu}>
			<summary aria-label="Account menu for {identityLabel}">
				<span class="identity-label-full">{identityLabel}</span>
				<span class="identity-label-compact" aria-hidden="true">{initials}</span>
				<span class="chevron" aria-hidden="true">▾</span>
			</summary>
			<div class="identity-panel">
				{#if showEmailRow}
					<div class="identity-email">{data.user.email}</div>
				{/if}
				<form method="POST" action={ROUTES.LOGOUT} class="identity-signout">
					<button type="submit">Sign out</button>
				</form>
			</div>
		</details>
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
		align-items: center;
		gap: var(--ab-space-xl);
		padding: var(--ab-space-lg) var(--ab-space-xl);
		border-bottom: 1px solid var(--ab-color-border);
		background: var(--ab-color-surface);
	}

	.nav-sections {
		display: flex;
		gap: var(--ab-space-xl);
		flex-wrap: wrap;
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

	.nav-search {
		margin-left: auto;
		display: flex;
		align-items: center;
	}

	.identity {
		position: relative;
	}

	.identity > summary {
		display: inline-flex;
		align-items: center;
		gap: var(--ab-space-2xs);
		cursor: pointer;
		list-style: none;
		color: var(--ab-color-fg-muted);
		font-weight: var(--ab-font-weight-medium);
		padding: var(--ab-space-2xs) var(--ab-space-sm);
		border-radius: var(--ab-radius-sm);
		user-select: none;
	}

	/* Remove the default marker across browsers. */
	.identity > summary::-webkit-details-marker {
		display: none;
	}
	.identity > summary::marker {
		content: '';
	}

	.identity > summary:hover {
		color: var(--ab-color-fg);
		background: var(--ab-color-surface-sunken);
	}

	.identity > summary:focus-visible {
		outline: 2px solid var(--ab-color-focus-ring);
		outline-offset: 2px;
	}

	.identity[open] > summary {
		color: var(--ab-color-fg);
		background: var(--ab-color-surface-sunken);
	}

	.identity[open] .chevron {
		transform: rotate(180deg);
	}

	.chevron {
		font-size: var(--ab-font-size-xs);
		line-height: 1;
		transition: transform var(--ab-transition-fast);
	}

	.identity-label-compact {
		display: none;
		font-variant: small-caps;
		letter-spacing: 0.02em;
	}

	.identity-panel {
		position: absolute;
		right: 0;
		top: calc(100% + var(--ab-space-2xs));
		min-width: 12rem;
		background: var(--ab-color-surface);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		box-shadow: var(--ab-shadow-lg);
		padding: var(--ab-space-2xs);
		z-index: 50;
	}

	.identity-email {
		padding: var(--ab-space-sm) var(--ab-space-sm);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-muted);
		border-bottom: 1px solid var(--ab-color-border);
		margin-bottom: var(--ab-space-2xs);
		overflow-wrap: anywhere;
	}

	.identity-signout {
		margin: 0;
	}

	.identity-signout button {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: 0;
		color: var(--ab-color-fg-muted);
		font: inherit;
		padding: var(--ab-space-sm) var(--ab-space-sm);
		border-radius: var(--ab-radius-sm);
		cursor: pointer;
	}

	.identity-signout button:hover {
		color: var(--ab-color-fg);
		background: var(--ab-color-surface-sunken);
	}

	.identity-signout button:focus-visible {
		outline: 2px solid var(--ab-color-focus-ring);
		outline-offset: 2px;
	}

	/* Narrow viewports: swap the full name/email label for initials so the
	   nav stops wrapping around ~600px. The panel still shows the full
	   identity when opened. */
	@media (max-width: 640px) {
		nav {
			gap: var(--ab-space-md);
			padding: var(--ab-space-md) var(--ab-space-lg);
		}

		.nav-sections {
			gap: var(--ab-space-md);
		}

		.identity-label-full {
			display: none;
		}

		.identity-label-compact {
			display: inline;
		}
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
