<script lang="ts">
/**
 * `<FollowUpBadge>` -- the small "↻ follow-up" pill rendered on
 * `<NoteCard>` and `<NoteDetail>`. Two variants: open (default) and
 * done. Pure visual primitive.
 */

let {
	variant = 'open',
}: {
	variant?: 'open' | 'done';
} = $props();
</script>

<span class="badge" data-variant={variant} data-testid="follow-up-badge">
	{#if variant === 'done'}
		<span aria-hidden="true">✓</span>
		<span>Follow-up done</span>
	{:else}
		<span aria-hidden="true">↻</span>
		<span>Follow-up</span>
	{/if}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		padding: var(--space-3xs) var(--space-xs);
		border-radius: var(--radius-pill);
		font-size: var(--type-ui-label-size);
		font-weight: 500;
		border: 1px solid currentColor;
	}
	.badge[data-variant='open'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
	}
	.badge[data-variant='done'] {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}
</style>
