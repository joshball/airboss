<script lang="ts" module>
import type { HighlightColor } from '@ab/constants';
import type { TextAnchor } from '@ab/utils';

/**
 * `<SelectionToolbar>` -- floats above the user's text selection inside the
 * rich reader. Listens for `selectionchange` and renders the
 * highlight / card-later / card-now / note / copy actions when the
 * selection lives inside an element marked `[data-annotatable-body]`.
 *
 * Phase 2 keeps Highlight + Copy active; Card later (Phase 3), Card now
 * (Phase 4), and Note (Phase 5) wire in via the props as they ship. The
 * toolbar dismisses itself on outside click, escape, or selection collapse.
 *
 * Positioning: computed from the selection's bounding rect plus the
 * viewport bounds. No floating-ui dependency required for this scope.
 */

export interface SelectionToolbarSection {
	readonly id: string;
	readonly title: string;
	readonly code: string;
	readonly airbossRef: string;
}

export interface SelectionToolbarProps {
	/** Currently visible section -- drives the copy-with-citation footer. */
	readonly section: SelectionToolbarSection;
	/** The plain-text projection of the body the toolbar is anchored to. */
	readonly bodyText: string;
	/** Called with the captured anchor when the user picks a highlight color. */
	readonly onHighlight: (anchor: TextAnchor, color: HighlightColor) => Promise<void> | void;
	/** Called with the captured anchor when the user picks "Card later". */
	readonly onCardDraft?: (anchor: TextAnchor) => Promise<void> | void;
	/** Called when the user picks "Card now" (opens the composer column). */
	readonly onCardNow?: (anchor: TextAnchor) => void;
	/** Called when the user picks "Note" (opens the composer column). */
	readonly onNote?: (anchor: TextAnchor) => void;
	/**
	 * Called with the captured anchor right after the clipboard write fires.
	 * Lets the host render a transient toast.
	 */
	readonly onCopied?: (anchor: TextAnchor) => void;
}
</script>

<script lang="ts">
import { HIGHLIGHT_COLOR_MEANINGS, HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_VALUES } from '@ab/constants';
import { captureAnchor } from '@ab/utils';
import { onMount } from 'svelte';
import { plainTextFromElement, rangeToOffsets } from './section-text';

let {
	section,
	bodyText,
	onHighlight,
	onCardDraft,
	onCardNow,
	onNote,
	onCopied,
}: SelectionToolbarProps = $props();

interface ToolbarPosition {
	top: number;
	left: number;
	placement: 'above' | 'below';
}

let position = $state<ToolbarPosition | null>(null);
let visible = $state(false);
let pickerOpen = $state(false);
let toolbarEl = $state<HTMLDivElement | null>(null);
let pendingAnchor = $state<{ anchor: ReturnType<typeof captureAnchor>; bodyEl: HTMLElement } | null>(null);
let busy = $state(false);

const TOOLBAR_HEIGHT = 44;
const TOOLBAR_OFFSET = 8;

function findAnnotatableBody(node: Node | null): HTMLElement | null {
	let current: Node | null = node;
	while (current !== null) {
		if (current.nodeType === 1) {
			const el = current as HTMLElement;
			if (el.matches('[data-annotatable-body]')) return el;
		}
		current = current.parentNode;
	}
	return null;
}

function computePosition(rect: DOMRect): ToolbarPosition {
	const placement = rect.top > TOOLBAR_HEIGHT + TOOLBAR_OFFSET + 16 ? 'above' : 'below';
	const top =
		placement === 'above'
			? Math.max(8, rect.top + window.scrollY - TOOLBAR_HEIGHT - TOOLBAR_OFFSET)
			: rect.bottom + window.scrollY + TOOLBAR_OFFSET;
	const left = Math.max(8, rect.left + window.scrollX + rect.width / 2);
	return { top, left, placement };
}

function dismiss() {
	visible = false;
	pickerOpen = false;
	pendingAnchor = null;
	position = null;
}

function refreshFromSelection() {
	if (busy) return;
	const sel = window.getSelection();
	if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
		dismiss();
		return;
	}
	const range = sel.getRangeAt(0);
	if (range.collapsed) {
		dismiss();
		return;
	}
	const bodyEl = findAnnotatableBody(range.commonAncestorContainer);
	if (!bodyEl) {
		dismiss();
		return;
	}
	const offsets = rangeToOffsets(bodyEl, range);
	if (!offsets || offsets.start === offsets.end) {
		dismiss();
		return;
	}
	// Use the live DOM projection rather than the prop -- that way the
	// captured offsets always match the text we just slice off the body.
	const projection = plainTextFromElement(bodyEl);
	const anchor = captureAnchor(projection, offsets);
	if (anchor.text.trim().length === 0) {
		dismiss();
		return;
	}
	pendingAnchor = { anchor, bodyEl };
	position = computePosition(range.getBoundingClientRect());
	visible = true;
}

function isInsideToolbar(target: EventTarget | null): boolean {
	if (!(target instanceof Node)) return false;
	if (toolbarEl && toolbarEl.contains(target)) return true;
	return false;
}

function onPointerDown(event: PointerEvent) {
	if (!visible) return;
	if (isInsideToolbar(event.target)) return;
	// A click outside both the toolbar and the body collapses the
	// selection -- the next selectionchange tick dismisses naturally.
}

function onKeyDown(event: KeyboardEvent) {
	if (!visible) return;
	if (event.key === 'Escape') {
		dismiss();
		event.preventDefault();
	}
}

async function pickHighlight(color: (typeof HIGHLIGHT_COLOR_VALUES)[number]) {
	if (!pendingAnchor || busy) return;
	const { anchor } = pendingAnchor;
	busy = true;
	try {
		await onHighlight(anchor, color);
	} finally {
		busy = false;
		pickerOpen = false;
		dismiss();
		// Collapse the selection so the user gets immediate visual feedback.
		const sel = window.getSelection();
		if (sel) sel.removeAllRanges();
	}
}

async function pickCardLater() {
	if (!pendingAnchor || busy || !onCardDraft) return;
	const { anchor } = pendingAnchor;
	busy = true;
	try {
		await onCardDraft(anchor);
	} finally {
		busy = false;
		dismiss();
		const sel = window.getSelection();
		if (sel) sel.removeAllRanges();
	}
}

function pickCardNow() {
	if (!pendingAnchor || !onCardNow) return;
	onCardNow(pendingAnchor.anchor);
	dismiss();
}

function pickNote() {
	if (!pendingAnchor || !onNote) return;
	onNote(pendingAnchor.anchor);
	dismiss();
}

async function pickCopy() {
	if (!pendingAnchor || busy) return;
	const { anchor } = pendingAnchor;
	const formatted = `${anchor.text}\n\n— Source: ${section.title} (${section.code}) ${section.airbossRef}`;
	busy = true;
	try {
		await navigator.clipboard.writeText(formatted);
		onCopied?.(anchor);
	} catch {
		// Clipboard write may fail in unsecured contexts; surface as a
		// best-effort copy via a hidden textarea. Keep silent if both
		// fail -- the user just sees the toast not appear.
		try {
			const ta = document.createElement('textarea');
			ta.value = formatted;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			ta.remove();
			onCopied?.(anchor);
		} catch {
			/* swallow */
		}
	} finally {
		busy = false;
		dismiss();
	}
}

function onKeyboardShortcut(event: KeyboardEvent) {
	if (!visible || !pendingAnchor) return;
	if (event.altKey || event.ctrlKey || event.metaKey) return;
	const target = event.target;
	if (target instanceof HTMLElement) {
		const tag = target.tagName.toLowerCase();
		if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
		if (target.isContentEditable) return;
	}
	if (event.key === 'h' || event.key === 'H') {
		event.preventDefault();
		pickHighlight(HIGHLIGHT_COLORS.YELLOW);
		return;
	}
	if (event.key === 'd' || event.key === 'D') {
		event.preventDefault();
		if (onCardDraft) pickCardLater();
		return;
	}
	if (event.key === 'c' || event.key === 'C') {
		event.preventDefault();
		if (onCardNow) pickCardNow();
		return;
	}
	if (event.key === 'n' || event.key === 'N') {
		event.preventDefault();
		if (onNote) pickNote();
	}
}

// `bodyText` is unused at runtime today (the live DOM projection wins on
// capture for accuracy) but kept in the props so the host can pre-compute
// it once per section render and pass it to the Phase 6 keyboard hint.
$effect(() => {
	void bodyText;
});

onMount(() => {
	const onSelectionChange = () => refreshFromSelection();
	const onScroll = () => {
		if (!visible) return;
		const sel = window.getSelection();
		if (sel && sel.rangeCount > 0) {
			position = computePosition(sel.getRangeAt(0).getBoundingClientRect());
		}
	};
	document.addEventListener('selectionchange', onSelectionChange);
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll);
	document.addEventListener('pointerdown', onPointerDown);
	document.addEventListener('keydown', onKeyDown);
	document.addEventListener('keydown', onKeyboardShortcut);
	return () => {
		document.removeEventListener('selectionchange', onSelectionChange);
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('resize', onScroll);
		document.removeEventListener('pointerdown', onPointerDown);
		document.removeEventListener('keydown', onKeyDown);
		document.removeEventListener('keydown', onKeyboardShortcut);
	};
});
</script>

{#if visible && position}
	<div
		bind:this={toolbarEl}
		class="toolbar"
		class:above={position.placement === 'above'}
		class:below={position.placement === 'below'}
		style="top: {position.top}px; left: {position.left}px;"
		role="toolbar"
		aria-label="Selection actions"
		data-testid="selection-toolbar"
	>
		<button
			type="button"
			class="action"
			data-testid="selection-highlight"
			onclick={() => (pickerOpen = !pickerOpen)}
			disabled={busy}
			aria-haspopup="menu"
			aria-expanded={pickerOpen}
			title="Highlight (H)"
		>
			<span class="swatch" data-color="yellow" aria-hidden="true"></span>
			Highlight
		</button>
		{#if onCardDraft}
			<button
				type="button"
				class="action"
				data-testid="selection-card-later"
				onclick={pickCardLater}
				disabled={busy}
				title="Card later (D)"
			>
				⏳ Card later
			</button>
		{:else}
			<button type="button" class="action" disabled title="Card later (coming next phase)">⏳ Card later</button>
		{/if}
		{#if onCardNow}
			<button
				type="button"
				class="action"
				data-testid="selection-card-now"
				onclick={pickCardNow}
				disabled={busy}
				title="Card now (C)"
			>
				✨ Card now
			</button>
		{:else}
			<button type="button" class="action" disabled title="Card now (coming next phase)">✨ Card now</button>
		{/if}
		{#if onNote}
			<button
				type="button"
				class="action"
				data-testid="selection-note"
				onclick={pickNote}
				disabled={busy}
				title="Note (N)"
			>
				📝 Note
			</button>
		{:else}
			<button type="button" class="action" disabled title="Note (coming next phase)">📝 Note</button>
		{/if}
		<button
			type="button"
			class="action"
			data-testid="selection-copy"
			onclick={pickCopy}
			disabled={busy}
			title="Copy with citation"
		>
			📋 Copy
		</button>

		{#if pickerOpen}
			<div
				class="picker"
				class:above={position.placement === 'above'}
				role="menu"
				aria-label="Highlight color"
				data-testid="selection-color-picker"
			>
				{#each HIGHLIGHT_COLOR_VALUES as color (color)}
					<button
						type="button"
						class="swatch-button"
						data-color={color}
						data-testid="selection-color-{color}"
						onclick={() => pickHighlight(color)}
						title="{color} -- {HIGHLIGHT_COLOR_MEANINGS[color]}"
						aria-label="{color} highlight ({HIGHLIGHT_COLOR_MEANINGS[color]})"
					>
						<span class="swatch" data-color={color} aria-hidden="true"></span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.toolbar {
		position: absolute;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: var(--space-3xs);
		padding: var(--space-3xs) var(--space-2xs);
		background: var(--surface-overlay);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
		font-size: var(--font-size-sm);
		color: var(--ink-strong);
		z-index: 50;
		animation: toolbar-fade-in var(--motion-fast) ease-out;
	}

	.action {
		appearance: none;
		background: transparent;
		border: 0;
		color: inherit;
		font: inherit;
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		padding: var(--space-3xs) var(--space-xs);
		border-radius: var(--radius-sm);
		cursor: pointer;
		white-space: nowrap;
	}

	.action:hover:not(:disabled),
	.action:focus-visible {
		background: var(--surface-sunken);
	}

	.action:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.swatch {
		display: inline-block;
		width: 0.85em;
		height: 0.85em;
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

	.picker {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: var(--space-3xs);
		padding: var(--space-3xs);
		background: var(--surface-overlay);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md);
	}

	.picker.above {
		top: -3.5rem;
	}

	.picker:not(.above) {
		bottom: -3.5rem;
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

	@keyframes toolbar-fade-in {
		from {
			opacity: 0;
			transform: translate(-50%, 4px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toolbar {
			animation: none;
		}
	}
</style>
