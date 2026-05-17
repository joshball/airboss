<!--
KnowledgeNodePicker -- WAI-ARIA combobox with live filter for selecting a
knowledge node id (course-reader-and-editor WP, Phase 7).

Per design.md "Knowledge-node picker in the step editor": a single combobox
with a typed-ahead filter against the full node list. Surfaces slug, title,
domain, lifecycle.

Keyboard: ArrowDown/ArrowUp move the active option, Enter selects it,
Escape closes the listbox, Home/End jump to the first/last option. The
listbox dismisses on outside click / focusout. `aria-activedescendant`
tracks the active option for screen readers.

The component renders a hidden input named `knowledge_node_id` so it works
inside any standard form action without JS-only submission. The visible
combobox + dropdown drive selection; the hidden input carries the value.
-->
<script lang="ts">
import { KNOWLEDGE_NODE_PICKER_LIMIT, NODE_LIFECYCLE_LABELS } from '@ab/constants';
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
let showDropdown = $state(false);
let activeIndex = $state(-1);
let inputEl = $state<HTMLInputElement | null>(null);
let changeBtnEl = $state<HTMLButtonElement | null>(null);
let pickerEl = $state<HTMLDivElement | null>(null);

// Stable ids so `aria-activedescendant` / `aria-controls` can reference
// the listbox + each option. Per-instance so two pickers on one page do
// not collide.
const listboxId = `knp-listbox-${Math.random().toString(36).slice(2, 9)}`;
const optionId = (index: number): string => `${listboxId}-opt-${index}`;

const filteredNodes = $derived.by(() => {
	const term = filterText.trim().toLowerCase();
	return nodes
		.filter((n) => {
			if (term === '') return true;
			return (
				n.id.toLowerCase().includes(term) ||
				n.title.toLowerCase().includes(term) ||
				n.domain.toLowerCase().includes(term)
			);
		})
		.slice(0, KNOWLEDGE_NODE_PICKER_LIMIT);
});

const selectedNode = $derived(nodes.find((n) => n.id === value) ?? null);

function openDropdown(): void {
	showDropdown = true;
}

function closeDropdown(): void {
	showDropdown = false;
	activeIndex = -1;
}

function selectNode(node: PickerNode): void {
	value = node.id;
	filterText = '';
	closeDropdown();
}

function selectActive(): void {
	const node = filteredNodes[activeIndex];
	if (node !== undefined) selectNode(node);
}

function moveActive(delta: number): void {
	const count = filteredNodes.length;
	if (count === 0) {
		activeIndex = -1;
		return;
	}
	const next = activeIndex + delta;
	if (next < 0) activeIndex = 0;
	else if (next >= count) activeIndex = count - 1;
	else activeIndex = next;
}

function onInputKeydown(event: KeyboardEvent): void {
	switch (event.key) {
		case 'ArrowDown':
			event.preventDefault();
			if (!showDropdown) openDropdown();
			moveActive(1);
			break;
		case 'ArrowUp':
			event.preventDefault();
			if (!showDropdown) openDropdown();
			moveActive(-1);
			break;
		case 'Home':
			if (showDropdown && filteredNodes.length > 0) {
				event.preventDefault();
				activeIndex = 0;
			}
			break;
		case 'End':
			if (showDropdown && filteredNodes.length > 0) {
				event.preventDefault();
				activeIndex = filteredNodes.length - 1;
			}
			break;
		case 'Enter':
			if (showDropdown && activeIndex >= 0) {
				event.preventDefault();
				selectActive();
				focusChangeBtn();
			}
			break;
		case 'Escape':
			if (showDropdown) {
				event.preventDefault();
				closeDropdown();
			}
			break;
	}
}

// Outside-click / focusout dismissal: close the listbox when focus leaves
// the picker. The `relatedTarget` check avoids closing while focus moves
// within the picker.
function onFocusOut(event: FocusEvent): void {
	const next = event.relatedTarget;
	if (next instanceof Node && pickerEl?.contains(next)) return;
	closeDropdown();
}

function lifecycleLabel(lifecycle: string | null): string {
	if (lifecycle === null) return '';
	return NODE_LIFECYCLE_LABELS[lifecycle as keyof typeof NODE_LIFECYCLE_LABELS] ?? lifecycle;
}

// Move focus to the "Change" button after a selection so a keyboard user
// is not stranded on a destroyed element; back to the input on clear.
function focusChangeBtn(): void {
	queueMicrotask(() => changeBtnEl?.focus());
}
function clearSelection(): void {
	value = '';
	queueMicrotask(() => inputEl?.focus());
}
</script>

<div class="picker" bind:this={pickerEl} onfocusout={onFocusOut}>
	<input type="hidden" {name} {value} />
	{#if selectedNode !== null}
		<div class="selected">
			<span class="selected-title">{selectedNode.title}</span>
			<code class="selected-id">{selectedNode.id}</code>
			<button type="button" class="clear-btn" bind:this={changeBtnEl} onclick={clearSelection}>Change</button>
		</div>
		<span class="sr-only" role="status">Selected: {selectedNode.title}</span>
	{:else}
		<input
			type="text"
			class="filter-input"
			role="combobox"
			aria-label="Search knowledge nodes"
			aria-expanded={showDropdown}
			aria-controls={listboxId}
			aria-autocomplete="list"
			aria-activedescendant={showDropdown && activeIndex >= 0 ? optionId(activeIndex) : undefined}
			placeholder="Search knowledge nodes by id, title, or domain..."
			bind:this={inputEl}
			bind:value={filterText}
			onfocus={openDropdown}
			onkeydown={onInputKeydown}
		/>
		{#if showDropdown}
			{#if filteredNodes.length > 0}
				<ul class="dropdown" role="listbox" id={listboxId} aria-label="Knowledge node results">
					{#each filteredNodes as node, index (node.id)}
						<li
							class="dropdown-item"
							class:active={index === activeIndex}
							role="option"
							id={optionId(index)}
							aria-selected={index === activeIndex}
							onmousedown={(e) => {
								// `mousedown` (not `click`) so the selection lands
								// before the input's focusout closes the listbox.
								e.preventDefault();
								selectNode(node);
								focusChangeBtn();
							}}
						>
							<span class="item-title">{node.title}</span>
							<span class="item-meta">
								<code>{node.id}</code>
								<span class="domain-badge">{node.domain}</span>
								{#if node.lifecycle !== null}
									<span class="lifecycle-badge lifecycle-{node.lifecycle}">{lifecycleLabel(node.lifecycle)}</span>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty" role="status">No nodes match the filter.</p>
			{/if}
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

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
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
		border-bottom: 1px solid var(--edge-default);
		cursor: pointer;
		font-size: var(--type-definition-body-size);
		color: var(--ink-body);
	}

	.dropdown-item:hover,
	.dropdown-item.active {
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

	.empty {
		padding: var(--space-md);
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
		text-align: center;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--ink-inverse);
	}
</style>
