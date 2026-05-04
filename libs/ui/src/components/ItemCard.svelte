<script lang="ts" module>
export interface ItemCardColumnTarget {
	readonly id: string;
	readonly name: string;
}

export interface ItemCardProps {
	readonly itemId: string;
	readonly title: string;
	readonly kindLabel: string;
	readonly ref: string;
	readonly href: string;
	/** Frontmatter status pill value (or null when n/a, e.g. ad_hoc). */
	readonly frontmatterStatus?: string | null;
	/** Review status pill value (or null when n/a). */
	readonly reviewStatus?: string | null;
	/** Other columns the user can explicitly move this card to via the
	 * "Move to..." button (the keyboard-accessible alternative to drag). */
	readonly moveTargets: ReadonlyArray<ItemCardColumnTarget>;
	readonly currentColumnId: string;
	/** Callback when the user picks an alt-move target via the button menu. */
	readonly onMove: (toColumnId: string) => void;
}
</script>

<script lang="ts">
/**
 * Draggable item card. Drag-and-drop is the primary affordance; a "Move
 * to..." button menu provides the keyboard-accessible alternative path
 * (a11y rubric: drag-drop must always have a kbd alt). The button menu
 * lists every column except the card's current one and dispatches
 * `onMove(columnId)` on selection.
 */

let {
	itemId,
	title,
	kindLabel,
	ref,
	href,
	frontmatterStatus = null,
	reviewStatus = null,
	moveTargets,
	currentColumnId,
	onMove,
}: ItemCardProps = $props();

let menuOpen = $state(false);

function onDragStart(event: DragEvent) {
	if (!event.dataTransfer) return;
	event.dataTransfer.effectAllowed = 'move';
	event.dataTransfer.setData('application/x-airboss-card-id', itemId);
}

function statusPillClass(value: string | null | undefined): string {
	if (!value) return 'pill';
	const lc = value.toLowerCase();
	if (lc === 'done') return 'pill pill-done';
	if (lc === 'reading' || lc === 'in-progress') return 'pill pill-progress';
	if (lc === 'pending' || lc === 'unread') return 'pill pill-pending';
	return 'pill';
}

const otherColumns = $derived(moveTargets.filter((t) => t.id !== currentColumnId));
</script>

<article
	class="card"
	draggable="true"
	data-item-id={itemId}
	ondragstart={onDragStart}
>
	<a class="title-row" href={href}>
		<span class="title">{title}</span>
		<span class="kind">{kindLabel}</span>
	</a>
	<div class="meta">
		<span class="ref" title={ref}>{ref}</span>
		<span class="pills">
			{#if frontmatterStatus}
				<span class={statusPillClass(frontmatterStatus)} title="status">{frontmatterStatus}</span>
			{/if}
			{#if reviewStatus}
				<span class={statusPillClass(reviewStatus)} title="review_status">{reviewStatus}</span>
			{/if}
		</span>
	</div>
	{#if otherColumns.length > 0}
		<div class="move-row">
			<button
				type="button"
				class="move-btn"
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				aria-label={`Move "${title}" to another column`}
				onclick={() => (menuOpen = !menuOpen)}
			>
				Move to...
			</button>
			{#if menuOpen}
				<ul class="menu" role="menu">
					{#each otherColumns as target (target.id)}
						<li role="none">
							<button
								type="button"
								role="menuitem"
								class="menu-item"
								onclick={() => {
									menuOpen = false;
									onMove(target.id);
								}}
							>
								{target.name}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</article>

<style>
	.card {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		cursor: grab;
	}

	.card:active {
		cursor: grabbing;
	}

	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-2xs);
		text-decoration: none;
		color: var(--ink-body);
	}

	.title-row:hover .title {
		color: var(--link-hover);
	}

	.title {
		font-weight: var(--type-ui-control-weight);
		color: var(--ink-body);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.kind {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		flex-shrink: 0;
	}

	.meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2xs);
		font-size: var(--type-ui-caption-size);
	}

	.ref {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.pills {
		display: flex;
		gap: var(--space-3xs);
		flex-wrap: wrap;
	}

	.pill {
		display: inline-block;
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
	}

	.pill-done {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}

	.pill-progress {
		background: var(--signal-info-wash);
		color: var(--signal-info-ink);
	}

	.pill-pending {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
	}

	.move-row {
		position: relative;
	}

	.move-btn {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-3xs) var(--space-2xs);
		cursor: pointer;
	}

	.move-btn:hover {
		background: var(--surface-sunken);
	}

	.move-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.menu {
		position: absolute;
		left: 0;
		top: 100%;
		margin: var(--space-3xs) 0 0;
		padding: var(--space-3xs);
		list-style: none;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-md);
		z-index: 50;
		min-width: 8rem;
	}

	.menu-item {
		width: 100%;
		text-align: left;
		background: transparent;
		border: 0;
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-xs);
		color: var(--ink-body);
		font: inherit;
		cursor: pointer;
	}

	.menu-item:hover,
	.menu-item:focus-visible {
		background: var(--surface-sunken);
		outline: none;
	}
</style>
