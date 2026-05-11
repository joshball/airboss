<script lang="ts" module>
import type { AnnotationFilter, AnnotationKind, HighlightColor } from '@ab/constants';
import type { TextAnchor } from '@ab/utils';

/**
 * `<AnnotationLayer>` -- paints stored annotations over a
 * `[data-annotatable-body]` element (wp-flightbag-rich-reader Phases 2 +
 * 5).
 *
 * Strategy: for each annotation, we re-anchor the captured `(text, start,
 * end, prefix, suffix)` quintuple against the body's plain-text projection
 * via `reanchor`. Successful matches walk the DOM to materialize a `Range`,
 * then `getClientRects()` against that range produces one or more line
 * boxes. Each box becomes an absolutely-positioned `<span>` overlay tagged
 * with the annotation kind + color. The body DOM is never mutated.
 *
 * Orphans (`reanchor` returned null) bubble up via the `onorphans` callback
 * so the host can render a side-panel rather than painting them.
 *
 * Visibility filtering (Phase 6): the `filter` prop hides notes / highlights
 * / everything per the annotation-filter user pref.
 */

export interface AnnotationLayerRecord {
	readonly id: string;
	readonly kind: AnnotationKind;
	readonly color: HighlightColor | null;
	readonly anchor: TextAnchor;
	/** Optional jump target when the user clicks the anchor (note id, draft id). */
	readonly noteId: string | null;
	readonly cardDraftId: string | null;
	/** ISO timestamp shown in the hover tooltip. */
	readonly createdAt: string | null;
}

export interface AnnotationLayerProps {
	/** Selector pointing to the host body. Defaults to `[data-annotatable-body]`. */
	readonly bodySelector?: string;
	/** Annotations the page-server loaded for the current section. */
	readonly annotations: readonly AnnotationLayerRecord[];
	/** Visibility filter (Phase 6). Defaults to `all`. */
	readonly filter?: AnnotationFilter;
	/** Called whenever the matched / orphaned partition changes. */
	readonly onorphans?: (orphans: readonly AnnotationLayerRecord[]) => void;
	/** Called when the user clicks the "Edit color" action on a highlight. */
	readonly onEditColor?: (id: string, color: HighlightColor) => Promise<void> | void;
	/** Called when the user clicks the "Remove" action on any annotation. */
	readonly onRemove?: (id: string) => Promise<void> | void;
	/** Called when a note-anchor is clicked (opens the note in the composer). */
	readonly onNoteClicked?: (noteId: string) => void;
	/** Called when a card-draft-anchor is clicked (jumps to the inbox row). */
	readonly onDraftClicked?: (draftId: string) => void;
}
</script>

<script lang="ts">
import {
	ANNOTATION_FILTERS,
	ANNOTATION_KINDS,
	HIGHLIGHT_COLOR_MEANINGS,
	HIGHLIGHT_COLOR_VALUES,
} from '@ab/constants';
import { reanchor } from '@ab/utils';
import { onMount, untrack } from 'svelte';
import { plainTextFromElement } from './section-text';

let {
	bodySelector = '[data-annotatable-body]',
	annotations,
	filter = ANNOTATION_FILTERS.ALL,
	onorphans,
	onEditColor,
	onRemove,
	onNoteClicked,
	onDraftClicked,
}: AnnotationLayerProps = $props();

interface OverlayBox {
	annotationId: string;
	kind: AnnotationKind;
	color: HighlightColor | null;
	noteId: string | null;
	cardDraftId: string | null;
	createdAt: string | null;
	top: number;
	left: number;
	width: number;
	height: number;
}

let bodyEl = $state<HTMLElement | null>(null);
let overlayHostEl = $state<HTMLDivElement | null>(null);
let layerEl = $state<HTMLDivElement | null>(null);
let overlays = $state<OverlayBox[]>([]);
let activeAnnotationId = $state<string | null>(null);
let popoverPos = $state<{ top: number; left: number } | null>(null);

const filteredAnnotations = $derived.by<readonly AnnotationLayerRecord[]>(() => {
	if (filter === ANNOTATION_FILTERS.HIDDEN) return [];
	if (filter === ANNOTATION_FILTERS.HIGHLIGHTS_ONLY) {
		return annotations.filter((a) => a.kind === ANNOTATION_KINDS.HIGHLIGHT);
	}
	if (filter === ANNOTATION_FILTERS.NOTES_ONLY) {
		return annotations.filter((a) => a.kind === ANNOTATION_KINDS.NOTE_ANCHOR);
	}
	return annotations;
});

const activeAnnotation = $derived.by<AnnotationLayerRecord | null>(() => {
	if (activeAnnotationId === null) return null;
	return annotations.find((a) => a.id === activeAnnotationId) ?? null;
});

function rangeFromOffsets(root: Element, start: number, end: number): Range | null {
	if (start === end) return null;
	const doc = root.ownerDocument;
	if (!doc) return null;
	const range = doc.createRange();
	const startInfo = locateOffset(root, start);
	const endInfo = locateOffset(root, end);
	if (!startInfo || !endInfo) return null;
	try {
		range.setStart(startInfo.node, startInfo.offset);
		range.setEnd(endInfo.node, endInfo.offset);
	} catch {
		return null;
	}
	return range;
}

interface LocatedOffset {
	node: Node;
	offset: number;
}

const BLOCK_TAGS = new Set([
	'P',
	'DIV',
	'SECTION',
	'ARTICLE',
	'HEADER',
	'FOOTER',
	'NAV',
	'ASIDE',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
	'UL',
	'OL',
	'LI',
	'BLOCKQUOTE',
	'PRE',
	'TABLE',
	'TR',
	'TBODY',
	'THEAD',
	'TFOOT',
	'FIGURE',
	'FIGCAPTION',
	'HR',
	'BR',
]);

function locateOffset(root: Element, target: number): LocatedOffset | null {
	const state = { remaining: target, found: null as LocatedOffset | null };
	walkLocate(root, state);
	return state.found;
}

interface LocateState {
	remaining: number;
	found: LocatedOffset | null;
}

function walkLocate(node: Node, state: LocateState): void {
	if (state.found !== null) return;
	if (node.nodeType === 3 /* TEXT_NODE */) {
		const len = (node.nodeValue ?? '').length;
		if (state.remaining <= len) {
			state.found = { node, offset: state.remaining };
			return;
		}
		state.remaining -= len;
		return;
	}
	if (node.nodeType !== 1) return;
	const el = node as Element;
	const tag = el.tagName;
	if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
	if (tag === 'BR') {
		if (state.remaining <= 1) {
			state.found = { node: el.parentNode ?? el, offset: 0 };
			return;
		}
		state.remaining -= 1;
		return;
	}
	for (const child of Array.from(el.childNodes)) {
		walkLocate(child, state);
		if (state.found !== null) return;
	}
	if (BLOCK_TAGS.has(tag)) {
		if (state.remaining <= 1) {
			state.found = { node: el, offset: el.childNodes.length };
			return;
		}
		state.remaining -= 1;
	}
}

function recomputeOverlays() {
	const body = bodyEl;
	const host = overlayHostEl;
	if (!body || !host) {
		overlays = [];
		return;
	}
	const projection = plainTextFromElement(body);
	const baseRect = host.getBoundingClientRect();
	const next: OverlayBox[] = [];
	const orphans: AnnotationLayerRecord[] = [];

	for (const ann of filteredAnnotations) {
		const range = reanchor(projection, ann.anchor);
		if (range === null) {
			orphans.push(ann);
			continue;
		}
		const domRange = rangeFromOffsets(body, range.start, range.end);
		if (!domRange) {
			orphans.push(ann);
			continue;
		}
		const rects = Array.from(domRange.getClientRects());
		if (rects.length === 0) {
			orphans.push(ann);
			continue;
		}
		for (const rect of rects) {
			if (rect.width <= 0 || rect.height <= 0) continue;
			next.push({
				annotationId: ann.id,
				kind: ann.kind,
				color: ann.color,
				noteId: ann.noteId,
				cardDraftId: ann.cardDraftId,
				createdAt: ann.createdAt,
				top: rect.top - baseRect.top,
				left: rect.left - baseRect.left,
				width: rect.width,
				height: rect.height,
			});
		}
	}
	overlays = next;
	onorphans?.(orphans);
}

function onOverlayClick(event: MouseEvent, annotationId: string) {
	event.stopPropagation();
	activeAnnotationId = annotationId;
	const target = event.currentTarget;
	if (!(target instanceof HTMLElement)) {
		popoverPos = null;
		return;
	}
	const rect = target.getBoundingClientRect();
	const layerRect = layerEl?.getBoundingClientRect() ?? rect;
	popoverPos = {
		top: rect.bottom - layerRect.top + 4,
		left: rect.left - layerRect.left,
	};
	const ann = annotations.find((a) => a.id === annotationId);
	if (!ann) return;
	if (ann.kind === ANNOTATION_KINDS.NOTE_ANCHOR && ann.noteId && onNoteClicked) {
		onNoteClicked(ann.noteId);
	}
	if (ann.kind === ANNOTATION_KINDS.CARD_DRAFT_ANCHOR && ann.cardDraftId && onDraftClicked) {
		onDraftClicked(ann.cardDraftId);
	}
}

function onOverlayKeydown(event: KeyboardEvent, annotationId: string) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault();
		// Synthetic positioning: we don't have a click rect, so just open
		// the popover anchored to the layer top-left.
		activeAnnotationId = annotationId;
		const target = event.currentTarget;
		if (target instanceof HTMLElement) {
			const rect = target.getBoundingClientRect();
			const layerRect = layerEl?.getBoundingClientRect() ?? rect;
			popoverPos = {
				top: rect.bottom - layerRect.top + 4,
				left: rect.left - layerRect.left,
			};
		}
	}
}

function dismissPopover() {
	activeAnnotationId = null;
	popoverPos = null;
}

async function changeColor(color: HighlightColor) {
	if (activeAnnotationId === null || !onEditColor) return;
	await onEditColor(activeAnnotationId, color);
	dismissPopover();
}

async function remove() {
	if (activeAnnotationId === null || !onRemove) return;
	await onRemove(activeAnnotationId);
	dismissPopover();
}

function onDocumentClick(event: MouseEvent) {
	if (activeAnnotationId === null) return;
	const target = event.target;
	if (!(target instanceof Node)) {
		dismissPopover();
		return;
	}
	if (layerEl && layerEl.contains(target)) return;
	dismissPopover();
}

function onDocumentKey(event: KeyboardEvent) {
	if (event.key === 'Escape' && activeAnnotationId !== null) {
		dismissPopover();
	}
}

onMount(() => {
	bodyEl = document.querySelector(bodySelector);
	if (!bodyEl) return;
	const onResize = () => recomputeOverlays();
	const ro = new ResizeObserver(onResize);
	ro.observe(bodyEl);
	window.addEventListener('resize', onResize);
	document.addEventListener('click', onDocumentClick);
	document.addEventListener('keydown', onDocumentKey);
	// Defer one tick so any in-flight body re-render finishes first.
	requestAnimationFrame(() => recomputeOverlays());
	return () => {
		ro.disconnect();
		window.removeEventListener('resize', onResize);
		document.removeEventListener('click', onDocumentClick);
		document.removeEventListener('keydown', onDocumentKey);
	};
});

$effect(() => {
	void filteredAnnotations;
	void filter;
	if (!bodyEl) return;
	untrack(() => recomputeOverlays());
});
</script>

<div bind:this={overlayHostEl} class="layer-host">
	<div bind:this={layerEl} class="layer" data-testid="annotation-layer">
		{#each overlays as box (box.annotationId + ':' + box.top + ':' + box.left)}
			<button
				type="button"
				class="overlay"
				class:highlight={box.kind === ANNOTATION_KINDS.HIGHLIGHT}
				class:note-anchor={box.kind === ANNOTATION_KINDS.NOTE_ANCHOR}
				class:draft-anchor={box.kind === ANNOTATION_KINDS.CARD_DRAFT_ANCHOR}
				data-annotation-id={box.annotationId}
				data-annotation-kind={box.kind}
				data-color={box.color ?? ''}
				data-testid="annotation-overlay-{box.annotationId}"
				style="top: {box.top}px; left: {box.left}px; width: {box.width}px; height: {box.height}px;"
				onclick={(event) => onOverlayClick(event, box.annotationId)}
				onkeydown={(event) => onOverlayKeydown(event, box.annotationId)}
				aria-label="{box.kind === ANNOTATION_KINDS.HIGHLIGHT
					? `${box.color ?? ''} highlight`
					: box.kind === ANNOTATION_KINDS.NOTE_ANCHOR
						? 'Note on this passage'
						: 'Card draft on this passage'}"
			>
				<span class="sr-only">Annotation</span>
			</button>
		{/each}
		{#if activeAnnotation && popoverPos}
			<div
				class="popover"
				style="top: {popoverPos.top}px; left: {popoverPos.left}px;"
				role="dialog"
				aria-label="Annotation actions"
				data-testid="annotation-popover"
			>
				{#if activeAnnotation.kind === ANNOTATION_KINDS.HIGHLIGHT && onEditColor}
					<div class="popover-row" data-testid="annotation-color-row">
						{#each HIGHLIGHT_COLOR_VALUES as color (color)}
							<button
								type="button"
								class="swatch-button"
								data-testid="annotation-color-{color}"
								onclick={() => changeColor(color)}
								title="{color} -- {HIGHLIGHT_COLOR_MEANINGS[color]}"
								aria-label="Set color {color}"
							>
								<span class="swatch" data-color={color} aria-hidden="true"></span>
							</button>
						{/each}
					</div>
				{/if}
				{#if onRemove}
					<button
						type="button"
						class="popover-action danger"
						data-testid="annotation-remove"
						onclick={remove}
					>
						Remove
					</button>
				{/if}
				<button
					type="button"
					class="popover-action ghost"
					data-testid="annotation-popover-close"
					onclick={dismissPopover}
				>
					Close
				</button>
				{#if activeAnnotation.createdAt}
					<p class="popover-meta">Saved {new Date(activeAnnotation.createdAt).toLocaleString()}</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.layer-host {
		position: relative;
	}

	.layer {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
	}

	.overlay {
		appearance: none;
		position: absolute;
		border: 0;
		padding: 0;
		margin: 0;
		background: transparent;
		cursor: pointer;
		pointer-events: auto;
		border-radius: var(--radius-sm);
		transition: filter var(--motion-fast) ease;
	}

	.overlay:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.overlay.highlight {
		mix-blend-mode: multiply;
	}

	.overlay.highlight[data-color='yellow'] {
		background: var(--highlight-yellow-wash);
	}
	.overlay.highlight[data-color='blue'] {
		background: var(--highlight-blue-wash);
	}
	.overlay.highlight[data-color='green'] {
		background: var(--highlight-green-wash);
	}
	.overlay.highlight[data-color='pink'] {
		background: var(--highlight-pink-wash);
	}

	/* Note-anchor: dotted underline rather than a fill block, so notes don't
	   visually drown out highlights. */
	.overlay.note-anchor {
		background: transparent;
		border-bottom: 2px dotted var(--action-link);
	}

	.overlay.draft-anchor {
		background: transparent;
		border-bottom: 2px dashed var(--highlight-yellow);
	}

	.overlay:hover {
		filter: brightness(0.92);
	}

	.popover {
		position: absolute;
		display: inline-flex;
		flex-direction: column;
		gap: var(--space-3xs);
		padding: var(--space-xs);
		background: var(--surface-overlay);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		z-index: 60;
		font-size: var(--font-size-sm);
		pointer-events: auto;
		min-width: 12rem;
	}

	.popover-row {
		display: inline-flex;
		gap: var(--space-3xs);
	}

	.swatch-button {
		appearance: none;
		background: transparent;
		border: 1px solid transparent;
		padding: var(--space-3xs);
		border-radius: var(--radius-sm);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.swatch-button:hover,
	.swatch-button:focus-visible {
		border-color: var(--edge-default);
		background: var(--surface-sunken);
	}

	.swatch {
		display: inline-block;
		width: 0.95em;
		height: 0.95em;
		border-radius: var(--radius-sm);
		border: 1px solid var(--edge-default);
	}

	.swatch[data-color='yellow'] {
		background: var(--highlight-yellow);
	}
	.swatch[data-color='blue'] {
		background: var(--highlight-blue);
	}
	.swatch[data-color='green'] {
		background: var(--highlight-green);
	}
	.swatch[data-color='pink'] {
		background: var(--highlight-pink);
	}

	.popover-action {
		appearance: none;
		background: transparent;
		border: 1px solid var(--edge-default);
		padding: var(--space-3xs) var(--space-xs);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font: inherit;
		color: inherit;
		text-align: left;
	}

	.popover-action.danger {
		color: var(--signal-danger);
		border-color: var(--signal-danger-edge);
	}

	.popover-action.ghost {
		color: var(--ink-muted);
	}

	.popover-meta {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
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
</style>
