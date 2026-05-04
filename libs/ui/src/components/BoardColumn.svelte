<script lang="ts" module>
import type { Snippet } from 'svelte';

export interface BoardColumnProps {
	/** Column id propagated to drop handlers via `dataTransfer`. */
	readonly columnId: string;
	/** Display name -- the bare column header. */
	readonly name: string;
	/** Count badge value (item count for this column). */
	readonly count: number;
	/** Whether the column is currently a drop-target highlight. */
	readonly isDropTarget?: boolean;
	/** Cards rendered into the column body. */
	readonly children: Snippet;
	/** Notify when a card lands in this column. The handler receives the
	 * dragged item id (read from `application/x-airboss-card-id`). */
	readonly onDrop: (cardId: string) => void;
}
</script>

<script lang="ts">
/**
 * Kanban column shell with HTML5 drop support. A `card` element sets
 * `dataTransfer.setData('application/x-airboss-card-id', id)` on
 * `dragstart`; the column reads the same key on drop and calls `onDrop`.
 *
 * Keyboard alternative: drop is the *visible* affordance, but cards expose
 * their own "Move to..." button per item that calls the same form action
 * directly. The column itself doesn't need to be keyboard-droppable -- the
 * card-level button covers the kbd-only path.
 */

let { columnId, name, count, isDropTarget = false, children, onDrop }: BoardColumnProps = $props();

let active = $state(false);

function onDragOver(event: DragEvent) {
	event.preventDefault();
	if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
	active = true;
}

function onDragLeave() {
	active = false;
}

function onDropEvent(event: DragEvent) {
	event.preventDefault();
	active = false;
	const id = event.dataTransfer?.getData('application/x-airboss-card-id') ?? '';
	if (id !== '') onDrop(id);
}
</script>

<section
	class="column"
	class:drop-active={active || isDropTarget}
	data-column-id={columnId}
	aria-label={`${name} (${count} items)`}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDropEvent}
>
	<header class="head">
		<h2>{name}</h2>
		<span class="count" aria-hidden="true">{count}</span>
	</header>
	<div class="body">
		{@render children()}
	</div>
</section>

<style>
	.column {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		min-width: 14rem;
		max-width: 22rem;
		flex: 1 1 16rem;
		padding: var(--space-sm);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		min-height: 24rem;
	}

	.column.drop-active {
		border-color: var(--action-default-hover);
		background: var(--action-default-wash);
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding-bottom: var(--space-2xs);
		border-bottom: 1px solid var(--edge-default);
	}

	.head h2 {
		margin: 0;
		font-size: var(--type-ui-label-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.count {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
</style>
