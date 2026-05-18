<script lang="ts">
import {
	APP_IDS,
	NAV_LABELS,
	type ReadingDensity,
	type ReadingFontFamily,
	type ReadingFontScale,
	type ReadingHeadingScale,
	type ReadingMeasure,
	ROUTES,
	USER_PREF_KEYS,
	type UserPrefKey,
} from '@ab/constants';
import { listGlossaryEntries } from '@ab/help/glossary';
import HelpSearch from '@ab/help/ui/HelpSearch.svelte';
import HighlightTokens from '@ab/library/HighlightTokens.svelte';
import ReaderPrefsButton, { type ReadingPrefKey, type ReadingPrefValue } from '@ab/library/ReaderPrefsButton.svelte';
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
import ReadableScope from '@ab/ui/components/ReadableScope.svelte';
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import { registerStudyCommands, unregisterStudyCommands } from '$lib/palette/commands';
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

// Reader-prefs optimistic-flip pattern -- mirrors flightbag root layout.
// `<ReaderPrefsButton>` calls `handleReadingPrefChange`; the override
// state flips immediately so the body re-renders without a server round
// trip, then the POST persists.
let fontFamilyOverride = $state<ReadingFontFamily | null>(null);
let fontScaleOverride = $state<ReadingFontScale | null>(null);
let densityOverride = $state<ReadingDensity | null>(null);
let measureOverride = $state<ReadingMeasure | null>(null);
let headingScaleOverride = $state<ReadingHeadingScale | null>(null);

const readingPrefs = $derived({
	fontFamily: fontFamilyOverride ?? data.readingPrefs.fontFamily,
	fontScale: fontScaleOverride ?? data.readingPrefs.fontScale,
	density: densityOverride ?? data.readingPrefs.density,
	measure: measureOverride ?? data.readingPrefs.measure,
	headingScale: headingScaleOverride ?? data.readingPrefs.headingScale,
});

const READING_PREF_KEY_FOR_PROP: Record<ReadingPrefKey, UserPrefKey> = {
	fontFamily: USER_PREF_KEYS.READING_FONT_FAMILY,
	fontScale: USER_PREF_KEYS.READING_FONT_SCALE,
	density: USER_PREF_KEYS.READING_DENSITY,
	measure: USER_PREF_KEYS.READING_MEASURE,
	headingScale: USER_PREF_KEYS.READING_HEADING_SCALE,
};

async function handleReadingPrefChange(propKey: ReadingPrefKey, value: ReadingPrefValue) {
	switch (propKey) {
		case 'fontFamily':
			fontFamilyOverride = value as ReadingFontFamily;
			break;
		case 'fontScale':
			fontScaleOverride = value as ReadingFontScale;
			break;
		case 'density':
			densityOverride = value as ReadingDensity;
			break;
		case 'measure':
			measureOverride = value as ReadingMeasure;
			break;
		case 'headingScale':
			headingScaleOverride = value as ReadingHeadingScale;
			break;
	}
	try {
		await fetch(ROUTES.READING_PREFS, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: READING_PREF_KEY_FOR_PROP[propKey], value }),
		});
	} catch {
		// Non-fatal: the in-page UI has already flipped via $state above.
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

// Phase 4 of study-app-ia-cleanup locked the top nav to five sections:
// Home / Learn / Program / Insights / Reference. The Memory dropdown
// and the local Help dropdown that lived here in earlier phases are
// removed; section index pages now carry the sub-nav (e.g. `/study/learn`
// shows Cards / Reps / Read tabs via `LearnTabs.svelte`). The global
// Help search lives in `AppHeader.svelte` and is the only Help affordance
// in the chrome. The course-primitive WP added a sixth section (`Courses`,
// testid `nav-courses`) for instructor-authored pedagogical content.
// The full set of locked testids -- `nav-home`, `nav-learn`, `nav-courses`,
// `nav-program`, `nav-insights`, `nav-reference` -- is the contract that
// the `ia-flow.spec.ts` and `ia-page-anchor-guard.spec.ts` guards enforce.
const studyActive = $derived(page.url.pathname === ROUTES.STUDY);
// The legacy `/library` path prefix is matched as an INCOMING request URL
// (not constructed as an outgoing link). The study 301-redirect layer still
// handles `/library/*` for stale bookmarks; a literal is the correct shape
// for incoming-URL matching (the `LIBRARY_*` route constants were retired by
// the flightbag-citation-url-migration WP).
const LEGACY_LIBRARY_PATH = '/library';
// `/study/learn` consolidates Cards (`/memory`), Reps (`/reps`), and
// Read (`/library`). The highlight matches anywhere under `/study/learn`,
// `/memory`, `/reps`, or `/library` so Learn stays lit no matter which
// sub-section the user is on.
const learnActive = $derived(
	pathMatches(page.url.pathname, ROUTES.LEARN) ||
		pathMatches(page.url.pathname, ROUTES.MEMORY) ||
		pathMatches(page.url.pathname, ROUTES.REPS) ||
		pathMatches(page.url.pathname, LEGACY_LIBRARY_PATH),
);
// `/courses` -- instructor-authored courses (course-primitive WP). Pedagogical
// content the learner consumes; lives next to Learn in the nav.
const coursesActive = $derived(pathMatches(page.url.pathname, ROUTES.COURSES));
// `/insights` rolls Stats / Calibration / Lens onto one section
// (study-app-ia-cleanup Phase 3). The nav highlight matches anywhere
// under `/insights/*`.
const insightsActive = $derived(pathMatches(page.url.pathname, ROUTES.INSIGHTS));
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

// Phase 4: dropdown state removed. Memory + Help dropdowns are gone;
// the five top-level sections carry the entire nav surface, with sub-nav
// living on each section index page (e.g. `LearnTabs.svelte` for the
// Learn section). Identity-menu state lives in `AppHeader.svelte`; the
// global Help search lives in the right cluster of the same header.

// Phase 4 of the command-palette WP: register the study app's declarative
// commands with the singleton `paletteCommands` registry on mount and
// unregister on teardown. The keep-alive HMR pattern in `commands.ts`
// (unregister before register) keeps this idempotent across dev reloads.
$effect(() => {
	registerStudyCommands();
	return () => unregisterStudyCommands();
});
</script>

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
			<a href={ROUTES.LEARN} aria-current={learnActive ? 'page' : undefined} data-testid="nav-learn"
				>{NAV_LABELS.LEARN}</a
			>
			<a href={ROUTES.COURSES} aria-current={coursesActive ? 'page' : undefined} data-testid="nav-courses"
				>{NAV_LABELS.COURSES}</a
			>
			<a href={ROUTES.PROGRAM} aria-current={programActive ? 'page' : undefined} data-testid="nav-program"
				>{NAV_LABELS.PROGRAM}</a
			>
			<a href={ROUTES.INSIGHTS} aria-current={insightsActive ? 'page' : undefined} data-testid="nav-insights"
				>{NAV_LABELS.INSIGHTS}</a
			>
			<a
				href={ROUTES.REFERENCE}
				aria-current={referenceActive ? 'page' : undefined}
				data-testid="nav-reference">{NAV_LABELS.REFERENCE}</a
			>
		</nav>
	{/snippet}
	{#snippet helpSearch()}
		<HelpSearch app={APP_IDS.STUDY} />
	{/snippet}
	{#snippet glossarySlot()}
		<GlossaryDrawer entries={listGlossaryEntries()} />
	{/snippet}
	{#snippet themePicker()}
		<ThemePicker currentThemeId={selection.theme} onSelect={setTheme} locked={themePickerLocked} />
	{/snippet}
	{#snippet readerPrefs()}
		<ReaderPrefsButton
			fontFamily={readingPrefs.fontFamily}
			fontScale={readingPrefs.fontScale}
			density={readingPrefs.density}
			measure={readingPrefs.measure}
			headingScale={readingPrefs.headingScale}
			onChange={handleReadingPrefChange}
		/>
	{/snippet}
</AppHeader>

<ThemeProvider theme={selection.theme} appearance={selection.appearance} layout={selection.layout}>
	<ReadableScope
		fontFamily={readingPrefs.fontFamily}
		fontScale={readingPrefs.fontScale}
		density={readingPrefs.density}
		measure={readingPrefs.measure}
		headingScale={readingPrefs.headingScale}
	>
		<HighlightTokens>
			<main id="main" tabindex="-1" class:full-bleed={fullBleed}>
				{@render children()}
			</main>
		</HighlightTokens>
	</ReadableScope>
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
