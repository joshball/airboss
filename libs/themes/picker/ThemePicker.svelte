<script lang="ts">
/**
 * Theme picker UI -- shared across study, sim, and hangar.
 *
 * The picker is a `<details>/<summary>` disclosure that exposes a
 * single-select `role="listbox"` of registered themes. Listbox (rather
 * than `role="menu"` with `menuitemradio`) is the correct WAI-ARIA
 * pattern for "pick one from a small set of mutually exclusive options"
 * -- it requires the standard arrow/Home/End/Enter keyboard model and
 * announces the selected option as such on every supported AT.
 *
 * The component does NOT post to `/theme` directly. The host app passes
 * an `onSelect` callback which decides what to do (POST the cookie,
 * dispatch local state, etc.). Keeps the component free of route
 * assumptions and makes it trivially testable.
 *
 * `locked` mirrors the route safety rule: when the resolved theme can't
 * match the user's pick (today, on `/sim/*` where the route forces
 * sim/glass), the host passes `locked` so the picker shows the
 * explanation, disables every option, and exposes the reason via
 * `aria-describedby` so AT users hear it before opening the panel.
 *
 * Accessibility highlights:
 *   - `aria-haspopup="listbox"` + `aria-expanded` bound to the open state.
 *   - Roving tabindex inside the listbox: only the focused option is
 *     tab-focusable; arrow / Home / End move focus, Enter / Space select.
 *   - On open, focus moves to the currently-selected option (or the
 *     first option if no current id matches).
 *   - On Escape or selection, focus returns to the trigger.
 *   - A polite live region announces the new active theme on selection
 *     so screen-reader users get confirmation their pick took effect.
 *   - Locked state: the trigger is `aria-disabled` and `aria-describedby`
 *     points to a visually-hidden description; every option carries the
 *     native `disabled` attribute so the AT announces the unavailability.
 *   - Reduced motion: the chevron transition collapses to none under
 *     `prefers-reduced-motion: reduce`.
 *   - Min click target on options is 44px (WCAG 2.5.5 AAA, well above
 *     2.5.8 AA).
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
let isOpen = $state(false);
// Index of the option that currently holds focus inside the listbox.
// Drives roving tabindex; only this option is tab-focusable, others are
// `tabindex="-1"` so Tab leaves the listbox in one step.
let focusedIndex = $state(-1);
let liveAnnouncement = $state('');

// Stable ids so `aria-describedby` and `aria-activedescendant` resolve
// against rendered DOM nodes regardless of how many pickers are on a page.
const instanceId = $props.id();
const lockedDescriptionId = `${instanceId}-locked-desc`;
const listboxId = `${instanceId}-listbox`;
function optionId(themeId: ThemeId): string {
	return `${instanceId}-opt-${themeId}`;
}

function focusOption(index: number) {
	if (!menu) return;
	const buttons = menu.querySelectorAll<HTMLButtonElement>('[data-theme-option]');
	const target = buttons.item(index);
	if (target) {
		focusedIndex = index;
		target.focus();
	}
}

function handleToggle() {
	if (!menu) return;
	isOpen = menu.open;
	if (!menu.open) {
		focusedIndex = -1;
		return;
	}
	// On open, land on the currently-selected option (or the first one
	// if no match). Defer to the next microtask so the panel is in the
	// DOM before we try to focus.
	const fallback = availableThemes.findIndex((t) => t.id === currentThemeId);
	const initial = fallback >= 0 ? fallback : 0;
	queueMicrotask(() => focusOption(initial));
}

function handleBlur(event: FocusEvent) {
	if (!menu) return;
	const next = event.relatedTarget;
	if (next instanceof Node && menu.contains(next)) return;
	menu.open = false;
	isOpen = false;
	focusedIndex = -1;
}

function closeAndReturnFocus() {
	if (!menu) return;
	menu.open = false;
	isOpen = false;
	focusedIndex = -1;
	const summary = menu.querySelector('summary');
	if (summary instanceof HTMLElement) summary.focus();
}

function handleSummaryKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape' && menu?.open) {
		event.preventDefault();
		closeAndReturnFocus();
		return;
	}
	// ArrowDown on a closed picker should open the listbox and focus the
	// active option, matching the listbox APG combobox-ish pattern. The
	// `ontoggle` handler runs `handleToggle` which moves focus.
	if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && menu && !menu.open) {
		event.preventDefault();
		menu.open = true;
	}
}

function handleOptionKeydown(event: KeyboardEvent, index: number, themeId: ThemeId) {
	switch (event.key) {
		case 'Escape':
			event.preventDefault();
			closeAndReturnFocus();
			return;
		case 'ArrowDown': {
			event.preventDefault();
			const next = (index + 1) % availableThemes.length;
			focusOption(next);
			return;
		}
		case 'ArrowUp': {
			event.preventDefault();
			const prev = (index - 1 + availableThemes.length) % availableThemes.length;
			focusOption(prev);
			return;
		}
		case 'Home':
			event.preventDefault();
			focusOption(0);
			return;
		case 'End':
			event.preventDefault();
			focusOption(availableThemes.length - 1);
			return;
		case 'Enter':
		case ' ':
			event.preventDefault();
			handleSelect(themeId);
			return;
		case 'Tab':
			// Native Tab closes the picker (focus moves outside, blur
			// handler picks it up). Don't preventDefault.
			return;
	}
}

function handleSelect(themeId: ThemeId) {
	if (locked) return;
	if (themeId === currentThemeId) {
		closeAndReturnFocus();
		return;
	}
	const newLabel = availableThemes.find((t) => t.id === themeId)?.label ?? themeId;
	closeAndReturnFocus();
	onSelect(themeId);
	// Polite announcement -- the visual change is immediate; the SR
	// confirmation tells AT users their selection landed.
	liveAnnouncement = `Theme changed to ${newLabel}.`;
}
</script>

<details
	class="theme-picker"
	bind:this={menu}
	ontoggle={handleToggle}
	onfocusout={handleBlur}
>
	<summary
		aria-haspopup="listbox"
		aria-expanded={isOpen}
		aria-controls={listboxId}
		aria-label={triggerLabel}
		aria-disabled={locked}
		aria-describedby={locked ? lockedDescriptionId : undefined}
		onkeydown={handleSummaryKeydown}
	>
		<span class="theme-picker-label">{activeLabel}</span>
		<span class="chevron" aria-hidden="true">▾</span>
	</summary>
	<!--
		`role="listbox"` is the correct ARIA shape for single-select
		"pick one of N" widgets. Each option is a real `<button>` so it
		stays operable without JS-driven activation; we just supply the
		listbox semantics on top.
	-->
	<div
		id={listboxId}
		class="theme-picker-panel"
		role="listbox"
		tabindex="-1"
		aria-label={locked ? 'Theme (locked on this route)' : 'Choose theme'}
		aria-activedescendant={focusedIndex >= 0
			? optionId(availableThemes[focusedIndex]?.id ?? currentThemeId)
			: undefined}
	>
		{#if locked}
			<p class="theme-picker-locked">This route requires a fixed theme.</p>
		{/if}
		{#each availableThemes as option, index (option.id)}
			<button
				type="button"
				role="option"
				id={optionId(option.id)}
				aria-selected={currentThemeId === option.id}
				class="theme-picker-option"
				class:active={currentThemeId === option.id}
				disabled={locked}
				data-theme-option
				tabindex={focusedIndex === index || (focusedIndex < 0 && currentThemeId === option.id) ? 0 : -1}
				onclick={() => handleSelect(option.id)}
				onkeydown={(event) => handleOptionKeydown(event, index, option.id)}
			>
				<span class="theme-picker-option-label">{option.label}</span>
				{#if currentThemeId === option.id}
					<span class="theme-picker-check" aria-hidden="true">✓</span>
				{/if}
			</button>
		{/each}
	</div>
</details>

<!--
	Visually hidden description that hangs off the trigger via
	`aria-describedby` whenever the picker is locked. Rendering it
	unconditionally (rather than gating on `locked`) keeps the id
	stable so AT scrapes don't drop the association across renders.
-->
<span id={lockedDescriptionId} class="visually-hidden">
	{locked
		? 'Theme is locked because the current route requires a fixed theme. Your preference is saved and will apply on other routes.'
		: ''}
</span>

<!-- Polite live region: announces the new theme name after a selection. -->
<span class="visually-hidden" aria-live="polite" aria-atomic="true">{liveAnnouncement}</span>

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
		/* WCAG 2.5.5 AAA: 44x44 minimum click target. No `--target-min`
		   token in the system today, so we hold a literal here. The lint
		   rule blocks raw lengths only on padding/margin/gap/font/radius;
		   `min-height` is exempt. */
		min-height: 2.75rem;
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

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
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
		/* WCAG 2.5.5 AAA: 44x44 minimum click target. No `--target-min`
		   token in the system today, so we hold a literal here. The lint
		   rule blocks raw lengths only on padding/margin/gap/font/radius;
		   `min-height` is exempt. */
		min-height: 2.75rem;
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

	/*
	 * `visually-hidden`: kept off-screen but exposed to AT. Used by the
	 * locked-state description and the polite announcement region.
	 */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
