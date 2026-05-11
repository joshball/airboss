<script lang="ts" module>
import type { AnnotationFilter, HighlightColor } from '@ab/constants';
import type { AnnotationLayerRecord } from '@ab/library';
import type { TextAnchor } from '@ab/utils';

/**
 * Reusable host that mounts the SelectionToolbar + AnnotationLayer for a
 * `<RenderedSection>` and wires the highlight + copy-with-citation flow
 * against `/api/annotations`. Reader pages (handbook / AIM / CFR / ACS /
 * AC) drop one of these inside their layout to enable rich-reader
 * interactions.
 *
 * The host owns the local annotation state, toast surface, and orphan
 * bubble-up. Parents pass the section identity (id, title, code,
 * airboss-ref URI), the user's authenticated state, and the page-server's
 * annotation context.
 */

export interface RichReaderSection {
	readonly id: string;
	readonly title: string;
	/** Display code (e.g. "12.3", "1-1-7", "91.103(b)"). Used in copy-with-citation. */
	readonly code: string;
	readonly airbossRef: string;
}

export interface RichReaderAnnotationContext {
	readonly annotations: ReadonlyArray<{
		id: string;
		kind: 'highlight' | 'note_anchor' | 'card_draft_anchor';
		color: HighlightColor | null;
		noteId: string | null;
		cardDraftId: string | null;
		createdAt: string | null;
		anchor: { text: string; start: number; end: number; prefix: string; suffix: string };
	}>;
	readonly filter: AnnotationFilter;
}

export interface RichReaderHostProps {
	readonly section: RichReaderSection;
	readonly bodyText: string;
	readonly isAuthenticated: boolean;
	readonly annotationContext: RichReaderAnnotationContext;
	/** Optional callback invoked on toast events so the host can log. */
	readonly onToast?: (message: string) => void;
}
</script>

<script lang="ts">
import AnnotationLayer from '@ab/library/AnnotationLayer.svelte';
import SelectionToolbar from '@ab/library/SelectionToolbar.svelte';
import Toast from '@ab/ui/components/Toast.svelte';
import {
	createHighlightApi,
	deleteAnnotationApi,
	updateHighlightColorApi,
} from './annotations-client';

let { section, bodyText, isAuthenticated, annotationContext, onToast }: RichReaderHostProps = $props();

let annotations = $state<AnnotationLayerRecord[]>(
	annotationContext.annotations.map((a) => ({
		id: a.id,
		kind: a.kind,
		color: a.color,
		noteId: a.noteId,
		cardDraftId: a.cardDraftId,
		createdAt: a.createdAt,
		anchor: a.anchor,
	})),
);
let toastVisible = $state(false);
let toastMessage = $state('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let orphans = $state<AnnotationLayerRecord[]>([]);

function showToast(message: string) {
	toastMessage = message;
	onToast?.(message);
	toastVisible = true;
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => {
		toastVisible = false;
	}, 2200);
}

async function onHighlight(anchor: TextAnchor, color: HighlightColor) {
	if (!isAuthenticated) {
		showToast('Sign in to save highlights.');
		return;
	}
	try {
		const row = await createHighlightApi(section.id, anchor, color);
		annotations = [
			...annotations,
			{
				id: row.id,
				kind: 'highlight',
				color: row.color as HighlightColor | null,
				noteId: row.noteId,
				cardDraftId: row.cardDraftId,
				createdAt: row.createdAt,
				anchor: {
					text: row.anchorText,
					start: row.anchorStart,
					end: row.anchorEnd,
					prefix: row.prefixContext,
					suffix: row.suffixContext,
				},
			},
		];
		showToast('Highlighted.');
	} catch (err) {
		console.error(err);
		showToast("Couldn't save highlight. Try again?");
	}
}

async function onEditColor(id: string, color: HighlightColor) {
	try {
		const row = await updateHighlightColorApi(id, color);
		annotations = annotations.map((a) =>
			a.id === id ? { ...a, color: row.color as HighlightColor | null } : a,
		);
	} catch (err) {
		console.error(err);
		showToast("Couldn't update color.");
	}
}

async function onRemove(id: string) {
	try {
		await deleteAnnotationApi(id);
		annotations = annotations.filter((a) => a.id !== id);
		showToast('Removed.');
	} catch (err) {
		console.error(err);
		showToast("Couldn't remove annotation.");
	}
}

function onCopied() {
	showToast('Copied with citation.');
}

function onOrphans(list: readonly AnnotationLayerRecord[]) {
	orphans = [...list];
}
</script>

{#if isAuthenticated}
	<SelectionToolbar
		{section}
		{bodyText}
		{onHighlight}
		{onCopied}
	/>
	<AnnotationLayer
		{annotations}
		filter={annotationContext.filter}
		{onEditColor}
		{onRemove}
		onorphans={onOrphans}
	/>
	{#if orphans.length > 0}
		<aside class="orphan-panel" aria-label="Orphan annotations" data-testid="orphan-panel">
			<h3>Couldn't find {orphans.length} passage{orphans.length === 1 ? '' : 's'}</h3>
			<p>The body changed after these were saved. Remove them or jump to source.</p>
			<ul>
				{#each orphans as orphan (orphan.id)}
					<li>
						<span class="orphan-text">"{orphan.anchor.text.slice(0, 96)}"</span>
						<button type="button" class="orphan-action" onclick={() => onRemove(orphan.id)}>Remove</button>
					</li>
				{/each}
			</ul>
		</aside>
	{/if}
{/if}

{#if toastVisible}
	<div class="toast-host" data-testid="toast-host">
		<Toast tone="success" shape="pill">{toastMessage}</Toast>
	</div>
{/if}

<style>
	.toast-host {
		position: fixed;
		bottom: var(--space-lg);
		left: 50%;
		transform: translateX(-50%);
		z-index: 80;
		pointer-events: none;
	}

	.orphan-panel {
		margin-top: var(--space-lg);
		padding: var(--space-md);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
	}

	.orphan-panel h3 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-base);
	}

	.orphan-panel p {
		margin: 0 0 var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.orphan-panel ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.orphan-panel li {
		display: flex;
		justify-content: space-between;
		gap: var(--space-sm);
		align-items: center;
		font-size: var(--font-size-sm);
	}

	.orphan-text {
		flex: 1;
		color: var(--ink-muted);
		font-style: italic;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.orphan-action {
		appearance: none;
		background: transparent;
		border: 1px solid var(--edge-default);
		padding: var(--space-3xs) var(--space-xs);
		border-radius: var(--radius-sm);
		font: inherit;
		cursor: pointer;
	}
</style>
