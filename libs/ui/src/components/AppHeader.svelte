<script lang="ts" module>
import type { AppId } from '@ab/constants';
import type { AppearancePreference } from '@ab/themes';
import type { Snippet } from 'svelte';

/**
 * Identity passed to `AppHeader`. Mirrors the narrow projection that
 * each app's `+layout.server.ts` already exposes -- name + email +
 * optional role. Keep this shape minimal so future apps can construct
 * it without leaking internal user fields to the client.
 */
export interface AppHeaderUser {
	name: string;
	email: string;
	role?: string | null;
}

export interface AppHeaderProps {
	/**
	 * Which surface this header is for. Drives the stacked brand block
	 * (small-caps "airboss" pretitle over uppercase APP NAME), the
	 * `data-app` attribute on the header element, and per-app routing
	 * defaults like `helpHref`.
	 */
	app: AppId;
	/** Brand link target. Defaults to `/` (each app's home). */
	brandHref?: string;
	/**
	 * Cross-app link to the flightbag, derived server-side via `siblingOrigin`.
	 * Pass `null` (or omit) to suppress -- flightbag itself, plus any future
	 * surface that doesn't want the link.
	 */
	flightbagHref?: string | null;
	/**
	 * Help link target. Defaults to `ROUTES.HELP`. Set explicitly when the
	 * app has no per-app help yet -- the link routes the user across to the
	 * study app's help index in that case (caller composes the cross-origin
	 * URL via `siblingOrigin`).
	 */
	helpHref?: string;
	/**
	 * Signed-in user. When `null` / `undefined` the account menu is replaced
	 * by a Sign in button (when `signInHref` is provided) or the `signedOut`
	 * snippet, whichever is supplied first.
	 */
	user?: AppHeaderUser | null;
	/** Sign-out POST target. Defaults to `ROUTES.LOGOUT`. */
	logoutAction?: string;
	/**
	 * Cross-app sign-in URL (typically study's `/login?redirectTo=<current>`).
	 * When `user == null` and this is set, a "Sign in" button replaces the
	 * account menu. Compose server-side via `studyLoginUrl(event)` from
	 * `@ab/auth` so the redirect lands the user back where they were.
	 */
	signInHref?: string;
	/**
	 * Current appearance preference (`light` | `dark` | `system`). When
	 * paired with `onAppearanceChange`, AppHeader renders an icon button in
	 * the right cluster that cycles through the three values. Hidden when
	 * `onAppearanceChange` is undefined so apps that haven't wired the
	 * persistence layer don't ship a non-functional control.
	 */
	appearance?: AppearancePreference;
	/** Called when the user clicks the appearance toggle. */
	onAppearanceChange?: (next: AppearancePreference) => void;
	/** App-specific nav (study/hangar). Rendered between brand and right cluster, flex-grow. */
	nav?: Snippet;
	/**
	 * Global help/aviation search affordance. Rendered in the right cluster
	 * between Help and Flightbag. Snippet rather than a direct
	 * `<HelpSearch />` import because `@ab/help` already imports from
	 * `@ab/ui` (Drawer + focus-trap); the reverse edge would form a cycle.
	 * The component itself is app-agnostic -- it searches the global
	 * `helpRegistry` singleton, which every app's `$lib/help/register`
	 * file populates at module-eval.
	 */
	helpSearch?: Snippet;
	/**
	 * Theme picker placement. AppHeader renders this snippet inside the
	 * account dropdown panel (frequency-of-use argument: themes change
	 * once a session, appearance toggles daily). Snippet rather than a
	 * direct ThemePicker import because the picker's `selection.theme`,
	 * `setTheme`, and `themePickerLocked` state are caller-owned.
	 */
	themePicker?: Snippet;
	/**
	 * Optional href to a preferences page. When set, a "Preferences" link
	 * appears in the account dropdown above Sign out. Only render when the
	 * caller provides one -- the route doesn't exist yet on every app.
	 */
	preferencesHref?: string;
	/**
	 * Rendered when `user` is null AND `signInHref` is unset. Escape hatch
	 * for callers that need a custom signed-out cluster.
	 */
	signedOut?: Snippet;
}
</script>

<script lang="ts">
import { APP_NAMES, NAV_LABELS, ROUTES } from '@ab/constants';
import { APPEARANCE_PREFERENCE_VALUES } from '@ab/themes';
import RolePill from './RolePill.svelte';

/**
 * Shared chrome header for every surface app. Replaces the per-app
 * brand+nav+tools+identity bars that were copy-pasted across study,
 * sim, hangar, flightbag, and avionics layouts. Layout zones:
 *
 *   [ brand ] [ nav slot .... ] [ help | search | flightbag | sun/moon | account ]
 *
 * The skip-to-content link stays at the layout root, NOT here -- it
 * has to be the first focusable element on the page (before the brand)
 * so a keyboard user reaches it on the first Tab press, and not every
 * app puts it in the same position relative to the header.
 *
 * The right cluster is fully owned by AppHeader: help link, search,
 * flightbag link, appearance toggle, account menu. v1 had a `tools`
 * snippet for caller-injected controls (notably ThemePicker); v2
 * folds the picker into the account dropdown via the `themePicker`
 * snippet and removes the open `tools` slot.
 *
 * Identity-menu state (open/close, Escape, document-pointerdown) lives
 * inside this component. Each app no longer carries its own copy of
 * the same handler set.
 */
let {
	app,
	brandHref = ROUTES.HOME,
	flightbagHref = null,
	helpHref = ROUTES.HELP,
	user = null,
	logoutAction = ROUTES.LOGOUT,
	signInHref,
	appearance,
	onAppearanceChange,
	nav,
	helpSearch,
	themePicker,
	preferencesHref,
	signedOut,
}: AppHeaderProps = $props();

const appLabel = $derived(APP_NAMES[app].toUpperCase());

const identityLabel = $derived(user ? user.name.trim() || user.email : '');
const showEmailRow = $derived(user ? identityLabel !== user.email : false);
const initials = $derived(user ? computeInitials(user.name, user.email) : '');

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

let identityMenu = $state<HTMLDetailsElement | null>(null);

// Identity menu hosts non-navigating controls (theme picker, sign-out
// form), so it can't rely on link-click teardown to dismiss. Close it when
// a pointerdown lands outside the <details>; clicks on the panel stay
// inside and are unaffected.
function handleDocumentPointerDown(event: PointerEvent) {
	if (!identityMenu?.open) return;
	const target = event.target;
	if (target instanceof Node && identityMenu.contains(target)) return;
	identityMenu.open = false;
}

function handleMenuKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape' || !identityMenu?.open) return;
	identityMenu.open = false;
	const summary = identityMenu.querySelector('summary');
	if (summary instanceof HTMLElement) summary.focus();
}

// Appearance toggle: cycles light -> dark -> system -> light. Render only
// when both `appearance` and `onAppearanceChange` are supplied; otherwise
// the toggle would be a no-op for apps that haven't wired the cookie
// persistence yet.
const showAppearanceToggle = $derived(appearance !== undefined && onAppearanceChange !== undefined);

function nextAppearance(current: AppearancePreference): AppearancePreference {
	const idx = APPEARANCE_PREFERENCE_VALUES.indexOf(current);
	const next = APPEARANCE_PREFERENCE_VALUES[(idx + 1) % APPEARANCE_PREFERENCE_VALUES.length];
	// Guard via type-narrowing rather than a non-null assertion so the
	// invariant ("VALUES is non-empty") is enforced at the type layer.
	return next ?? APPEARANCE_PREFERENCE_VALUES[0] ?? 'system';
}

function appearanceGlyph(value: AppearancePreference): string {
	if (value === 'light') return '☀';
	if (value === 'dark') return '☾';
	return '◐';
}

function appearanceAriaLabel(current: AppearancePreference): string {
	const next = nextAppearance(current);
	return `Switch appearance to ${next}`;
}

function handleAppearanceClick() {
	if (appearance === undefined || onAppearanceChange === undefined) return;
	onAppearanceChange(nextAppearance(appearance));
}
</script>

<svelte:window onkeydown={handleMenuKeydown} onpointerdown={handleDocumentPointerDown} />

<header class="app-header" data-app={app}>
	<a class="brand" href={brandHref}>
		<span class="brand-pretitle">airboss</span>
		<span class="brand-app">{appLabel}</span>
	</a>

	{#if nav}
		<div class="nav-slot">{@render nav()}</div>
	{/if}

	<div class="right">
		{#if helpHref}
			<a class="header-link" href={helpHref}>{NAV_LABELS.HELP}</a>
		{/if}

		{#if helpSearch}
			<div class="help-search-slot">{@render helpSearch()}</div>
		{/if}

		{#if flightbagHref}
			<a class="header-link" href={flightbagHref}>{NAV_LABELS.FLIGHTBAG}</a>
		{/if}

		{#if showAppearanceToggle && appearance !== undefined}
			<button
				type="button"
				class="appearance-toggle"
				aria-label={appearanceAriaLabel(appearance)}
				data-appearance={appearance}
				onclick={handleAppearanceClick}
			>
				<span aria-hidden="true">{appearanceGlyph(appearance)}</span>
			</button>
		{/if}

		{#if user}
			<details class="identity" bind:this={identityMenu}>
				<summary aria-label="Account menu for {identityLabel}">
					<span class="identity-label-full">{identityLabel}</span>
					<span class="identity-label-compact" aria-hidden="true">{initials}</span>
					{#if user.role}
						<RolePill ariaHidden>{user.role}</RolePill>
					{/if}
					<span class="chevron" aria-hidden="true">▾</span>
				</summary>
				<div class="identity-panel">
					{#if showEmailRow}
						<div class="identity-email">{user.email}</div>
					{/if}
					{#if themePicker}
						<div class="identity-theme">{@render themePicker()}</div>
					{/if}
					{#if preferencesHref}
						<a class="identity-preferences" href={preferencesHref}>Preferences</a>
					{/if}
					<form method="POST" action={logoutAction} class="identity-signout">
						<button type="submit">Sign out</button>
					</form>
				</div>
			</details>
		{:else if signInHref}
			<a class="signin-button" href={signInHref}>Sign in</a>
		{:else if signedOut}
			{@render signedOut()}
		{/if}
	</div>
</header>

<style>
	.app-header {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: var(--space-xl);
		padding: var(--space-lg) var(--space-xl);
		border-bottom: 1px solid var(--edge-default);
		background: var(--surface-panel);
	}

	/*
	 * Stacked brand: small-caps "airboss" sits over the all-caps app name.
	 * Both lines are clickable as a single link. `flex: 0 0 auto` pins the
	 * brand hard-left even when the nav slot wants to grow.
	 */
	.brand {
		display: inline-flex;
		flex: 0 0 auto;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		text-decoration: none;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		line-height: 1;
	}

	.brand:hover {
		background: var(--surface-sunken);
	}

	.brand:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.brand-pretitle {
		font-variant: small-caps;
		text-transform: lowercase;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--type-ui-control-weight);
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
		line-height: 1.1;
	}

	.brand-app {
		/* Heading-3 token (1.125rem / weight 600) is the closest existing size
		 * for a strong app title that doesn't compete with page H1s. */
		font-size: var(--type-heading-3-size);
		font-weight: var(--type-heading-1-weight);
		font-family: var(--font-family-mono);
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-body);
		line-height: 1.1;
	}

	.nav-slot {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-xl);
	}

	.right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-lg);
	}

	.header-link {
		color: var(--ink-muted);
		text-decoration: none;
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.header-link:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.header-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.help-search-slot {
		display: inline-flex;
		align-items: center;
	}

	.appearance-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--space-2xl);
		height: var(--space-2xl);
		padding: 0;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-muted);
		font-size: var(--type-heading-4-size);
		line-height: 1;
		cursor: pointer;
	}

	.appearance-toggle:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.appearance-toggle:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.signin-button {
		color: var(--ink-body);
		text-decoration: none;
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-2xs) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
	}

	.signin-button:hover {
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		border-color: var(--action-default);
	}

	.signin-button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
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
		min-width: 14rem;
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

	.identity-theme {
		padding: var(--space-sm);
		border-top: 1px solid var(--edge-default);
	}

	.identity-preferences {
		display: block;
		text-decoration: none;
		color: var(--ink-muted);
		padding: var(--space-sm) var(--space-sm);
		border-radius: var(--radius-sm);
		border-top: 1px solid var(--edge-default);
		margin-top: var(--space-2xs);
		font-size: var(--type-ui-label-size);
	}

	.identity-preferences:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.identity-preferences:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
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

	/*
	 * Narrow viewports: swap the full identity label for initials so the
	 * header stops wrapping around ~640px. The panel still shows the full
	 * identity once opened.
	 */
	@media (max-width: 640px) {
		.app-header {
			gap: var(--space-md);
			padding: var(--space-md) var(--space-lg);
		}

		.right {
			gap: var(--space-md);
		}

		.identity-label-full {
			display: none;
		}

		.identity-label-compact {
			display: inline;
		}
	}
</style>
