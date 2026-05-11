/**
 * Browser-side helpers for the annotations API
 * (wp-flightbag-rich-reader).
 *
 * Thin wrappers over `fetch` so reader pages can call create / update /
 * delete without building the request/response shape every time.
 */

import type { HighlightColor } from '@ab/constants';
import type { TextAnchor } from '@ab/utils';

export interface AnnotationApiRow {
	id: string;
	userId: string;
	referenceSectionId: string;
	kind: string;
	color: string | null;
	anchorText: string;
	anchorStart: number;
	anchorEnd: number;
	prefixContext: string;
	suffixContext: string;
	noteId: string | null;
	cardDraftId: string | null;
	createdAt: string;
	updatedAt: string;
}

export async function createHighlightApi(
	sectionId: string,
	anchor: TextAnchor,
	color: HighlightColor,
): Promise<AnnotationApiRow> {
	const res = await fetch('/api/annotations', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ kind: 'highlight', sectionId, anchor, color }),
	});
	if (!res.ok) throw new Error(`createHighlight failed (${res.status})`);
	return (await res.json()) as AnnotationApiRow;
}

export async function updateHighlightColorApi(id: string, color: HighlightColor): Promise<AnnotationApiRow> {
	const res = await fetch(`/api/annotations/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ color }),
	});
	if (!res.ok) throw new Error(`updateHighlightColor failed (${res.status})`);
	return (await res.json()) as AnnotationApiRow;
}

export async function deleteAnnotationApi(id: string): Promise<void> {
	const res = await fetch(`/api/annotations/${encodeURIComponent(id)}`, { method: 'DELETE' });
	if (!res.ok && res.status !== 204) throw new Error(`deleteAnnotation failed (${res.status})`);
}

export interface CardDraftApiInput {
	sectionId?: string;
	anchor?: TextAnchor;
	front?: string;
	back?: string;
}

export interface CardDraftApiResult {
	draft: {
		id: string;
		front: string;
		back: string;
	};
	annotation: AnnotationApiRow | null;
}

export async function createCardDraftApi(input: CardDraftApiInput): Promise<CardDraftApiResult> {
	const res = await fetch('/api/card-drafts', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input),
	});
	if (!res.ok) throw new Error(`createCardDraft failed (${res.status})`);
	return (await res.json()) as CardDraftApiResult;
}
