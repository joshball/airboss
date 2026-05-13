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
	/** Notify when the user starts a drag. The page binds this to a
	 * board-level `dragStartColumn` signal so source columns can opt out of
	 * the active-target highlight. */
	readonly onDragStartCard?: (columnId: string) => void;
	/** Notify when the drag ends (settled or cancelled). Pairs with
	 * `onDragStartCard`; the page clears its source-column signal here. */
	readonly onDragEndCard?: () => void;
	/** Callback when the user picks an alt-move target via the button menu. */
	readonly onMove: (toColumnId: string) => void;
}
</script>

<script lang="ts">
/**
 * Draggable item card. Drag-and-drop is the primary affordance; a "Move
 * to..." disclosure-button provides the keyboard-accessible alternative
 * path (a11y rubric: drag-drop must always have a kbd alt). Selecting a
 * target dispatches `onMove(columnId)`.
 *
 * Disclosure pattern (vs. ARIA menu): the popup is a plain `<ul>` of
 * `<button>`s with `aria-haspopup="true"`; we don't claim
 * `role="menu"`/`role="menuitem"` because we don't implement APG's full
 * menu pattern (arrow-key navigation, Home/End). Disclosure semantics let
 * AT narrate the popup correctly while keeping the kbd contract simple:
 * Tab through, Esc closes + restores focus to trigger, click outside
 * closes.
 */

import { onMount } from 'svelte';

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
	onDragStartCard,
	onDragEndCard,
	onMove,
}: ItemCardProps = $props();

let menuOpen = $state(false);
let triggerEl = $state<HTMLButtonElement | null>(null);
let popoverEl = $state<HTMLUListElement | null>(null);

const otherColumns = $derived(moveTargets.filter((t) => t.id !== currentColumnId));
const titleId = $derived(`item-card-title-${itemId}`);
const helpId = $derived(`item-card-help-${itemId}`);
const cardId = $derived(`item-card-${itemId}`);

function onDragStart(event: DragEvent) {
	if (!event.dataTransfer) return;
	event.dataTransfer.effectAllowed = 'move';
	event.dataTransfer.setData('application/x-airboss-card-id', itemId);
	onDragStartCard?.(currentColumnId);
}

function onDragEnd() {
	onDragEndCard?.();
}

interface PillSemantics {
	readonly cls: string;
	readonly axisLabel: string;
}

function statusPillSemantics(value: string | null | undefined, axis: 'status' | 'review'): PillSemantics {
	if (!value) return { cls: 'pill', axisLabel: axis === 'status' ? 'status' : 'review' };
	const lc = value.toLowerCase();
	const axisLabel = axis === 'status' ? 'status' : 'review';
	if (lc === 'done') return { cls: 'pill pill-done', axisLabel };
	if (lc === 'reading' || lc === 'in-progress') return { cls: 'pill pill-progress', axisLabel };
	// Distinguish `pending` (review axis -- info colour) from `unread` (status
	// axis -- warning colour) so two cards showing both pills don't read as the
	// same state under colour-only scanning.
	if (lc === 'pending') return { cls: 'pill pill-pending', axisLabel };
	if (lc === 'unread') return { cls: 'pill pill-unread', axisLabel };
	return { cls: 'pill', axisLabel };
}

const fmPill = $derived(statusPillSemantics(frontmatterStatus, 'status'));
const rsPill = $derived(statusPillSemantics(reviewStatus, 'review'));

function openMenu() {
	menuOpen = true;
}

function closeMenu(restoreFocus = true) {
	if (!menuOpen) return;
	menuOpen = false;
	if (restoreFocus) {
		// Defer until DOM updates so the trigger is focusable again.
		queueMicrotask(() => triggerEl?.focus());
	}
}

function toggleMenu() {
	if (menuOpen) {
		closeMenu();
	} else {
		openMenu();
	}
}

function onTriggerKeydown(event: KeyboardEvent) {
	if (event.key === 'ArrowDown' && !menuOpen) {
		// Convenience: open menu and shift focus to first item on ArrowDown.
		event.preventDefault();
		openMenu();
		queueMicrotask(() => {
			const first = popoverEl?.querySelector('button');
			if (first instanceof HTMLElement) first.focus();
		});
	}
}

function selectTarget(toColumnId: string) {
	closeMenu(false);
	onMove(toColumnId);
}

// Document-level outside-click + Escape listener while the menu is open. We
// install / tear down on `menuOpen` flip rather than running an always-on
// listener so the cost is proportional to actual usage.
$effect(() => {
	if (!menuOpen) return;
	function handlePointerDown(event: PointerEvent) {
		const target = event.target;
		if (!(target instanceof Node)) return;
		if (popoverEl?.contains(target) || triggerEl?.contains(target)) return;
		closeMenu(false);
	}
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeMenu(true);
		}
	}
	document.addEventListener('pointerdown', handlePointerDown, true);
	document.addEventListener('keydown', handleKeydown, true);
	return () => {
		document.removeEventListener('pointerdown', handlePointerDown, true);
		document.removeEventListener('keydown', handleKeydown, true);
	};
});

// Edge-case mirroring: if the page tears the card out of the DOM while the
// menu is open (e.g. an `invalidateAll()` after a different action), the
// $effect cleanup runs because `menuOpen` no longer mounts a listener.
onMount(() => {
	return () => {
		// Defensive: ensure no document listeners survive a forced unmount.
		menuOpen = false;
	};
});
</script>

<article
	class="card"
	id={cardId}
	tabindex="-1"
	draggable="true"
	data-item-id={itemId}
	aria-describedby={helpId}
	ondragstart={onDragStart}
	ondragend={onDragEnd}
>
	<a class="title-row" id={titleId} href={href}>
		<span class="title">{title}</span>
		<span class="kind">{kindLabel}</span>
	</a>
	<div class="meta">
		<span class="ref" title={ref}>{ref}</span>
		<span class="pills">
			{#if frontmatterStatus}
				<span class={fmPill.cls} aria-label={`status: ${frontmatterStatus}`}>
					<span class="pill-axis">status:</span>
					{frontmatterStatus}
				</span>
			{/if}
			{#if reviewStatus}
				<span class={rsPill.cls} aria-label={`review: ${reviewStatus}`}>
					<span class="pill-axis">review:</span>
					{reviewStatus}
				</span>
			{/if}
		</span>
	</div>
	<span class="visually-hidden" id={helpId}>
		Drag this card to a column to move it, or use the Move to button to pick a column from a list.
	</span>
	{#if otherColumns.length > 0}
		<div class="move-row">
			<button
				type="button"
				class="move-btn"
				bind:this={triggerEl}
				aria-haspopup="true"
				aria-expanded={menuOpen}
				aria-controls={`item-card-popover-${itemId}`}
				aria-describedby={titleId}
				aria-label="Move card to another column"
				onclick={toggleMenu}
				onkeydown={onTriggerKeydown}
			>
				Move to...
			</button>
			{#if menuOpen}
				<ul class="popover" id={`item-card-popover-${itemId}`} bind:this={popoverEl}>
					{#each otherColumns as target (target.id)}
						<li>
							<button type="button" class="popover-item" onclick={() => selectTarget(target.id)}>
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

	.card:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.card:hover {
		background: var(--surface-sunken);
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
		display: inline-flex;
		gap: var(--space-3xs);
		align-items: baseline;
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
	}

	.pill-axis {
		color: var(--ink-muted);
	}

	.pill-done {
		background: var(--signal-success-wash);
		color: var(--signal-success-deep-ink);
	}

	.pill-progress {
		background: var(--signal-info-wash);
		color: var(--signal-info-deep-ink);
	}

	.pill-pending {
		background: var(--signal-info-wash);
		color: var(--signal-info-deep-ink);
	}

	.pill-unread {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-deep-ink);
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
		padding: var(--space-2xs) var(--space-sm);
		min-height: 1.75rem;
		cursor: pointer;
	}

	.move-btn:hover {
		background: var(--surface-sunken);
	}

	.move-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.popover {
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

	.popover li {
		display: flex;
	}

	.popover-item {
		flex: 1;
		text-align: left;
		background: transparent;
		border: 0;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-xs);
		color: var(--ink-body);
		font: inherit;
		min-height: 1.75rem;
		cursor: pointer;
	}

	.popover-item:hover,
	.popover-item:focus-visible {
		background: var(--surface-sunken);
		outline: none;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
