<script lang="ts" module>
export type BadgeVariant = 'default' | 'info' | 'success' | 'warning' | 'danger' | 'muted';
export type BadgeSize = 'sm' | 'md';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Small inline status marker. Theme-aware -- reads subtle/border tokens
 * for each semantic variant so colors stay consistent with the host theme.
 */

let {
	variant = 'default',
	size = 'md',
	ariaLabel,
	children,
}: {
	variant?: BadgeVariant;
	size?: BadgeSize;
	ariaLabel?: string;
	children: Snippet;
} = $props();
</script>

<span class="badge v-{variant} s-{size}" aria-label={ariaLabel}>
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--ab-space-2xs);
		border: 1px solid transparent;
		border-radius: var(--ab-radius-sm);
		font-family: inherit;
		font-weight: var(--ab-font-weight-medium);
		letter-spacing: var(--ab-letter-spacing-normal);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.s-sm {
		padding: 0 var(--ab-space-2xs);
		font-size: var(--ab-font-size-xs);
		min-height: 1rem;
	}

	.s-md {
		padding: var(--ab-space-2xs) var(--ab-space-xs);
		font-size: var(--ab-font-size-sm);
		min-height: 1.25rem;
	}

	.v-default {
		background: var(--ab-color-primary-subtle);
		color: var(--ab-color-primary);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.v-info {
		background: var(--ab-color-info-subtle);
		color: var(--ab-color-info);
		border-color: var(--ab-color-info-subtle-border);
	}

	.v-success {
		background: var(--ab-color-success-subtle);
		color: var(--ab-color-success);
		border-color: var(--ab-color-success-subtle-border);
	}

	.v-warning {
		background: var(--ab-color-warning-subtle);
		color: var(--ab-color-warning);
		border-color: var(--ab-color-warning-subtle-border);
	}

	.v-danger {
		background: var(--ab-color-danger-subtle);
		color: var(--ab-color-danger);
		border-color: var(--ab-color-danger-subtle-border);
	}

	.v-muted {
		background: var(--ab-color-muted-subtle);
		color: var(--ab-color-fg-subtle);
		border-color: var(--ab-color-muted-subtle-border);
	}
</style>
