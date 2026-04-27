<script lang="ts">
import { ROUTES } from '@ab/constants';

interface CitingNode {
	id: string;
	title: string;
	domain: string;
}

let { nodes, scope }: { nodes: CitingNode[]; scope: string } = $props();
</script>

<aside class="citing-nodes" aria-label="Knowledge nodes that cite this {scope}">
	<h3>Knowledge nodes citing this {scope}</h3>
	{#if nodes.length === 0}
		<p class="empty">No knowledge nodes cite this {scope} yet.</p>
	{:else}
		<ul>
			{#each nodes as node (node.id)}
				<li>
					<a href={ROUTES.KNOWLEDGE_SLUG(node.id)}>
						<span class="title">{node.title}</span>
						<span class="domain">{node.domain}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</aside>

<style>
	.citing-nodes {
		margin-top: var(--space-lg);
		padding: var(--space-md);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
	}
	.citing-nodes h3 {
		margin: 0 0 var(--space-sm) 0;
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-semibold);
	}
	.empty {
		margin: 0;
		color: var(--ink-muted);
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	li a {
		display: flex;
		justify-content: space-between;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
	}
	li a:hover,
	li a:focus-visible {
		background: var(--surface-raised);
		outline: none;
	}
	.title {
		font-weight: 500;
	}
	.domain {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
	}
</style>
