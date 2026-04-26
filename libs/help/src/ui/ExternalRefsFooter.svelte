<script lang="ts">
import type { ExternalRef } from '../schema/external-ref';

/**
 * Footer block rendered at the bottom of a help/concept page that has
 * `externalRefs`. Styled like an academic paper's References section:
 * title, optional note, source badge, and clickable URL that opens in a
 * new tab with a safe `rel`.
 */

let { refs }: { refs: readonly ExternalRef[] | undefined } = $props();
</script>

{#if refs && refs.length > 0}
	<section class="refs" aria-labelledby="external-refs-heading" data-testid="externalrefsfooter-root">
		<h2 id="external-refs-heading" data-testid="externalrefsfooter-heading">External references</h2>
		<ol class="list" data-testid="externalrefsfooter-list">
			{#each refs as ref, i (i)}
				<li class="item" data-testid={`externalrefsfooter-item-${i}`}>
					<div class="head">
						<a class="title" href={ref.url} target="_blank" rel="noopener noreferrer" data-testid={`externalrefsfooter-title-${i}`}>{ref.title}</a>
						<span class="badge badge-{ref.source}" data-testid={`externalrefsfooter-source-${i}`}>{ref.source}</span>
					</div>
					{#if ref.note}
						<p class="note" data-testid={`externalrefsfooter-note-${i}`}>{ref.note}</p>
					{/if}
					<p class="url"><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.url}</a></p>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.refs {
		margin-top: var(--space-xl);
		padding-top: var(--space-md);
		border-top: 1px solid var(--edge-default);
	}

	.refs h2 {
		margin: 0 0 var(--space-sm);
		font-size: 1.125rem;
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.list {
		margin: 0;
		padding-left: 1.25rem;
		display: grid;
		gap: var(--space-sm);
	}

	.item {
		color: var(--ink-body);
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.title {
		color: var(--action-default);
		text-decoration: none;
		font-weight: var(--font-weight-semibold);
	}

	.title:hover,
	.title:focus-visible {
		text-decoration: underline;
	}

	.title:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}

	.badge {
		display: inline-block;
		padding: 0 0.375rem;
		border-radius: var(--radius-xs);
		font-size: 0.6875rem;
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--surface-sunken);
		color: var(--ink-muted);
		border: 1px solid var(--edge-default);
	}

	.badge-faa {
		background: var(--action-default-wash);
		color: var(--action-default);
	}

	.note {
		margin: 0.125rem 0 0;
		font-size: 0.875rem;
		color: var(--ink-muted);
	}

	.url {
		margin: 0;
		font-size: 0.8125rem;
		word-break: break-all;
	}

	.url a {
		color: var(--ink-subtle);
		text-decoration: none;
	}

	.url a:hover,
	.url a:focus-visible {
		color: var(--ink-body);
		text-decoration: underline;
	}

	.url a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}
</style>
