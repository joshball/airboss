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
		gap: var(--space-2xs);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		font-family: inherit;
		font-weight: var(--font-weight-medium);
		letter-spacing: var(--letter-spacing-normal);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.s-sm {
		padding: 0 var(--space-2xs);
		font-size: var(--font-size-xs);
		min-height: 1rem;
	}

	.s-md {
		padding: var(--space-2xs) var(--space-xs);
		font-size: var(--font-size-sm);
		min-height: 1.25rem;
	}

	.v-default {
		background: var(--action-default-wash);
		color: var(--action-default);
		border-color: var(--action-default-edge);
	}

	.v-info {
		background: var(--signal-info-wash);
		color: var(--signal-info);
		border-color: var(--signal-info-edge);
	}

	.v-success {
		background: var(--signal-success-wash);
		color: var(--signal-success);
		border-color: var(--signal-success-edge);
	}

	.v-warning {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
		border-color: var(--signal-warning-edge);
	}

	.v-danger {
		background: var(--action-hazard-wash);
		color: var(--action-hazard);
		border-color: var(--action-hazard-edge);
	}

	.v-muted {
		background: var(--action-neutral-wash);
		color: var(--ink-subtle);
		border-color: var(--action-neutral-edge);
	}
</style>
