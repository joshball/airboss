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
 * Reads all colors via the `--button-{variant}-*` role tokens emitted by
 * the theme system. Variants map to the control contract's button
 * variants: primary -> primary, secondary -> default, ghost -> ghost,
 * danger -> hazard.
 *
 * Loading state: pass `loading` + optionally `loadingLabel` to replace
 * the label while the button is disabled. Callers don't need to track
 * disabled separately -- passing `loading` forces disabled.
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
		data-testid="button-root"
		data-variant={variant}
		data-size={size}
		data-state={loading ? 'loading' : isDisabled ? 'disabled' : 'idle'}
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
		data-testid="button-root"
		data-variant={variant}
		data-size={size}
		data-state={loading ? 'loading' : isDisabled ? 'disabled' : 'idle'}
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
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
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
		min-height: var(--button-height-sm);
		padding: var(--control-padding-y-sm) var(--control-padding-x-sm);
		font-size: var(--control-font-size-sm);
	}

	.s-md {
		min-height: var(--button-height-md);
		padding: var(--control-padding-y-md) var(--control-padding-x-md);
		font-size: var(--control-font-size-md);
	}

	.s-lg {
		min-height: var(--button-height-lg);
		padding: var(--control-padding-y-lg) var(--control-padding-x-lg);
		font-size: var(--control-font-size-lg);
	}

	/* Primary -> control.button.primary */
	.v-primary {
		background: var(--button-primary-bg);
		color: var(--button-primary-ink);
		border-color: var(--button-primary-border);
	}
	.v-primary:not(:disabled):not(.is-disabled):hover {
		background: var(--button-primary-hover-bg);
		color: var(--button-primary-hover-ink);
	}
	.v-primary:not(:disabled):not(.is-disabled):active {
		background: var(--button-primary-active-bg);
	}
	.v-primary:disabled,
	.v-primary.is-disabled {
		background: var(--button-primary-disabled-bg);
		color: var(--button-primary-disabled-ink);
	}

	/* Secondary -> control.button.default (neutral surface) */
	.v-secondary {
		background: var(--button-default-bg);
		color: var(--button-default-ink);
		border-color: var(--button-default-border);
	}
	.v-secondary:not(:disabled):not(.is-disabled):hover {
		background: var(--button-default-hover-bg);
		color: var(--button-default-hover-ink);
	}
	.v-secondary:not(:disabled):not(.is-disabled):active {
		background: var(--button-default-active-bg);
	}
	.v-secondary:disabled,
	.v-secondary.is-disabled {
		background: var(--button-default-disabled-bg);
		color: var(--button-default-disabled-ink);
	}

	/* Ghost -> control.button.ghost */
	.v-ghost {
		background: var(--button-ghost-bg);
		color: var(--button-ghost-ink);
		border-color: var(--button-ghost-border);
	}
	.v-ghost:not(:disabled):not(.is-disabled):hover {
		background: var(--button-ghost-hover-bg);
		color: var(--button-ghost-hover-ink);
	}
	.v-ghost:not(:disabled):not(.is-disabled):active {
		background: var(--button-ghost-active-bg);
	}
	.v-ghost:disabled,
	.v-ghost.is-disabled {
		background: var(--button-ghost-disabled-bg);
		color: var(--button-ghost-disabled-ink);
	}

	/* Danger -> control.button.hazard */
	.v-danger {
		background: var(--button-hazard-bg);
		color: var(--button-hazard-ink);
		border-color: var(--button-hazard-border);
	}
	.v-danger:not(:disabled):not(.is-disabled):hover {
		background: var(--button-hazard-hover-bg);
		color: var(--button-hazard-hover-ink);
	}
	.v-danger:not(:disabled):not(.is-disabled):active {
		background: var(--button-hazard-active-bg);
	}
	.v-danger:disabled,
	.v-danger.is-disabled {
		background: var(--button-hazard-disabled-bg);
		color: var(--button-hazard-disabled-ink);
	}
</style>
