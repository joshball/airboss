/**
 * Shared composer state for the rich-reader right-column composer
 * (wp-flightbag-rich-reader Phases 4 + 5).
 *
 * The selection toolbar mutates this state when the user picks "Card now"
 * or "Note"; the layout reads it to decide whether to render the composer
 * column or fall back to the per-section notes panel. State is scoped via
 * Svelte 5's context API so a single layout owns the column state and any
 * descendant component (the toolbar, the body, the panel) shares it
 * without prop drilling.
 *
 * Plain `.svelte.ts` so the runes work but Svelte's component compiler
 * doesn't try to template the file.
 */

import type { TextAnchor } from '@ab/utils';
import { getContext, setContext } from 'svelte';

export type ComposerKind = 'card-now' | 'note' | 'note-edit';

export interface CardComposerPrefill {
	front: string;
	back: string;
	domain?: string;
	tags?: readonly string[];
}

export interface NoteComposerPrefill {
	bodyMd?: string;
	title?: string;
	quotedExcerpt?: string;
}

export interface ComposerState {
	readonly kind: ComposerKind | null;
	readonly anchor: TextAnchor | null;
	readonly sourceSectionId: string | null;
	readonly cardPrefill: CardComposerPrefill | null;
	readonly notePrefill: NoteComposerPrefill | null;
	/** When kind === 'note-edit' the composer loads the existing note. */
	readonly editingNoteId: string | null;
	openCardComposer(input: { anchor: TextAnchor | null; sourceSectionId: string; prefill: CardComposerPrefill }): void;
	openNoteComposer(input: { anchor: TextAnchor | null; sourceSectionId: string; prefill: NoteComposerPrefill }): void;
	openNoteForEdit(noteId: string): void;
	close(): void;
}

const COMPOSER_CONTEXT_KEY = Symbol('rich-reader-composer-state');

export function createComposerState(): ComposerState {
	let kind = $state<ComposerKind | null>(null);
	let anchor = $state<TextAnchor | null>(null);
	let sourceSectionId = $state<string | null>(null);
	let cardPrefill = $state<CardComposerPrefill | null>(null);
	let notePrefill = $state<NoteComposerPrefill | null>(null);
	let editingNoteId = $state<string | null>(null);

	const state: ComposerState = {
		get kind() {
			return kind;
		},
		get anchor() {
			return anchor;
		},
		get sourceSectionId() {
			return sourceSectionId;
		},
		get cardPrefill() {
			return cardPrefill;
		},
		get notePrefill() {
			return notePrefill;
		},
		get editingNoteId() {
			return editingNoteId;
		},
		openCardComposer({ anchor: a, sourceSectionId: id, prefill }) {
			kind = 'card-now';
			anchor = a;
			sourceSectionId = id;
			cardPrefill = prefill;
			notePrefill = null;
			editingNoteId = null;
		},
		openNoteComposer({ anchor: a, sourceSectionId: id, prefill }) {
			kind = 'note';
			anchor = a;
			sourceSectionId = id;
			notePrefill = prefill;
			cardPrefill = null;
			editingNoteId = null;
		},
		openNoteForEdit(noteId) {
			kind = 'note-edit';
			editingNoteId = noteId;
			anchor = null;
			cardPrefill = null;
			notePrefill = null;
		},
		close() {
			kind = null;
			anchor = null;
			sourceSectionId = null;
			cardPrefill = null;
			notePrefill = null;
			editingNoteId = null;
		},
	};
	return state;
}

export function provideComposerState(): ComposerState {
	const state = createComposerState();
	setContext(COMPOSER_CONTEXT_KEY, state);
	return state;
}

export function useComposerState(): ComposerState | null {
	return getContext<ComposerState | undefined>(COMPOSER_CONTEXT_KEY) ?? null;
}
