/**
 * Per-section annotation + notes loader (wp-flightbag-rich-reader).
 *
 * Section page-servers in the flightbag (handbook / AIM / CFR / ACS / AC)
 * call `loadSectionAnnotationContext` to pick up:
 *   - the user's stored annotations (highlights, note-anchors, draft-anchors)
 *   - the user's notes attached to this section
 *   - the user's annotation-visibility filter pref
 *
 * Anonymous callers get empty arrays + the default filter so the body
 * renders without a per-user round trip.
 */

import {
	getUserPrefs,
	listAnnotationsForSection,
	listNotesForSection,
	type NoteRow,
	type ReferenceSectionAnnotationRow,
} from '@ab/bc-study/server';
import {
	ANNOTATION_FILTER_DEFAULT,
	type AnnotationFilter,
	type AnnotationKind,
	type HighlightColor,
	USER_PREF_KEYS,
} from '@ab/constants';

export interface SectionAnnotationPayload {
	readonly id: string;
	readonly kind: AnnotationKind;
	readonly color: HighlightColor | null;
	readonly noteId: string | null;
	readonly cardDraftId: string | null;
	readonly createdAt: string | null;
	readonly anchor: {
		text: string;
		start: number;
		end: number;
		prefix: string;
		suffix: string;
	};
}

export interface SectionNotePayload {
	readonly id: string;
	readonly title: string;
	readonly bodyMd: string;
	readonly quotedExcerpt: string;
	readonly tags: readonly string[];
	readonly followUpMd: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface SectionAnnotationContext {
	readonly annotations: readonly SectionAnnotationPayload[];
	readonly notes: readonly SectionNotePayload[];
	readonly filter: AnnotationFilter;
	readonly isAuthenticated: boolean;
}

function isAnnotationKind(value: string): value is AnnotationKind {
	return value === 'highlight' || value === 'note_anchor' || value === 'card_draft_anchor';
}

function isHighlightColor(value: string): value is HighlightColor {
	return value === 'yellow' || value === 'blue' || value === 'green' || value === 'pink';
}

function projectAnnotation(row: ReferenceSectionAnnotationRow): SectionAnnotationPayload {
	const kind: AnnotationKind = isAnnotationKind(row.kind) ? row.kind : 'highlight';
	const color: HighlightColor | null = row.color !== null && isHighlightColor(row.color) ? row.color : null;
	return {
		id: row.id,
		kind,
		color,
		noteId: row.noteId,
		cardDraftId: row.cardDraftId,
		createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : null,
		anchor: {
			text: row.anchorText,
			start: row.anchorStart,
			end: row.anchorEnd,
			prefix: row.prefixContext,
			suffix: row.suffixContext,
		},
	};
}

function projectNote(row: NoteRow): SectionNotePayload {
	return {
		id: row.id,
		title: row.title,
		bodyMd: row.bodyMd,
		quotedExcerpt: row.quotedExcerpt,
		tags: row.tags,
		followUpMd: row.followUpMd,
		createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date().toISOString(),
		updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date().toISOString(),
	};
}

function isAnnotationFilter(value: unknown): value is AnnotationFilter {
	return value === 'all' || value === 'highlights-only' || value === 'notes-only' || value === 'hidden';
}

export async function loadSectionAnnotationContext(
	userId: string | null,
	sectionId: string,
): Promise<SectionAnnotationContext> {
	if (userId === null) {
		return {
			annotations: [],
			notes: [],
			filter: ANNOTATION_FILTER_DEFAULT,
			isAuthenticated: false,
		};
	}
	const [annotations, notes, prefs] = await Promise.all([
		listAnnotationsForSection(userId, sectionId),
		listNotesForSection(userId, sectionId),
		getUserPrefs(userId, [USER_PREF_KEYS.READING_ANNOTATION_FILTER]),
	]);
	const stored = prefs[USER_PREF_KEYS.READING_ANNOTATION_FILTER];
	const filter: AnnotationFilter = isAnnotationFilter(stored) ? stored : ANNOTATION_FILTER_DEFAULT;
	return {
		annotations: annotations.map(projectAnnotation),
		notes: notes.map(projectNote),
		filter,
		isAuthenticated: true,
	};
}
