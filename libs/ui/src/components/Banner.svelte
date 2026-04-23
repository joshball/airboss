<script lang="ts" module>
export type BannerVariant = 'info' | 'success' | 'warning' | 'danger';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Inline message banner. Used for flash / toast-style notices (e.g. `?created=1`
 * success) and for form-level errors. Role depends on variant so assistive
 * tech announces appropriately.
 *
 * `dismissible=true` renders an X button; pass `onDismiss` to handle it.
 */

let {
	variant = 'info',
	title,
	dismissible = false,
	onDismiss,
	children,
}: {
	variant?: BannerVariant;
	title?: string;
	dismissible?: boolean;
	onDismiss?: () => void;
	children: Snippet;
} = $props();

const role = $derived(variant === 'danger' ? 'alert' : 'status');
</script>

<div class="banner v-{variant}" {role}>
	<div class="content">
		{#if title}
			<p class="title">{title}</p>
		{/if}
		<div class="body">{@render children()}</div>
	</div>
	{#if dismissible && onDismiss}
		<button
			type="button"
			class="dismiss"
			aria-label="Dismiss"
			onclick={onDismiss}
		>
			x
		</button>
	{/if}
</div>

<style>
	.banner {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
	}

	.content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.title {
		margin: 0;
		font-weight: var(--font-weight-semibold);
	}

	.body {
		line-height: var(--line-height-normal);
	}

	.dismiss {
		appearance: none;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0 var(--space-2xs);
		font-size: var(--font-size-base);
		line-height: 1;
		opacity: 0.7;
	}

	.dismiss:hover {
		opacity: 1;
	}

	/*
	 * Variant treatments read the signal role bundle:
	 *   background: wash (tinted fill)
	 *   border:     edge (tinted stroke)
	 *   color:      solid signal color for legible text on the wash.
	 *               The role system doesn't ship a separate "ink-on-wash"
	 *               token; the solid hue is dark enough on its own wash
	 *               (same approach as the pre-foundation theme).
	 */
	.v-info {
		background: var(--signal-info-wash);
		border-color: var(--signal-info-edge);
		color: var(--signal-info);
	}

	.v-success {
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
		color: var(--signal-success);
	}

	.v-warning {
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
		color: var(--signal-warning);
	}

	.v-danger {
		background: var(--signal-danger-wash);
		border-color: var(--signal-danger-edge);
		color: var(--signal-danger);
	}
</style>
