<script lang="ts">
/**
 * Theme picker UI -- shared across study, sim, and hangar.
 *
 * The picker is a `<details>/<summary>` disclosure (matches the pattern
 * the study identity dropdown uses). It iterates `listThemes()` so a new
 * registered theme appears automatically -- per-app picker code never
 * grows when a theme ships.
 *
 * The component does NOT post to `/theme` directly. The host app passes
 * an `onSelect` callback which decides what to do (POST the cookie,
 * dispatch local state, etc.). Keeps the component free of route
 * assumptions and makes it trivially testable.
 *
 * `locked` mirrors the route safety rule: when the resolved theme can't
 * match the user's pick (today, on `/sim/*` where the route forces
 * sim/glass), the host passes `locked` so the picker shows the
 * explanation and disables every option. The user can still see what
 * they picked elsewhere; on leaving the locked route their pref takes
 * effect again.
 */
import type { Theme, ThemeId } from '../contract';
import { listThemes } from '../registry';

type Props = {
	/**
	 * The id the resolver computed for this route -- the option that
	 * shows as active. This may differ from the user's preference on
	 * routes that hard-require a theme (`/sim/*`).
	 */
	currentThemeId: ThemeId;
	/** Called when the user picks an option; the host persists/applies. */
	onSelect: (themeId: ThemeId) => void;
	/**
	 * True when the host route hard-requires a fixed theme. Disables every
	 * option and shows the explanation row.
	 */
	locked?: boolean;
	/** Optional `aria-label` for the trigger; defaults to "Theme: <name>". */
	ariaLabel?: string;
};

const { currentThemeId, onSelect, locked = false, ariaLabel }: Props = $props();

// Snapshot the registered themes once at module init. The registry is a
// side-effect-populated singleton, so this resolves to whatever has been
// registered by `@ab/themes/index.ts` import time.
const availableThemes: ReadonlyArray<{ id: ThemeId; label: string }> = listThemes().map((t: Theme) => ({
	id: t.id,
	label: t.name,
}));

const activeLabel = $derived(availableThemes.find((t) => t.id === currentThemeId)?.label ?? currentThemeId);
const triggerLabel = $derived(ariaLabel ?? `Theme: ${activeLabel}`);

let menu = $state<HTMLDetailsElement | null>(null);

function handleBlur(event: FocusEvent) {
	if (!menu) return;
	const next = event.relatedTarget;
	if (next instanceof Node && menu.contains(next)) return;
	menu.open = false;
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape' || !menu?.open) return;
	menu.open = false;
	const summary = menu.querySelector('summary');
	if (summary instanceof HTMLElement) summary.focus();
}

function handleSelect(themeId: ThemeId) {
	if (themeId === currentThemeId) {
		if (menu) menu.open = false;
		return;
	}
	if (menu) menu.open = false;
	onSelect(themeId);
}
</script>

<details class="theme-picker" bind:this={menu} onfocusout={handleBlur}>
	<summary
		aria-haspopup="menu"
		aria-label={triggerLabel}
		aria-disabled={locked}
		onkeydown={handleKeydown}
	>
		<span class="theme-picker-label">{activeLabel}</span>
		<span class="chevron" aria-hidden="true">▾</span>
	</summary>
	<!--
		Escape inside the panel routes through individual options' onkeydown
		(below) so the menu role doesn't have to be focusable itself.
	-->
	<div class="theme-picker-panel" role="menu" aria-label="Choose theme">
		{#if locked}
			<p class="theme-picker-locked">This route requires a fixed theme.</p>
		{/if}
		{#each availableThemes as option (option.id)}
			<button
				type="button"
				role="menuitemradio"
				aria-checked={currentThemeId === option.id}
				class="theme-picker-option"
				class:active={currentThemeId === option.id}
				disabled={locked}
				onclick={() => handleSelect(option.id)}
				onkeydown={handleKeydown}
			>
				<span class="theme-picker-option-label">{option.label}</span>
				{#if currentThemeId === option.id}
					<span class="theme-picker-check" aria-hidden="true">✓</span>
				{/if}
			</button>
		{/each}
	</div>
</details>

<style>
	.theme-picker {
		position: relative;
	}

	.theme-picker > summary {
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

	.theme-picker > summary::-webkit-details-marker {
		display: none;
	}

	.theme-picker > summary::marker {
		content: '';
	}

	.theme-picker > summary:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.theme-picker > summary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.theme-picker > summary[aria-disabled='true'] {
		color: var(--ink-faint);
		cursor: not-allowed;
	}

	.theme-picker[open] > summary {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.theme-picker[open] .chevron {
		transform: rotate(180deg);
	}

	.theme-picker-label {
		text-transform: capitalize;
	}

	.chevron {
		font-size: var(--type-ui-caption-size);
		line-height: 1;
		transition: transform var(--motion-fast);
	}

	.theme-picker-panel {
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
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.theme-picker-locked {
		margin: 0;
		padding: var(--space-sm);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		border-bottom: 1px solid var(--edge-default);
	}

	.theme-picker-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		width: 100%;
		text-align: left;
		background: transparent;
		border: 0;
		color: var(--ink-body);
		font: inherit;
		font-size: var(--type-ui-label-size);
		padding: var(--space-sm) var(--space-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.theme-picker-option:hover:not([disabled]) {
		background: var(--surface-sunken);
	}

	.theme-picker-option:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	.theme-picker-option.active {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
	}

	.theme-picker-option[disabled] {
		color: var(--ink-faint);
		cursor: not-allowed;
	}

	.theme-picker-check {
		font-size: var(--type-ui-caption-size);
	}
</style>
