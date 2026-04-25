<script lang="ts" module>
import type { Tone } from '@ab/themes';
export type BannerTone = Tone;
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Inline message banner. Used for flash / toast-style notices (e.g.
 * `?created=1` success) and for form-level errors. Role depends on tone
 * so assistive tech announces appropriately.
 *
 * `dismissible=true` renders an X button; pass `onDismiss` to handle it.
 */

let {
	tone = 'info',
	title,
	dismissible = false,
	onDismiss,
	children,
}: {
	tone?: Tone;
	title?: string;
	dismissible?: boolean;
	onDismiss?: () => void;
	children: Snippet;
} = $props();

const role = $derived(tone === 'danger' ? 'alert' : 'status');
</script>

<div class="banner v-{tone}" {role}>
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

	.dismiss:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
		opacity: 1;
	}

	.v-default {
		background: var(--action-neutral-wash);
		border-color: var(--action-neutral-edge);
		color: var(--ink-body);
	}

	.v-featured {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
		color: var(--action-default);
	}

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
		background: var(--action-hazard-wash);
		border-color: var(--action-hazard-edge);
		color: var(--action-hazard-active);
	}

	.v-muted {
		background: var(--action-neutral-wash);
		border-color: var(--action-neutral-edge);
		color: var(--ink-subtle);
	}

	.v-accent {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
		color: var(--accent-code);
	}
</style>
