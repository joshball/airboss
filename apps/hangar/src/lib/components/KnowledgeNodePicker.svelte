<script lang="ts">
import { domainLabel } from '@ab/constants';

interface NodeOption {
	id: string;
	title: string;
	domain: string;
	lifecycle: string;
}

interface Props {
	nodes: NodeOption[];
	value: string;
	name?: string;
	required?: boolean;
}

let { nodes, value = $bindable(''), name = 'knowledge_node_id', required = false }: Props = $props();

let query = $state('');
let includeArchived = $state(false);

const filtered = $derived.by(() => {
	const q = query.trim().toLowerCase();
	return nodes.filter((n) => {
		if (!includeArchived && n.lifecycle === 'archived') return false;
		if (q === '') return true;
		return n.id.toLowerCase().includes(q) || n.title.toLowerCase().includes(q) || n.domain.toLowerCase().includes(q);
	});
});

const selectedTitle = $derived(value === '' ? '' : (nodes.find((n) => n.id === value)?.title ?? value));
</script>

<div class="picker">
	<input type="hidden" {name} {value} {required} />
	<label class="search-label">
		<span class="label">Search</span>
		<input
			type="search"
			bind:value={query}
			placeholder="Type to filter by id, title, or domain"
			autocomplete="off"
		/>
	</label>
	<label class="checkbox">
		<input type="checkbox" bind:checked={includeArchived} />
		Include archived nodes
	</label>

	{#if value !== ''}
		<p class="selected">
			Selected: <code>{value}</code> -- {selectedTitle}
			<button type="button" onclick={() => (value = '')} class="clear-btn">Clear</button>
		</p>
	{/if}

	<ul class="results" role="listbox" aria-label="Knowledge nodes">
		{#if filtered.length === 0}
			<li class="empty">No matching nodes.</li>
		{:else}
			{#each filtered.slice(0, 50) as node (node.id)}
				<li>
					<button
						type="button"
						class="result-row"
						class:selected={node.id === value}
						onclick={() => (value = node.id)}
						aria-pressed={node.id === value}
					>
						<code class="node-id">{node.id}</code>
						<span class="node-title">{node.title}</span>
						<span class="node-meta">{domainLabel(node.domain)} -- {node.lifecycle}</span>
					</button>
				</li>
			{/each}
			{#if filtered.length > 50}
				<li class="more">{filtered.length - 50} more -- refine your search.</li>
			{/if}
		{/if}
	</ul>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.search-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	input[type='search'] {
		font: inherit;
		padding: var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--ink-body);
	}

	.checkbox {
		display: flex;
		align-items: center;
		gap: var(--space-2xs);
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}

	.selected {
		margin: 0;
		padding: var(--space-sm);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.selected code {
		font-family: var(--font-family-mono, monospace);
		color: var(--ink-strong);
	}

	.clear-btn {
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--font-size-xs);
		color: var(--ink-body);
		cursor: pointer;
	}

	.results {
		list-style: none;
		padding: 0;
		margin: 0;
		max-height: 14rem;
		overflow-y: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
	}

	.empty,
	.more {
		padding: var(--space-sm);
		font-size: var(--font-size-sm);
		color: var(--ink-faint);
		text-align: center;
	}

	.result-row {
		display: grid;
		grid-template-columns: 16rem 1fr auto;
		gap: var(--space-md);
		align-items: center;
		width: 100%;
		padding: var(--space-2xs) var(--space-sm);
		border: none;
		background: transparent;
		text-align: left;
		font: inherit;
		color: var(--ink-body);
		cursor: pointer;
		border-bottom: 1px solid var(--edge-subtle);
	}

	.result-row:hover {
		background: var(--surface-sunken);
	}

	.result-row.selected {
		background: var(--surface-sunken);
		font-weight: var(--font-weight-semibold);
	}

	.node-id {
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}

	.node-title {
		font-size: var(--font-size-sm);
	}

	.node-meta {
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
	}
</style>
