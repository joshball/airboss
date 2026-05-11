<script lang="ts" module>
/**
 * Right-column composer panel for the rich reader. Reads composer state
 * + section context from the layout's context, and renders one of:
 *
 *   - <InlineCardComposer>   when state.kind === 'card-now'
 *   - <InlineNoteComposer>   when state.kind === 'note'
 *   - <SectionNotesPanel>    when state.kind === null (default)
 *
 * Save handlers post to the same-origin API:
 *   - card-now -> POST /api/cards (createCard)
 *   - note     -> POST /api/notes (createNoteWithAnchor)
 *
 * The composer stays open after save so the user can author another
 * card/note from the same passage.
 */
</script>

<script lang="ts">
import { CARD_KINDS, CARD_TYPES, domainLabel, DOMAIN_VALUES } from '@ab/constants';
import {
	type SectionContextNote,
	useComposerState,
	useSectionContext,
} from '@ab/library';
import InlineCardComposer from '@ab/library/InlineCardComposer.svelte';
import InlineNoteComposer from '@ab/library/InlineNoteComposer.svelte';
import SectionNotesPanel from '@ab/library/SectionNotesPanel.svelte';
import { createNoteWithAnchorApi } from './annotations-client';

const composerState = useComposerState();
const sectionContext = useSectionContext();

let busy = $state(false);
let flash = $state<string | null>(null);
let errorMessage = $state<string | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;

const domains = DOMAIN_VALUES.map((value) => ({ value, label: domainLabel(value) }));

function setFlash(message: string) {
	flash = message;
	if (flashTimer) clearTimeout(flashTimer);
	flashTimer = setTimeout(() => {
		flash = null;
	}, 1800);
}

async function onCardSave(input: { front: string; back: string; domain: string; tags: string[] }) {
	if (!composerState) return;
	busy = true;
	errorMessage = null;
	try {
		const res = await fetch('/api/cards', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				front: input.front,
				back: input.back,
				domain: input.domain,
				cardType: CARD_TYPES.BASIC,
				kind: CARD_KINDS.RECALL,
				tags: input.tags,
			}),
		});
		if (!res.ok) {
			const payload = (await res.json().catch(() => null)) as { error?: string } | null;
			errorMessage = payload?.error ?? `Save failed (${res.status}).`;
			return;
		}
		setFlash('Card saved.');
	} catch (err) {
		console.error(err);
		errorMessage = "Couldn't save card. Try again?";
	} finally {
		busy = false;
	}
}

async function onNoteSave(input: { bodyMd: string; title: string; quotedExcerpt: string; tags: string[] }) {
	if (!composerState || !composerState.anchor || !composerState.sourceSectionId || !sectionContext) return;
	busy = true;
	errorMessage = null;
	try {
		const result = await createNoteWithAnchorApi({
			sectionId: composerState.sourceSectionId,
			anchor: composerState.anchor,
			bodyMd: input.bodyMd,
			title: input.title,
			quotedExcerpt: input.quotedExcerpt,
			tags: input.tags,
		});
		const next: SectionContextNote = {
			id: result.note.id,
			title: result.note.title,
			bodyMd: result.note.bodyMd,
			quotedExcerpt: result.note.quotedExcerpt,
			tags: result.note.tags,
			followUpMd: result.note.followUpMd,
			createdAt: result.note.createdAt,
			updatedAt: result.note.updatedAt,
		};
		sectionContext.upsertNote(next);
		setFlash('Note saved.');
		composerState.close();
	} catch (err) {
		console.error(err);
		errorMessage = err instanceof Error ? err.message : "Couldn't save note. Try again?";
	} finally {
		busy = false;
	}
}

function close() {
	composerState?.close();
}

function openFreestandingNote() {
	if (!composerState || !sectionContext?.section) return;
	composerState.openNoteComposer({
		anchor: null,
		sourceSectionId: sectionContext.section.id,
		prefill: { bodyMd: '' },
	});
}

function openExistingNote(noteId: string) {
	composerState?.openNoteForEdit(noteId);
}
</script>

{#if composerState && composerState.kind === 'note-edit' && composerState.editingNoteId && sectionContext}
	{@const editingNote = sectionContext.notes.find((n) => n.id === composerState?.editingNoteId)}
	{#if editingNote}
		<InlineNoteComposer
			prefill={{
				bodyMd: editingNote.bodyMd,
				title: editingNote.title,
				quotedExcerpt: editingNote.quotedExcerpt,
			}}
			onSave={async (input) => {
				busy = true;
				errorMessage = null;
				try {
					const res = await fetch(`/api/notes/${encodeURIComponent(editingNote.id)}`, {
						method: 'PATCH',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							bodyMd: input.bodyMd,
							title: input.title,
							quotedExcerpt: input.quotedExcerpt,
							tags: input.tags,
						}),
					});
					if (!res.ok) {
						const payload = (await res.json().catch(() => null)) as { error?: string } | null;
						errorMessage = payload?.error ?? `Save failed (${res.status}).`;
						return;
					}
					const updated = await res.json();
					sectionContext.upsertNote({
						id: updated.id,
						title: updated.title,
						bodyMd: updated.bodyMd,
						quotedExcerpt: updated.quotedExcerpt,
						tags: updated.tags,
						followUpMd: updated.followUpMd,
						createdAt: updated.createdAt,
						updatedAt: updated.updatedAt,
					});
					setFlash('Note saved.');
					composerState?.close();
				} catch (err) {
					console.error(err);
					errorMessage = err instanceof Error ? err.message : "Couldn't save note.";
				} finally {
					busy = false;
				}
			}}
			onClose={close}
			{busy}
			{flash}
			{errorMessage}
		/>
	{:else}
		<p class="missing">Note not found in this section. <button type="button" onclick={close}>Close</button></p>
	{/if}
{:else if composerState && composerState.kind === 'card-now' && composerState.cardPrefill}
	<InlineCardComposer
		prefill={composerState.cardPrefill}
		{domains}
		onSave={onCardSave}
		onClose={close}
		{busy}
		{flash}
		{errorMessage}
	/>
{:else if composerState && composerState.kind === 'note' && composerState.notePrefill}
	{#if composerState.anchor === null}
		<!-- Freestanding section note: post without an anchor; falls through
		     to the same /api/notes endpoint. -->
		<InlineNoteComposer
			prefill={composerState.notePrefill}
			onSave={async (input) => {
				if (!sectionContext?.section) return;
				busy = true;
				errorMessage = null;
				try {
					const result = await createNoteWithAnchorApi({
						bodyMd: input.bodyMd,
						title: input.title,
						quotedExcerpt: input.quotedExcerpt,
						tags: input.tags,
					});
					sectionContext.upsertNote({
						id: result.note.id,
						title: result.note.title,
						bodyMd: result.note.bodyMd,
						quotedExcerpt: result.note.quotedExcerpt,
						tags: result.note.tags,
						followUpMd: result.note.followUpMd,
						createdAt: result.note.createdAt,
						updatedAt: result.note.updatedAt,
					});
					setFlash('Note saved.');
					composerState?.close();
				} catch (err) {
					console.error(err);
					errorMessage = err instanceof Error ? err.message : "Couldn't save note.";
				} finally {
					busy = false;
				}
			}}
			onClose={close}
			{busy}
			{flash}
			{errorMessage}
		/>
	{:else}
		<InlineNoteComposer
			prefill={composerState.notePrefill}
			onSave={onNoteSave}
			onClose={close}
			{busy}
			{flash}
			{errorMessage}
		/>
	{/if}
{:else if sectionContext}
	<SectionNotesPanel
		notes={sectionContext.notes}
		onAddNote={openFreestandingNote}
		onOpenNote={openExistingNote}
	/>
{/if}
