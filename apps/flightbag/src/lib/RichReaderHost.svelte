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
	readonly notes: ReadonlyArray<{
		id: string;
		title: string;
		bodyMd: string;
		quotedExcerpt: string;
		tags: ReadonlyArray<string>;
		followUpMd: string;
		createdAt: string;
		updatedAt: string;
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
import { ROUTES, USER_PREF_KEYS } from '@ab/constants';
import { onDestroy } from 'svelte';
import { useComposerState, useSectionContext } from '@ab/library';
import AnnotationFilterChip from '@ab/library/AnnotationFilterChip.svelte';
import AnnotationLayer from '@ab/library/AnnotationLayer.svelte';
import SelectionToolbar from '@ab/library/SelectionToolbar.svelte';
import Toast from '@ab/ui/components/Toast.svelte';
import {
	createCardDraftApi,
	createHighlightApi,
	createNoteWithAnchorApi,
	deleteAnnotationApi,
	updateHighlightColorApi,
} from './annotations-client';

let { section, bodyText, isAuthenticated, annotationContext, onToast }: RichReaderHostProps = $props();

const composerState = useComposerState();

// Use the section context provided at the flightbag root layout. The
// host populates it on every section change so the layout's composer
// panel can render the per-section notes list.
const sectionContext = useSectionContext();
$effect(() => {
	sectionContext?.setSection(
		section,
		annotationContext.notes.map((n) => ({
			id: n.id,
			title: n.title,
			bodyMd: n.bodyMd,
			quotedExcerpt: n.quotedExcerpt,
			tags: n.tags,
			followUpMd: n.followUpMd,
			createdAt: n.createdAt,
			updatedAt: n.updatedAt,
		})),
	);
});

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
let filter = $state<AnnotationFilter>(annotationContext.filter);

$effect(() => {
	// Re-sync filter when navigating to a different section (the
	// page-server reads the user pref again and the prop updates).
	filter = annotationContext.filter;
});

async function onFilterChange(next: AnnotationFilter) {
	filter = next;
	try {
		await fetch(ROUTES.READING_PREFS, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key: USER_PREF_KEYS.READING_ANNOTATION_FILTER, value: next }),
		});
	} catch {
		// Non-fatal: the cookie / pref just won't persist this turn. The
		// in-page filter has already flipped via $state above.
	}
}

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

function onNote(anchor: TextAnchor) {
	if (!isAuthenticated || !composerState) {
		showToast('Sign in to take notes.');
		return;
	}
	composerState.openNoteComposer({
		anchor,
		sourceSectionId: section.id,
		prefill: { quotedExcerpt: anchor.text, bodyMd: '' },
	});
}

function onCardNow(anchor: TextAnchor) {
	if (!isAuthenticated || !composerState) {
		showToast('Sign in to author cards.');
		return;
	}
	const sourceCitation = `\n\n— Source: [${section.title} (${section.code})](${section.airbossRef})`;
	const back = `> ${anchor.text}${sourceCitation}`;
	composerState.openCardComposer({
		anchor,
		sourceSectionId: section.id,
		prefill: { front: '', back, domain: '' },
	});
}

async function onCardDraft(anchor: TextAnchor) {
	if (!isAuthenticated) {
		showToast('Sign in to queue card drafts.');
		return;
	}
	const sourceCitation = `\n\n— Source: [${section.title} (${section.code})](${section.airbossRef})`;
	try {
		const result = await createCardDraftApi({
			sectionId: section.id,
			anchor,
			front: '',
			back: `> ${anchor.text}${sourceCitation}`,
		});
		if (result.annotation) {
			annotations = [
				...annotations,
				{
					id: result.annotation.id,
					kind: 'card_draft_anchor',
					color: null,
					noteId: null,
					cardDraftId: result.annotation.cardDraftId,
					createdAt: result.annotation.createdAt,
					anchor: {
						text: result.annotation.anchorText,
						start: result.annotation.anchorStart,
						end: result.annotation.anchorEnd,
						prefix: result.annotation.prefixContext,
						suffix: result.annotation.suffixContext,
					},
				},
			];
		}
		showToast('Draft queued. Open /memory/drafts to promote.');
	} catch (err) {
		console.error(err);
		showToast("Couldn't queue draft. Try again?");
	}
}

function onCopied() {
	showToast('Copied with citation.');
}

function onOrphans(list: readonly AnnotationLayerRecord[]) {
	orphans = [...list];
}

function onNoteAnchorClicked(noteId: string) {
	composerState?.openNoteForEdit(noteId);
}

// Clear any pending toast timer on unmount so a toast fired just before
// navigation doesn't write `$state` on a destroyed component.
onDestroy(() => {
	if (toastTimer) clearTimeout(toastTimer);
});
</script>

{#if isAuthenticated}
	<SelectionToolbar
		{section}
		{bodyText}
		{onHighlight}
		{onCardDraft}
		{onCardNow}
		{onNote}
		{onCopied}
	/>
	<div class="reader-chrome" data-testid="reader-chrome">
		<AnnotationFilterChip value={filter} onchange={onFilterChange} />
	</div>
	<AnnotationLayer
		{annotations}
		{filter}
		{onEditColor}
		{onRemove}
		onorphans={onOrphans}
		onNoteClicked={onNoteAnchorClicked}
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
		z-index: var(--z-toast);
		pointer-events: none;
	}

	.reader-chrome {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-xs);
		margin: var(--space-xs) 0;
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
