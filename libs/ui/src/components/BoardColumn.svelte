<script lang="ts" module>
import type { Snippet } from 'svelte';

export interface BoardColumnProps {
	/** Column id propagated to drop handlers via `dataTransfer`. */
	readonly columnId: string;
	/** Display name -- the bare column header. */
	readonly name: string;
	/** Count badge value (item count for this column). */
	readonly count: number;
	/** Total (unfiltered) count, when filters are active. Renders as `count of total`
	 * so the unfiltered baseline is preserved even after a filter narrows the set. */
	readonly totalCount?: number | null;
	/** Whether the column is currently a drop-target highlight. Wired by callers
	 * that want a board-level "all valid drop targets" cue while a drag is in
	 * flight (separate from the per-column hover highlight). */
	readonly isDropTarget?: boolean;
	/** Whether this column is the source of an active drag. Source columns get
	 * a muted "no-op drop" affordance instead of the active-target highlight. */
	readonly isSourceColumn?: boolean;
	/** Cards rendered into the column body. Wrapped in `<ul role="list">` so AT
	 * gets list semantics; callers wrap each child in `<li>`. */
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
 * Drag-leave hygiene: HTML5 `dragleave` fires whenever the pointer crosses a
 * descendant boundary, which causes the highlight to flicker as the user
 * moves over child cards. We track an `enter`/`leave` depth counter so the
 * highlight only clears when the pointer truly leaves the column body.
 *
 * Source-column behavior: when `isSourceColumn` is true (the dragging card
 * started in this column), the column does NOT highlight as an active drop
 * target and the drop event short-circuits to a no-op. Saves a server
 * round-trip when the user lets go on the column they started in.
 *
 * Keyboard alternative: drop is the *visible* affordance, but cards expose
 * their own "Move to..." disclosure-button per item that calls the same form
 * action directly. The column itself doesn't need to be keyboard-droppable --
 * the card-level button covers the kbd-only path.
 */

let {
	columnId,
	name,
	count,
	totalCount = null,
	isDropTarget = false,
	isSourceColumn = false,
	children,
	onDrop,
}: BoardColumnProps = $props();

let dragDepth = $state(0);
const active = $derived(dragDepth > 0 && !isSourceColumn);

function onDragEnter() {
	dragDepth += 1;
}

function onDragLeave() {
	dragDepth = Math.max(0, dragDepth - 1);
}

function onDragOver(event: DragEvent) {
	event.preventDefault();
	if (event.dataTransfer) {
		// Source-column: signal `none` so the cursor reads "no drop here" rather
		// than implying a meaningful move.
		event.dataTransfer.dropEffect = isSourceColumn ? 'none' : 'move';
	}
}

function onDropEvent(event: DragEvent) {
	event.preventDefault();
	dragDepth = 0;
	if (isSourceColumn) return;
	const id = event.dataTransfer?.getData('application/x-airboss-card-id') ?? '';
	if (id !== '') onDrop(id);
}

const showTotal = $derived(typeof totalCount === 'number' && totalCount !== count);
const countLabel = $derived(showTotal ? `${count} of ${totalCount}` : `${count}`);
const sectionLabel = $derived(showTotal ? `${name} (${count} of ${totalCount} items)` : `${name} (${count} items)`);
</script>

<section
	class="column"
	class:drop-active={active || isDropTarget}
	class:drop-source={isSourceColumn}
	data-column-id={columnId}
	aria-label={sectionLabel}
	ondragenter={onDragEnter}
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDropEvent}
>
	<header class="head">
		<h2>{name}</h2>
		<span class="count" aria-hidden="true">{countLabel}</span>
	</header>
	<ul class="body" role="list">
		{@render children()}
	</ul>
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

	.column.drop-source {
		opacity: 0.85;
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
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
</style>
