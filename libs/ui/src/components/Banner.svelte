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
		gap: var(--ab-space-sm);
		padding: var(--ab-space-sm) var(--ab-space-md);
		border: 1px solid transparent;
		border-radius: var(--ab-radius-sm);
		font-size: var(--ab-font-size-sm);
	}

	.content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-2xs);
	}

	.title {
		margin: 0;
		font-weight: var(--ab-font-weight-semibold);
	}

	.body {
		line-height: var(--ab-line-height-normal);
	}

	.dismiss {
		appearance: none;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0 var(--ab-space-2xs);
		font-size: var(--ab-font-size-base);
		line-height: 1;
		opacity: 0.7;
	}

	.dismiss:hover {
		opacity: 1;
	}

	.v-info {
		background: var(--ab-color-info-subtle);
		border-color: var(--ab-color-info-subtle-border);
		color: var(--ab-color-info-active);
	}

	.v-success {
		background: var(--ab-color-success-subtle);
		border-color: var(--ab-color-success-subtle-border);
		color: var(--ab-color-success-active);
	}

	.v-warning {
		background: var(--ab-color-warning-subtle);
		border-color: var(--ab-color-warning-subtle-border);
		color: var(--ab-color-warning-active);
	}

	.v-danger {
		background: var(--ab-color-danger-subtle);
		border-color: var(--ab-color-danger-subtle-border);
		color: var(--ab-color-danger-active);
	}
</style>
