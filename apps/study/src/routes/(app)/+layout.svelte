<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import { listGlossaryEntries } from '@ab/help/glossary';
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
import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
import AppHeader from '@ab/ui/components/AppHeader.svelte';
import GlossaryDrawer from '@ab/ui/components/GlossaryDrawer.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import '$lib/help/register';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

// Appearance preference + live system-appearance tracking.
// `data.appearance` is the server-side cookie read; `systemAppearance`
// mirrors `prefers-color-scheme` and updates when the OS changes.
//
// Pattern: `$derived` over (optimistic-user-override | server-data). The
// optimistic override flips immediately when the user clicks (so the page
// updates without waiting for the server) and is cleared when the next
// navigation re-reads the cookie -- at which point data.appearance equals
// the override and the derived value collapses back to the prop. This
// replaces the prior `$effect` that mirrored props into local state, which
// was an anti-pattern in Svelte 5 (props-into-state should be `$derived`,
// not effect-mirrored).
let appearanceOverride = $state<AppearancePreference | null>(null);
let themeOverride = $state<ThemeId | null>(null);
let systemAppearance = $state<AppearanceMode>(DEFAULT_APPEARANCE);

const appearancePref = $derived<AppearancePreference>(
	appearanceOverride ?? data.appearance ?? DEFAULT_APPEARANCE_PREFERENCE,
);
const themePref = $derived<ThemePreference>(themeOverride ?? data.theme ?? DEFAULT_THEME_PREFERENCE);

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

// Reflect the effective theme + appearance on <html> pre-provider so the nav,
// <body>, and the skip link (all outside ThemeProvider) follow the user's
// choice. Avoids a flash of old theme/appearance when toggling.
$effect(() => {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', selection.theme);
	document.documentElement.setAttribute('data-appearance', selection.appearance);
	document.documentElement.setAttribute('data-layout', selection.layout);
});

async function setAppearance(value: AppearancePreference) {
	if (value === appearancePref) return;
	// Optimistic override: the derived `appearancePref` flips immediately so
	// the user sees the change without waiting for the server round-trip.
	appearanceOverride = value;
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
		// has already flipped via the $derived above, so the user sees the
		// change immediately on this page.
	}
}

/**
 * Prefix-aware nav-active check. `pathname.startsWith('/memory')` matches
 * a hypothetical `/memorywall` (false positive); requiring an exact match
 * or a trailing `/` keeps the nav highlight on the right item even when a
 * future route shares a prefix with an existing one.
 */
function pathMatches(current: string, prefix: string): boolean {
	return current === prefix || current.startsWith(`${prefix}/`);
}

const studyActive = $derived(page.url.pathname === ROUTES.STUDY);
const flightActive = $derived(pathMatches(page.url.pathname, ROUTES.FLIGHT));
// `/insights` rolls Stats / Calibration / Lens onto one section
// (study-app-ia-cleanup Phase 3). The nav highlight matches anywhere
// under `/insights/*`.
const insightsActive = $derived(pathMatches(page.url.pathname, ROUTES.INSIGHTS));
const memoryActive = $derived(pathMatches(page.url.pathname, ROUTES.MEMORY));
const memoryHomeActive = $derived(page.url.pathname === ROUTES.MEMORY);
const memoryBrowseActive = $derived(pathMatches(page.url.pathname, ROUTES.MEMORY_BROWSE));
const memoryReviewActive = $derived(pathMatches(page.url.pathname, ROUTES.MEMORY_REVIEW));
const memoryNewActive = $derived(pathMatches(page.url.pathname, ROUTES.MEMORY_NEW));
const repsActive = $derived(pathMatches(page.url.pathname, ROUTES.REPS));
// `/program` rolls Quals + Goal + Plan + Coverage into one tabbed surface.
// The nav highlight is active anywhere under `/program/*`, plus on the
// session entry points (which the Plan tab CTA leads into).
const programActive = $derived(
	pathMatches(page.url.pathname, ROUTES.PROGRAM) ||
		pathMatches(page.url.pathname, ROUTES.SESSION_START) ||
		pathMatches(page.url.pathname, ROUTES.SESSIONS),
);
// `/reference` consolidates the knowledge graph + glossary + library
// link (study-app-ia-cleanup Phase 3). Highlight matches anywhere
// under `/reference/*`.
const referenceActive = $derived(pathMatches(page.url.pathname, ROUTES.REFERENCE));
const helpActive = $derived(pathMatches(page.url.pathname, ROUTES.HELP));
const helpConceptsActive = $derived(pathMatches(page.url.pathname, ROUTES.HELP_CONCEPTS));
const helpIndexActive = $derived(helpActive && !helpConceptsActive);
// The Insights index renders as a full-bleed TUI grid; every other
// surface keeps the centered reading-column layout. The legacy
// `/dashboard` path is handled at the hook layer (301) and never
// reaches client-side rendering, so checking only the new path is
// sufficient.
const fullBleed = $derived(page.url.pathname === ROUTES.INSIGHTS);

// Theme resolution. `resolveThemeSelection` honors the precedence rule
// documented in @ab/themes/resolve.ts: a route safety lock (today only
// /sim/*) wins over the user's picker preference; otherwise the user's
// pick wins; otherwise the path default applies. The provider wraps
// *only* <main> so the nav keeps the outer chrome theme while the
// content area switches to flightdeck on dashboard routes.
const selection = $derived(
	resolveThemeSelection({
		pathname: page.url.pathname,
		userTheme: themePref,
		userAppearance: appearancePref,
		systemAppearance,
	}),
);

// Disable the picker on routes that hard-require a specific theme (sim).
// `resolveThemeSelection` already enforces this server-side; the visual
// affordance keeps the user from wondering why their click was ignored.
const themePickerLocked = $derived(themePref != null && selection.theme !== themePref);

// Memory + help dropdown state lives in this layout (study-specific nav).
// Identity-menu state has moved into AppHeader.
let helpMenu = $state<HTMLDetailsElement | null>(null);
let memoryMenu = $state<HTMLDetailsElement | null>(null);

function closeDetails(target: HTMLDetailsElement | null) {
	if (!target?.open) return;
	target.open = false;
	const summary = target.querySelector('summary');
	if (summary instanceof HTMLElement) summary.focus();
}

function handleNavMenuKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape') return;
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

<svelte:window onkeydown={handleNavMenuKeydown} />

<!--
	Skip-to-content stays at the layout root (not in AppHeader) so it
	is the first focusable element on the page.
-->
<a class="skip" href="#main">Skip to main content</a>

<AppHeader
	app="study"
	flightbagHref={data.flightbagOrigin}
	helpHref={ROUTES.HELP}
	user={data.user}
	appearance={appearancePref}
	onAppearanceChange={setAppearance}
	appOrigins={data.appOrigins}
>
	{#snippet nav()}
		<nav class="nav-sections" aria-label="Primary">
			<a href={ROUTES.STUDY} aria-current={studyActive ? 'page' : undefined} data-testid="nav-home"
				>{NAV_LABELS.STUDY}</a
			>
			<a href={ROUTES.INSIGHTS} aria-current={insightsActive ? 'page' : undefined} data-testid="nav-insights"
				>{NAV_LABELS.INSIGHTS}</a
			>
			<a href={ROUTES.PROGRAM} aria-current={programActive ? 'page' : undefined} data-testid="nav-program"
				>{NAV_LABELS.PROGRAM}</a
			>
			<a
				href={ROUTES.REFERENCE}
				aria-current={referenceActive ? 'page' : undefined}
				data-testid="nav-reference">{NAV_LABELS.REFERENCE}</a
			>
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
			<a href={ROUTES.FLIGHT} aria-current={flightActive ? 'page' : undefined}>{NAV_LABELS.FLIGHT}</a>
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
		</nav>
	{/snippet}
	{#snippet helpSearch()}
		<HelpSearch />
	{/snippet}
	{#snippet glossarySlot()}
		<GlossaryDrawer entries={listGlossaryEntries()} />
	{/snippet}
	{#snippet themePicker()}
		<ThemePicker currentThemeId={selection.theme} onSelect={setTheme} locked={themePickerLocked} />
	{/snippet}
</AppHeader>

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

	.nav-sections {
		display: flex;
		gap: var(--space-xl);
		flex-wrap: wrap;
		align-items: center;
	}

	.nav-sections a {
		color: var(--ink-muted);
		text-decoration: none;
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.nav-sections a:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.nav-sections a[aria-current='page'] {
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
		color: var(--ink-muted);
		text-decoration: none;
	}

	.nav-menu-panel a:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.nav-menu-panel a[aria-current='page'] {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
	}

	@media (max-width: 640px) {
		.nav-sections {
			gap: var(--space-md);
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
