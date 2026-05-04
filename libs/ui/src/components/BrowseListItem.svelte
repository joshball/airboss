<script lang="ts" module>
export interface BrowseListItemProps {
	/** Required link target; the whole card is a clickable `<a>`. */
	href: string;
	/** DOM `id` for scroll-into-view + `:target` highlight (e.g. `card-${id}`). */
	id?: string;
	/** Extra outline + glow when this row was just created; consumers compute the boolean. */
	justCreated?: boolean;
	/** Headline / first line of the row. */
	title: import('svelte').Snippet;
	/** Optional badge row (domain / type / status / source pills). */
	meta?: import('svelte').Snippet;
	/** Optional inline strip of small key:value stats. */
	stats?: import('svelte').Snippet;
	/** Optional extra block below the meta+stats row (e.g. removed-comment, mastery bar). */
	extra?: import('svelte').Snippet;
	/** Optional sibling rendered next to the link (e.g. a Restore form). */
	trailing?: import('svelte').Snippet;
}
</script>

<script lang="ts">
let { href, id, justCreated = false, title, meta, stats, extra, trailing }: BrowseListItemProps = $props();
</script>

<li
	class="card"
	class:just-created={justCreated}
	{id}
	data-testid="browselistitem-root"
	data-state={justCreated ? 'just-created' : 'idle'}
>
	<a class="card-link" {href} data-testid="browselistitem-link">
		<div class="card-title" data-testid="browselistitem-title">{@render title()}</div>
		{#if meta || stats}
			<div class="card-row">
				{#if meta}
					<div class="card-meta" data-testid="browselistitem-meta">{@render meta()}</div>
				{/if}
				{#if stats}
					<div class="card-stats" aria-label="Details" data-testid="browselistitem-stats">{@render stats()}</div>
				{/if}
			</div>
		{/if}
		{#if extra}
			<div data-testid="browselistitem-extra">{@render extra()}</div>
		{/if}
	</a>
	{#if trailing}
		<div data-testid="browselistitem-trailing">{@render trailing()}</div>
	{/if}
</li>

<style>
	.card {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
	}

	.card:hover {
		border-color: var(--action-default-edge);
		box-shadow: var(--shadow-sm);
	}

	/*
	 * Just-created highlight: soft wash-tinted halo with a stronger
	 * border-color, fading to the resting state over the first few seconds
	 * so the row settles after the user has registered the change. The
	 * previous solid 3px halo of `--signal-success` read more like an
	 * error/active state than a celebration; the wash variant keeps the
	 * "see what you just created" intent without shouting.
	 */
	.card.just-created {
		border-color: var(--signal-success);
		box-shadow: 0 0 0 3px var(--signal-success-wash);
		/* lint-disable-token-enforcement: animation duration tuned per UX review; not a global motion token */
		animation: just-created-fade 4s ease-out forwards;
	}

	@keyframes just-created-fade {
		from {
			border-color: var(--signal-success);
			box-shadow: 0 0 0 3px var(--signal-success-wash);
		}
		to {
			border-color: var(--edge-default);
			box-shadow: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card.just-created {
			animation: none;
		}
	}

	.card-link {
		display: block;
		padding: var(--space-sm) var(--space-md);
		text-decoration: none;
		color: inherit;
		border-radius: var(--radius-md);
	}

	.card-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.card-title {
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
		line-height: 1.4;
	}

	.card-row {
		margin-top: var(--space-2xs);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-md);
		row-gap: var(--space-2xs);
	}

	.card-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.card-stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
	}

	/*
	 * 720px is the per-component "row pair collapses" threshold for the
	 * label/extra split. Slightly above the shared `--ab-breakpoint-md`
	 * (640px) because a list row needs more horizontal headroom than a
	 * page layout to keep both columns readable. Justified inline rather
	 * than snapping to the named scale.
	 */
	@media (max-width: 720px) {
		.card-row {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
