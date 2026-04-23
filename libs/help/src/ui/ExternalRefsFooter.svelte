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
	<section class="refs" aria-labelledby="external-refs-heading">
		<h2 id="external-refs-heading">External references</h2>
		<ol class="list">
			{#each refs as ref, i (i)}
				<li class="item">
					<div class="head">
						<a class="title" href={ref.url} target="_blank" rel="noopener noreferrer">{ref.title}</a>
						<span class="badge badge-{ref.source}">{ref.source}</span>
					</div>
					{#if ref.note}
						<p class="note">{ref.note}</p>
					{/if}
					<p class="url"><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.url}</a></p>
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.refs {
		margin-top: var(--ab-space-xl, 2rem);
		padding-top: var(--ab-space-md, 1rem);
		border-top: 1px solid var(--ab-color-border);
	}

	.refs h2 {
		margin: 0 0 var(--ab-space-sm, 0.5rem);
		font-size: 1.125rem;
		font-weight: var(--ab-font-weight-semibold, 600);
		color: var(--ab-color-fg);
	}

	.list {
		margin: 0;
		padding-left: 1.25rem;
		display: grid;
		gap: var(--ab-space-sm, 0.5rem);
	}

	.item {
		color: var(--ab-color-fg);
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.title {
		color: var(--ab-color-primary);
		text-decoration: none;
		font-weight: var(--ab-font-weight-semibold, 600);
	}

	.title:hover,
	.title:focus-visible {
		text-decoration: underline;
	}

	.title:focus-visible {
		outline: 2px solid var(--ab-color-focus-ring);
		outline-offset: 2px;
		border-radius: var(--ab-radius-tight, 3px);
	}

	.badge {
		display: inline-block;
		padding: 0 0.375rem;
		border-radius: var(--ab-radius-tight, 3px);
		font-size: 0.6875rem;
		font-weight: var(--ab-font-weight-semibold, 600);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg-muted);
		border: 1px solid var(--ab-color-border);
	}

	.badge-faa {
		background: var(--ab-color-primary-subtle, var(--ab-color-surface-sunken));
		color: var(--ab-color-primary);
	}

	.note {
		margin: 0.125rem 0 0;
		font-size: 0.875rem;
		color: var(--ab-color-fg-muted);
	}

	.url {
		margin: 0;
		font-size: 0.8125rem;
		word-break: break-all;
	}

	.url a {
		color: var(--ab-color-fg-subtle);
		text-decoration: none;
	}

	.url a:hover,
	.url a:focus-visible {
		color: var(--ab-color-fg);
		text-decoration: underline;
	}

	.url a:focus-visible {
		outline: 2px solid var(--ab-color-focus-ring);
		outline-offset: 2px;
		border-radius: var(--ab-radius-tight, 3px);
	}
</style>
