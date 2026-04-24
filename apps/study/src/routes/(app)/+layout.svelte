<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import HelpSearch from '@ab/help/ui/HelpSearch.svelte';
import {
	APPEARANCE_PREFERENCE_VALUES,
	type AppearanceMode,
	type AppearancePreference,
	DEFAULT_APPEARANCE,
	DEFAULT_APPEARANCE_PREFERENCE,
	resolveThemeForPath,
} from '@ab/themes';
import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import '$lib/help/register';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

// Appearance preference + live system-appearance tracking.
// `data.appearance` is the server-side cookie read; `systemAppearance`
// mirrors `prefers-color-scheme` and updates when the OS changes.
// Seeded from DEFAULT_APPEARANCE_PREFERENCE and populated via $effect so
// Svelte's state-referenced-locally check stays clean; the effect re-syncs
// on every navigation that changes the cookie.
let appearancePref = $state<AppearancePreference>(DEFAULT_APPEARANCE_PREFERENCE);
let systemAppearance = $state<AppearanceMode>(DEFAULT_APPEARANCE);

$effect(() => {
	appearancePref = data.appearance;
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

// Reflect the effective appearance on <html> pre-provider so the nav,
// <body>, and the skip link (all outside ThemeProvider) follow the
// user's choice. Avoids a flash of old appearance when toggling.
$effect(() => {
	if (typeof document === 'undefined') return;
	const effective: AppearanceMode = appearancePref === 'system' ? systemAppearance : appearancePref;
	document.documentElement.setAttribute('data-appearance', effective);
});

async function setAppearance(value: AppearancePreference) {
	if (value === appearancePref) return;
	appearancePref = value;
	try {
		await fetch(ROUTES.APPEARANCE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ value }),
		});
	} catch {
		// Non-fatal: the cookie just won't persist. The in-page attribute
		// has already flipped, so the user sees the change immediately.
	}
}

const dashboardActive = $derived(page.url.pathname === ROUTES.DASHBOARD);
const memoryActive = $derived(page.url.pathname.startsWith(ROUTES.MEMORY));
const memoryHomeActive = $derived(page.url.pathname === ROUTES.MEMORY);
const memoryBrowseActive = $derived(page.url.pathname.startsWith(ROUTES.MEMORY_BROWSE));
const memoryReviewActive = $derived(page.url.pathname.startsWith(ROUTES.MEMORY_REVIEW));
const memoryNewActive = $derived(page.url.pathname.startsWith(ROUTES.MEMORY_NEW));
const repsActive = $derived(page.url.pathname.startsWith(ROUTES.REPS));
const knowledgeActive = $derived(page.url.pathname.startsWith(ROUTES.KNOWLEDGE));
const glossaryActive = $derived(page.url.pathname.startsWith(ROUTES.GLOSSARY));
const helpActive = $derived(page.url.pathname.startsWith(ROUTES.HELP));
const helpConceptsActive = $derived(page.url.pathname.startsWith(ROUTES.HELP_CONCEPTS));
const helpIndexActive = $derived(helpActive && !helpConceptsActive);
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

// Route-driven theme. `resolveThemeForPath` returns study/flightdeck for
// /dashboard and study/sectional everywhere else. The provider wraps
// *only* <main> so the nav keeps the outer chrome theme while the
// content area switches to flightdeck on dashboard routes.
const selection = $derived(resolveThemeForPath(page.url.pathname, appearancePref, systemAppearance));

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
let helpMenu = $state<HTMLDetailsElement | null>(null);
let memoryMenu = $state<HTMLDetailsElement | null>(null);

function closeDetails(target: HTMLDetailsElement | null) {
	if (!target?.open) return;
	target.open = false;
	const summary = target.querySelector('summary');
	if (summary instanceof HTMLElement) summary.focus();
}

function handleMenuKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape') return;
	if (menu?.open) {
		closeDetails(menu);
		return;
	}
	if (memoryMenu?.open) {
		closeDetails(memoryMenu);
		return;
	}
	if (helpMenu?.open) {
		closeDetails(helpMenu);
	}
}

function handleHelpMenuBlur(event: FocusEvent) {
	if (!helpMenu) return;
	const next = event.relatedTarget;
	if (next instanceof Node && helpMenu.contains(next)) return;
	helpMenu.open = false;
}

function handleHelpItemClick() {
	if (helpMenu) helpMenu.open = false;
}

function handleMemoryMenuBlur(event: FocusEvent) {
	if (!memoryMenu) return;
	const next = event.relatedTarget;
	if (next instanceof Node && memoryMenu.contains(next)) return;
	memoryMenu.open = false;
}

function handleMemoryItemClick() {
	if (memoryMenu) memoryMenu.open = false;
}
</script>

<svelte:window onkeydown={handleMenuKeydown} />

<a class="skip" href="#main">Skip to main content</a>

<nav aria-label="Primary">
	<div class="nav-sections">
		<a href={ROUTES.DASHBOARD} aria-current={dashboardActive ? 'page' : undefined}>{NAV_LABELS.DASHBOARD}</a>
		<a href={ROUTES.PLANS} aria-current={plansActive ? 'page' : undefined}>{NAV_LABELS.PLANS}</a>
		<details class="nav-menu" bind:this={memoryMenu} onfocusout={handleMemoryMenuBlur}>
			<summary aria-haspopup="menu" aria-current={memoryActive ? 'page' : undefined}>
				<span>{NAV_LABELS.MEMORY}</span>
				<span class="chevron" aria-hidden="true">▾</span>
			</summary>
			<div class="nav-menu-panel" role="menu" aria-label="Memory sections">
				<a
					href={ROUTES.MEMORY}
					role="menuitem"
					aria-current={memoryHomeActive ? 'page' : undefined}
					onclick={handleMemoryItemClick}>{NAV_LABELS.MEMORY_HOME}</a
				>
				<a
					href={ROUTES.MEMORY_BROWSE}
					role="menuitem"
					aria-current={memoryBrowseActive ? 'page' : undefined}
					onclick={handleMemoryItemClick}>{NAV_LABELS.MEMORY_BROWSE}</a
				>
				<a
					href={ROUTES.MEMORY_REVIEW}
					role="menuitem"
					aria-current={memoryReviewActive ? 'page' : undefined}
					onclick={handleMemoryItemClick}>{NAV_LABELS.MEMORY_REVIEW}</a
				>
				<a
					href={ROUTES.MEMORY_NEW}
					role="menuitem"
					aria-current={memoryNewActive ? 'page' : undefined}
					onclick={handleMemoryItemClick}>{NAV_LABELS.MEMORY_NEW}</a
				>
			</div>
		</details>
		<a href={ROUTES.REPS} aria-current={repsActive ? 'page' : undefined}>{NAV_LABELS.REPS}</a>
		<a href={ROUTES.KNOWLEDGE} aria-current={knowledgeActive ? 'page' : undefined}>{NAV_LABELS.KNOWLEDGE}</a>
		<a href={ROUTES.GLOSSARY} aria-current={glossaryActive ? 'page' : undefined}>{NAV_LABELS.GLOSSARY}</a>
		<a href={ROUTES.CALIBRATION} aria-current={calibrationActive ? 'page' : undefined}>{NAV_LABELS.CALIBRATION}</a>
		<details class="nav-menu" bind:this={helpMenu} onfocusout={handleHelpMenuBlur}>
			<summary aria-haspopup="menu" aria-current={helpActive ? 'page' : undefined}>
				<span>{NAV_LABELS.HELP}</span>
				<span class="chevron" aria-hidden="true">▾</span>
			</summary>
			<div class="nav-menu-panel" role="menu" aria-label="Help sections">
				<a
					href={ROUTES.HELP}
					role="menuitem"
					aria-current={helpIndexActive ? 'page' : undefined}
					onclick={handleHelpItemClick}>{NAV_LABELS.HELP_INDEX}</a
				>
				<a
					href={ROUTES.HELP_CONCEPTS}
					role="menuitem"
					aria-current={helpConceptsActive ? 'page' : undefined}
					onclick={handleHelpItemClick}>{NAV_LABELS.HELP_CONCEPTS}</a
				>
			</div>
		</details>
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
			<fieldset class="identity-appearance">
				<legend>Appearance</legend>
				{#each APPEARANCE_PREFERENCE_VALUES as option (option)}
					<label class="identity-appearance-option">
						<input
							type="radio"
							name="appearance"
							value={option}
							checked={appearancePref === option}
							onchange={() => setAppearance(option)}
						/>
						<span class="identity-appearance-label">{option}</span>
					</label>
				{/each}
			</fieldset>
			<form method="POST" action={ROUTES.LOGOUT} class="identity-signout">
				<button type="submit">Sign out</button>
			</form>
		</div>
	</details>
</nav>

<ThemeProvider theme={selection.theme} appearance={selection.appearance} layout={selection.layout}>
	<main id="main" tabindex="-1" class:full-bleed={fullBleed}>
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
		/*
		 * Skip-to-content is keyboard-focusable layout chrome that must pop
		 * above sticky headers / sidebars when focused. Focus trap in Dialog
		 * prevents reaching this while a modal is open, so MODAL tier is
		 * safe even though numerically it matches the dialog.
		 */
		z-index: var(--z-modal);
	}

	.skip:focus {
		top: var(--space-sm);
	}

	nav {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: var(--space-xl);
		padding: var(--space-lg) var(--space-xl);
		border-bottom: 1px solid var(--edge-default);
		background: var(--surface-panel);
	}

	.nav-sections {
		display: flex;
		gap: var(--space-xl);
		flex-wrap: wrap;
	}

	nav a {
		color: var(--ink-muted);
		text-decoration: none;
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
	}

	nav a:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	nav a[aria-current='page'] {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
	}

	.nav-menu {
		position: relative;
	}

	.nav-menu > summary {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		cursor: pointer;
		list-style: none;
		color: var(--ink-muted);
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		user-select: none;
	}

	.nav-menu > summary::-webkit-details-marker {
		display: none;
	}

	.nav-menu > summary::marker {
		content: '';
	}

	.nav-menu > summary:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.nav-menu > summary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.nav-menu[open] > summary {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.nav-menu > summary[aria-current='page'] {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
	}

	.nav-menu[open] .chevron {
		transform: rotate(180deg);
	}

	.nav-menu .chevron {
		font-size: var(--type-ui-caption-size);
		line-height: 1;
		transition: transform var(--motion-fast);
	}

	.nav-menu-panel {
		position: absolute;
		left: 0;
		top: calc(100% + var(--space-2xs));
		min-width: 12rem;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: var(--space-2xs);
		z-index: var(--z-dropdown);
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.nav-menu-panel a {
		padding: var(--space-sm) var(--space-sm);
		border-radius: var(--radius-sm);
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
		gap: var(--space-2xs);
		cursor: pointer;
		list-style: none;
		color: var(--ink-muted);
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
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
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.identity > summary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.identity[open] > summary {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.identity[open] .chevron {
		transform: rotate(180deg);
	}

	.chevron {
		font-size: var(--type-ui-caption-size);
		line-height: 1;
		transition: transform var(--motion-fast);
	}

	.identity-label-compact {
		display: none;
		font-variant: small-caps;
		letter-spacing: var(--letter-spacing-wide);
	}

	.identity-panel {
		position: absolute;
		right: 0;
		top: calc(100% + var(--space-2xs));
		min-width: 12rem;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: var(--space-2xs);
		z-index: var(--z-dropdown);
	}

	.identity-email {
		padding: var(--space-sm) var(--space-sm);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		border-bottom: 1px solid var(--edge-default);
		margin-bottom: var(--space-2xs);
		overflow-wrap: anywhere;
	}

	.identity-appearance {
		margin: 0;
		padding: var(--space-sm);
		border: 0;
		border-top: 1px solid var(--edge-default);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.identity-appearance legend {
		padding: 0 0 var(--space-2xs);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		font-weight: var(--type-ui-control-weight);
	}

	.identity-appearance-option {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-2xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
	}

	.identity-appearance-option:hover {
		background: var(--surface-sunken);
	}

	.identity-appearance-option input {
		accent-color: var(--action-default);
	}

	.identity-appearance-label {
		text-transform: capitalize;
	}

	.identity-signout {
		margin: 0;
		border-top: 1px solid var(--edge-default);
		padding-top: var(--space-2xs);
	}

	.identity-signout button {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: 0;
		color: var(--ink-muted);
		font: inherit;
		padding: var(--space-sm) var(--space-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.identity-signout button:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.identity-signout button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Narrow viewports: swap the full name/email label for initials so the
	   nav stops wrapping around ~600px. The panel still shows the full
	   identity when opened. */
	@media (max-width: 640px) {
		nav {
			gap: var(--space-md);
			padding: var(--space-md) var(--space-lg);
		}

		.nav-sections {
			gap: var(--space-md);
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
		flex: 1 1 auto;
		width: 100%;
		min-width: 0;
		min-height: 0;
		box-sizing: border-box;
		padding: var(--layout-container-padding);
		max-width: var(--layout-container-max);
		margin: 0 auto;
		background: var(--surface-page);
	}

	main.full-bleed {
		display: flex;
		max-width: none;
		margin: 0;
	}

	main:focus {
		outline: none;
	}
</style>
