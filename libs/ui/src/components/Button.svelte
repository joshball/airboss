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
 * reskins under sectional vs flightdeck.
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
		onclick={onclick}
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
		/* Package #4 introduces `--button-radius` and `--button-padding-*`
		   component tokens for surgical per-theme overrides. Until then
		   read the Layer 0 scale directly. */
		border-radius: var(--radius-md);
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
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.btn:disabled,
	.btn.is-disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	/* Sizes -- read the Layer 0 spacing/type scale directly.
	   Package #4's Button component tokens will take over here. */
	.s-sm {
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--font-size-sm);
	}

	.s-md {
		padding: var(--space-sm) var(--space-md);
		font-size: var(--font-size-base);
	}

	.s-lg {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-lg);
	}

	/* Primary -- action-default bundle */
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

	/* Secondary -- subtle surface + strong edge */
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

	/* Ghost -- transparent, neutral ink, hover reveals surface-sunken */
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

	/* Danger -- action-hazard bundle */
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
