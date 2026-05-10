<!--
KnowledgeNodePicker -- combobox with live filter for selecting a knowledge
node id (course-reader-and-editor WP, Phase 7).

Per design.md "Knowledge-node picker in the step editor": a single combobox
with a typed-ahead filter against the full node list. Surfaces slug, title,
domain, kind. Archived-lifecycle nodes are filterable but excluded by
default; the include-archived checkbox surfaces them.

The component renders a hidden input named `knowledge_node_id` so it works
inside any standard form action without JS-only submission. The visible
combobox + dropdown drive selection; the hidden input carries the value.
-->
<script lang="ts">
import { NODE_LIFECYCLE_LABELS } from '@ab/constants';
import type { PickerNode } from './knowledge-node-picker-types';

interface Props {
	nodes: PickerNode[];
	/** The hidden input's value (the selected node id). Use $bindable so a
	 *  parent can read the picker's selection without form submission. */
	value: string;
	/** The hidden input's name attribute -- defaults to `knowledge_node_id`. */
	name?: string;
}

let { nodes, value = $bindable(''), name = 'knowledge_node_id' }: Props = $props();

let filterText = $state('');
let includeArchived = $state(false);
let showDropdown = $state(false);

const ARCHIVED_LIFECYCLE = 'archived';

const filteredNodes = $derived.by(() => {
	const term = filterText.trim().toLowerCase();
	return nodes
		.filter((n) => includeArchived || n.lifecycle !== ARCHIVED_LIFECYCLE)
		.filter((n) => {
			if (term === '') return true;
			return (
				n.id.toLowerCase().includes(term) ||
				n.title.toLowerCase().includes(term) ||
				n.domain.toLowerCase().includes(term)
			);
		})
		.slice(0, 50); // cap the dropdown so a fuzzy filter stays snappy
});

const selectedNode = $derived(nodes.find((n) => n.id === value) ?? null);

function selectNode(node: PickerNode): void {
	value = node.id;
	filterText = '';
	showDropdown = false;
}

function lifecycleLabel(lifecycle: string | null): string {
	if (lifecycle === null) return '';
	return NODE_LIFECYCLE_LABELS[lifecycle as keyof typeof NODE_LIFECYCLE_LABELS] ?? lifecycle;
}
</script>

<div class="picker">
	<input type="hidden" {name} {value} />
	{#if selectedNode !== null}
		<div class="selected">
			<span class="selected-title">{selectedNode.title}</span>
			<code class="selected-id">{selectedNode.id}</code>
			<button type="button" class="clear-btn" onclick={() => (value = '')}>Change</button>
		</div>
	{:else}
		<input
			type="text"
			class="filter-input"
			placeholder="Search knowledge nodes by id, title, or domain..."
			bind:value={filterText}
			onfocus={() => (showDropdown = true)}
		/>
		{#if showDropdown}
			<label class="archived-toggle">
				<input type="checkbox" bind:checked={includeArchived} />
				Include archived
			</label>
			<ul class="dropdown" role="listbox">
				{#each filteredNodes as node (node.id)}
					<li>
						<button type="button" class="dropdown-item" onclick={() => selectNode(node)}>
							<span class="item-title">{node.title}</span>
							<span class="item-meta">
								<code>{node.id}</code>
								<span class="domain-badge">{node.domain}</span>
								{#if node.lifecycle !== null}
									<span class="lifecycle-badge lifecycle-{node.lifecycle}">{lifecycleLabel(node.lifecycle)}</span>
								{/if}
							</span>
						</button>
					</li>
				{/each}
				{#if filteredNodes.length === 0}
					<li class="empty">No nodes match the filter.</li>
				{/if}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		position: relative;
	}

	.selected {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.selected-title {
		font-weight: 600;
		color: var(--ink-body);
	}

	.selected-id {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.clear-btn {
		margin-left: auto;
		background: transparent;
		border: 1px solid var(--edge-default);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
		cursor: pointer;
		color: var(--ink-body);
	}

	.clear-btn:hover {
		background: var(--ink-inverse);
		border-color: var(--action-default-edge);
	}

	.filter-input {
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		font-size: var(--type-definition-body-size);
	}

	.archived-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.dropdown {
		list-style: none;
		padding: 0;
		margin: 0;
		max-height: 20rem;
		overflow-y: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--ink-inverse);
	}

	.dropdown-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--edge-default);
		cursor: pointer;
		font-size: var(--type-definition-body-size);
		color: var(--ink-body);
	}

	.dropdown-item:hover {
		background: var(--surface-muted);
	}

	.item-title {
		font-weight: 500;
	}

	.item-meta {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		flex-wrap: wrap;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.item-meta code {
		font-family: var(--font-family-mono);
	}

	.domain-badge,
	.lifecycle-badge {
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		background: var(--surface-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.lifecycle-archived {
		background: var(--surface-sunken);
		color: var(--ink-faint);
	}

	.empty {
		padding: var(--space-md);
		color: var(--ink-faint);
		font-style: italic;
		text-align: center;
	}
</style>
