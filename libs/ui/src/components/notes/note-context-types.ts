/**
 * Shared types for the notes UI primitives. Lives in a `.ts` so the
 * .svelte components can `import type` without dragging
 * Svelte-specific types between them.
 */

/** Closed set of context kinds a note may attach to. */
export const NOTE_CONTEXT_KINDS = ['reference', 'section', 'goal', 'course', 'knowledge', 'syllabus'] as const;

export type NoteContextKind = (typeof NOTE_CONTEXT_KINDS)[number];

/** A single chip rendered by `<NoteContextChips>`. */
export interface NoteContextChip {
	kind: NoteContextKind;
	id: string;
	label: string;
	href?: string;
}

/** Full context payload edited by `<NoteContextPicker>` / `<NoteComposer>`. */
export interface NoteContext {
	referenceId: string | null;
	referenceSectionId: string | null;
	knowledgeNodeId: string | null;
	courseId: string | null;
	goalId: string | null;
	syllabusNodeId: string | null;
}

/** Closed list option provided to `<NoteContextPicker>`. */
export interface NoteContextOption {
	id: string;
	label: string;
}

/** Options bundle for `<NoteContextPicker>`. Each axis is optional;
 * absent axes render a "none available" placeholder. */
export interface NoteContextOptions {
	references?: NoteContextOption[];
	sections?: NoteContextOption[];
	knowledgeNodes?: NoteContextOption[];
	courses?: NoteContextOption[];
	goals?: NoteContextOption[];
	syllabusNodes?: NoteContextOption[];
}

/** Empty context object -- handy default for callers. */
export const EMPTY_NOTE_CONTEXT: NoteContext = {
	referenceId: null,
	referenceSectionId: null,
	knowledgeNodeId: null,
	courseId: null,
	goalId: null,
	syllabusNodeId: null,
};
