<script lang="ts" module>
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Theme-aware button / link primitive.
 *
 * Renders an `<a>` when `href` is provided, otherwise a `<button>`.
 * Reads all colors / sizing / radii from theme tokens so the same instance
 * reskins under `web` vs `tui`.
 *
 * Loading state: pass `loading` + optionally `loadingLabel` to replace the
 * label while the button is disabled. Callers don't need to track disabled
 * separately -- passing `loading` forces disabled.
 */

let {
	variant = 'primary',
	size = 'md',
	href,
	type = 'button',
	disabled = false,
	loading = false,
	loadingLabel,
	fullWidth = false,
	ariaLabel,
	onclick,
	children,
}: {
	variant?: ButtonVariant;
	size?: ButtonSize;
	href?: string;
	type?: ButtonType;
	disabled?: boolean;
	loading?: boolean;
	loadingLabel?: string;
	fullWidth?: boolean;
	ariaLabel?: string;
	onclick?: (event: MouseEvent) => void;
	children: Snippet;
} = $props();

const isDisabled = $derived(disabled || loading);
</script>

{#if href !== undefined}
	<a
		class="btn v-{variant} s-{size}"
		class:full={fullWidth}
		class:is-disabled={isDisabled}
		href={isDisabled ? undefined : href}
		aria-disabled={isDisabled ? 'true' : undefined}
		aria-label={ariaLabel}
		tabindex={isDisabled ? -1 : undefined}
		onclick={(event) => {
			if (isDisabled) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			onclick?.(event);
		}}
	>
		{#if loading && loadingLabel}
			{loadingLabel}
		{:else}
			{@render children()}
		{/if}
	</a>
{:else}
	<button
		class="btn v-{variant} s-{size}"
		class:full={fullWidth}
		{type}
		disabled={isDisabled}
		aria-label={ariaLabel}
		onclick={onclick}
	>
		{#if loading && loadingLabel}
			{loadingLabel}
		{:else}
			{@render children()}
		{/if}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--ab-space-xs);
		font-family: inherit;
		font-weight: var(--ab-font-weight-semibold);
		letter-spacing: var(--ab-letter-spacing-normal);
		border: 1px solid transparent;
		border-radius: var(--ab-control-radius);
		cursor: pointer;
		text-decoration: none;
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast),
			color var(--ab-transition-fast);
		font-variant-numeric: tabular-nums;
	}

	.btn.full {
		display: flex;
		width: 100%;
	}

	.btn:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
	}

	.btn:disabled,
	.btn.is-disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Anchor form of the primitive with disabled=true must ignore pointer
	   input entirely -- aria-disabled keeps it out of AT focus order, and
	   pointer-events: none removes click targets on the link text. */
	.btn.is-disabled {
		pointer-events: none;
	}

	/* Sizes */
	.s-sm {
		padding: var(--ab-control-padding-y-sm) var(--ab-control-padding-x-sm);
		font-size: var(--ab-control-font-size-sm);
	}

	.s-md {
		padding: var(--ab-control-padding-y-md) var(--ab-control-padding-x-md);
		font-size: var(--ab-control-font-size-md);
	}

	.s-lg {
		padding: var(--ab-control-padding-y-lg) var(--ab-control-padding-x-lg);
		font-size: var(--ab-control-font-size-lg);
	}

	/* Primary */
	.v-primary {
		background: var(--ab-color-primary);
		color: var(--ab-color-primary-fg);
	}
	.v-primary:not(:disabled):not(.is-disabled):hover {
		background: var(--ab-color-primary-hover);
	}
	.v-primary:not(:disabled):not(.is-disabled):active {
		background: var(--ab-color-primary-active);
	}

	/* Secondary */
	.v-secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}
	.v-secondary:not(:disabled):not(.is-disabled):hover {
		background: var(--ab-color-border);
	}
	.v-secondary:not(:disabled):not(.is-disabled):active {
		background: var(--ab-color-border-strong);
	}

	/* Ghost */
	.v-ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}
	.v-ghost:not(:disabled):not(.is-disabled):hover {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
	}
	.v-ghost:not(:disabled):not(.is-disabled):active {
		background: var(--ab-color-border);
	}

	/* Danger */
	.v-danger {
		background: var(--ab-color-danger);
		color: var(--ab-color-danger-fg);
	}
	.v-danger:not(:disabled):not(.is-disabled):hover {
		background: var(--ab-color-danger-hover);
	}
	.v-danger:not(:disabled):not(.is-disabled):active {
		background: var(--ab-color-danger-active);
	}
</style>
