<script lang="ts" module>
import type { AppId } from '@ab/constants';
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
	/** Which surface this header is for. Drives the brand label "airboss / {app}". */
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
	 * Signed-in user. When `null` / `undefined` the identity menu is replaced
	 * by the `signedOut` snippet (or nothing).
	 */
	user?: AppHeaderUser | null;
	/** Sign-out POST target. Defaults to `ROUTES.LOGOUT`. */
	logoutAction?: string;
	/** App-specific nav (study/hangar). Rendered between brand and tools, flex-grow. */
	nav?: Snippet;
	/** Global tools -- ThemePicker, HelpSearch, etc. Rendered before identity on the right. */
	tools?: Snippet;
	/** Rendered when `user` is null. Optional. */
	signedOut?: Snippet;
	/**
	 * Rendered inside the identity dropdown panel, ABOVE Sign out
	 * (e.g. appearance radios). Optional.
	 */
	identityPanel?: Snippet;
}
</script>

<script lang="ts">
import { APP_NAMES, NAV_LABELS, ROUTES } from '@ab/constants';
import RolePill from './RolePill.svelte';

/**
 * Shared chrome header for every surface app. Replaces the per-app
 * brand+nav+tools+identity bars that were copy-pasted across study,
 * sim, hangar, flightbag, and avionics layouts. Layout zones:
 *
 *   [ brand ] [ nav slot ............... ] [ flightbag | tools | identity ]
 *
 * The skip-to-content link stays at the layout root, NOT here -- it
 * has to be the first focusable element on the page (before the brand)
 * so a keyboard user reaches it on the first Tab press, and not every
 * app puts it in the same position relative to the header.
 *
 * Identity-menu state (open/close, Escape, document-pointerdown) lives
 * inside this component. Each app no longer carries its own copy of
 * the same handler set.
 */
let {
	app,
	brandHref = ROUTES.HOME,
	flightbagHref = null,
	user = null,
	logoutAction = ROUTES.LOGOUT,
	nav,
	tools,
	signedOut,
	identityPanel,
}: AppHeaderProps = $props();

const brandLabel = $derived(`airboss / ${APP_NAMES[app].toLowerCase()}`);

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

// Identity menu hosts non-navigating controls (appearance radios, sign-out
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
</script>

<svelte:window onkeydown={handleMenuKeydown} onpointerdown={handleDocumentPointerDown} />

<header class="app-header" data-app={app}>
	<a class="brand" href={brandHref}>{brandLabel}</a>

	{#if nav}
		<div class="nav-slot">{@render nav()}</div>
	{/if}

	<div class="right">
		{#if flightbagHref}
			<a class="flightbag-link" href={flightbagHref}>{NAV_LABELS.FLIGHTBAG}</a>
		{/if}

		{#if tools}
			<div class="tools">{@render tools()}</div>
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
					{#if identityPanel}
						{@render identityPanel()}
					{/if}
					<form method="POST" action={logoutAction} class="identity-signout">
						<button type="submit">Sign out</button>
					</form>
				</div>
			</details>
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

	.brand {
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		letter-spacing: var(--letter-spacing-wide);
		text-decoration: none;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.brand:hover {
		background: var(--surface-sunken);
	}

	.brand:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
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

	.flightbag-link {
		color: var(--ink-muted);
		text-decoration: none;
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.flightbag-link:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.flightbag-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.tools {
		display: flex;
		align-items: center;
		gap: var(--space-md);
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
