<script lang="ts">
import { ROUTES } from '@ab/constants';
import {
	APPEARANCE_PREFERENCE_VALUES,
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
import type { Snippet } from 'svelte';
import { page } from '$app/state';
import Nav from '$lib/components/Nav.svelte';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

const appearancePref = $derived(data.appearance);
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
	themePref = value;
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

const identityLabel = $derived(data.user.name.trim() || data.user.email);
const showEmailRow = $derived(identityLabel !== data.user.email);
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

let identityMenu = $state<HTMLDetailsElement | null>(null);

function handleMenuKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape' || !identityMenu?.open) return;
	identityMenu.open = false;
	const summary = identityMenu.querySelector('summary');
	if (summary instanceof HTMLElement) summary.focus();
}
</script>

<svelte:window onkeydown={handleMenuKeydown} />

<a class="skip" href="#main">Skip to main content</a>

<ThemeProvider theme={selection.theme} appearance={selection.appearance} layout={selection.layout}>
	<nav aria-label="Primary" class="topnav">
		<a class="brand" href={ROUTES.HANGAR_HOME}>airboss / hangar</a>
		<Nav />
		<div class="spacer"></div>

		<ThemePicker currentThemeId={selection.theme} onSelect={setTheme} locked={themePickerLocked} />

		<details class="identity" bind:this={identityMenu}>
			<summary aria-label="Account menu for {identityLabel}">
				<span class="identity-label-full">{identityLabel}</span>
				<span class="identity-label-compact" aria-hidden="true">{initials}</span>
				{#if data.user.role}
					<span class="role-pill" aria-hidden="true">{data.user.role}</span>
				{/if}
				<span class="chevron" aria-hidden="true">v</span>
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
		z-index: 100;
	}

	.skip:focus {
		top: var(--space-sm);
	}

	.topnav {
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

	.spacer {
		flex: 1;
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

	.role-pill {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-pill);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
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
		z-index: 50;
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

	@media (max-width: 700px) {
		.topnav {
			gap: var(--space-md);
			padding: var(--space-md) var(--space-lg);
		}

		.identity-label-full {
			display: none;
		}

		.identity-label-compact {
			display: inline;
		}
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
