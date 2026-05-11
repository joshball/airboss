/**
 * Active reader-section context (wp-flightbag-rich-reader Phase 5).
 *
 * The per-section page provides the section identity + the user's notes
 * for that section so the doc-layout's composer panel can render the
 * `<SectionNotesPanel>` without re-loading data. Mirrors the composer
 * state pattern: provider in the host, consumer in the panel.
 */

import { getContext, setContext } from 'svelte';

export interface SectionContextSection {
	id: string;
	title: string;
	code: string;
	airbossRef: string;
}

export interface SectionContextNote {
	id: string;
	title: string;
	bodyMd: string;
	quotedExcerpt: string;
	tags: ReadonlyArray<string>;
	followUpMd: string;
	createdAt: string;
	updatedAt: string;
}

export interface SectionContext {
	readonly section: SectionContextSection | null;
	readonly notes: ReadonlyArray<SectionContextNote>;
	setSection(section: SectionContextSection | null, notes: ReadonlyArray<SectionContextNote>): void;
	upsertNote(note: SectionContextNote): void;
	removeNote(noteId: string): void;
}

const SECTION_CONTEXT_KEY = Symbol('rich-reader-section-context');

export function createSectionContext(): SectionContext {
	let section = $state<SectionContextSection | null>(null);
	let notes = $state<readonly SectionContextNote[]>([]);

	const ctx: SectionContext = {
		get section() {
			return section;
		},
		get notes() {
			return notes;
		},
		setSection(next, nextNotes) {
			section = next;
			notes = nextNotes;
		},
		upsertNote(note) {
			const existing = notes.findIndex((n) => n.id === note.id);
			if (existing === -1) {
				notes = [note, ...notes];
			} else {
				notes = notes.map((n) => (n.id === note.id ? note : n));
			}
		},
		removeNote(noteId) {
			notes = notes.filter((n) => n.id !== noteId);
		},
	};
	return ctx;
}

export function provideSectionContext(): SectionContext {
	const ctx = createSectionContext();
	setContext(SECTION_CONTEXT_KEY, ctx);
	return ctx;
}

export function useSectionContext(): SectionContext | null {
	return getContext<SectionContext | undefined>(SECTION_CONTEXT_KEY) ?? null;
}
