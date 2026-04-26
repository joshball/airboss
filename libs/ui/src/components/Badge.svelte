<script lang="ts" module>
import type { Tone } from '@ab/themes';
export type BadgeTone = Tone;
export type BadgeSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Small inline status marker. Theme-aware -- reads wash/edge tokens for
 * each semantic tone so colors stay consistent with the host theme.
 */

let {
	tone = 'default',
	size = 'md',
	ariaLabel,
	children,
}: {
	tone?: Tone;
	size?: BadgeSize;
	ariaLabel?: string;
	children: Snippet;
} = $props();
</script>

<span
	class="badge v-{tone} s-{size}"
	aria-label={ariaLabel}
	data-testid="badge-root"
	data-tone={tone}
	data-size={size}
>
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
		min-height: var(--badge-height-sm);
	}

	.s-md {
		padding: var(--space-2xs) var(--space-xs);
		font-size: var(--font-size-sm);
		min-height: var(--badge-height-md);
	}

	.s-lg {
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--font-size-base);
		min-height: var(--badge-height-lg);
	}

	.v-default {
		background: var(--action-neutral-wash);
		color: var(--ink-subtle);
		border-color: var(--action-neutral-edge);
	}

	.v-featured {
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

	.v-accent {
		background: var(--action-default-wash);
		color: var(--accent-code);
		border-color: var(--action-default-edge);
	}
</style>
