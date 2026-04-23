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
		gap: var(--space-xs);
		font-family: inherit;
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-normal);
		border: 1px solid transparent;
		border-radius: var(--control-radius);
		cursor: pointer;
		text-decoration: none;
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast),
			color var(--motion-fast);
		font-variant-numeric: tabular-nums;
	}

	.btn.full {
		display: flex;
		width: 100%;
	}

	.btn:focus-visible {
		outline: var(2px) solid var(--focus-ring);
		outline-offset: var(2px);
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
		padding: var(--control-padding-y-sm) var(--control-padding-x-sm);
		font-size: var(--control-font-size-sm);
	}

	.s-md {
		padding: var(--control-padding-y-md) var(--control-padding-x-md);
		font-size: var(--control-font-size-md);
	}

	.s-lg {
		padding: var(--control-padding-y-lg) var(--control-padding-x-lg);
		font-size: var(--control-font-size-lg);
	}

	/* Primary */
	.v-primary {
		background: var(--action-default);
		color: var(--action-default-ink);
	}
	.v-primary:not(:disabled):not(.is-disabled):hover {
		background: var(--action-default-hover);
	}
	.v-primary:not(:disabled):not(.is-disabled):active {
		background: var(--action-default-active);
	}

	/* Secondary */
	.v-secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}
	.v-secondary:not(:disabled):not(.is-disabled):hover {
		background: var(--edge-default);
	}
	.v-secondary:not(:disabled):not(.is-disabled):active {
		background: var(--edge-strong);
	}

	/* Ghost */
	.v-ghost {
		background: transparent;
		color: var(--ink-muted);
	}
	.v-ghost:not(:disabled):not(.is-disabled):hover {
		background: var(--surface-sunken);
		color: var(--ink-body);
	}
	.v-ghost:not(:disabled):not(.is-disabled):active {
		background: var(--edge-default);
	}

	/* Danger */
	.v-danger {
		background: var(--action-hazard);
		color: var(--action-hazard-ink);
	}
	.v-danger:not(:disabled):not(.is-disabled):hover {
		background: var(--action-hazard-hover);
	}
	.v-danger:not(:disabled):not(.is-disabled):active {
		background: var(--action-hazard-active);
	}
</style>
