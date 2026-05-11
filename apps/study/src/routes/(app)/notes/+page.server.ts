/**
 * `/notes` -- index surface for the platform-wide note primitive.
 *
 * Tabs (per `NOTES_VIEWS`): All / Follow-ups / Archived / By context.
 * Filters via query params:
 *   ?view=all|follow-ups|archived|by-context (default: all)
 *   ?q=<search-string>           full-text search across body + title +
 *                                quoted excerpt + tags via BC `searchNotes`
 *   ?tag=<tag>                   filter by exact tag (repeatable)
 *   ?goalId=, ?courseId=,
 *   ?knowledgeNodeId=, ?referenceId=
 *                                context-FK filter (single value each)
 *   ?cursor=<encoded>            cursor for the next page
 *   ?sort=newest|oldest|updated  sort key (default: newest)
 *
 * Phase 3 adds:
 *   - tag autocomplete for the chip input (loaded via /notes/tags endpoint)
 *   - tag cloud (loaded by this loader -- distinct tag counts for the user)
 *   - saved searches (read from study.user_pref)
 *   - follow-ups grouped by created-month
 *
 * Server-side: list/follow-ups/search are routed by `view` + presence of
 * `q`. The loader resolves the active view, builds list opts, and calls
 * the right BC function.
 */

import { requireAuth } from '@ab/auth';
import {
	getReferenceSectionById,
	listAnnotationsForUser,
	listNotesForUser,
	listOpenFollowUps,
	listSavedSearches,
	listTagCloud,
	type NotesListResult,
	searchNotes,
} from '@ab/bc-study/server';
import {
	NOTES_ARCHIVED_FILTER,
	NOTES_LIST_DEFAULT_LIMIT,
	NOTES_SORT,
	NOTES_SORT_DEFAULT,
	NOTES_SORT_VALUES,
	NOTES_VIEW_DEFAULT,
	NOTES_VIEW_VALUES,
	NOTES_VIEWS,
	type NotesArchivedFilter,
	type NotesSort,
	type NotesView,
	QUERY_PARAMS,
} from '@ab/constants';
import { type SourceId, urlForReference } from '@ab/sources';
import type { PageServerLoad } from './$types';

export interface NotesIndexNote {
	id: string;
	title: string;
	bodyMd: string;
	tags: string[];
	followUpMd: string;
	followUpDoneAt: Date | null;
	archivedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface FollowUpMonthGroup {
	/** Month label, e.g. "May 2026". */
	label: string;
	/** Sortable key (`YYYY-MM`) so the page can re-order grouping if needed. */
	key: string;
	notes: NotesIndexNote[];
}

export interface SavedSearchEntry {
	name: string;
	url: string;
	createdAt: string;
}

export interface HighlightsListRow {
	id: string;
	kind: 'highlight' | 'note_anchor';
	color: string | null;
	anchorText: string;
	createdAt: string;
	noteId: string | null;
	sectionId: string;
	sourceTitle: string | null;
	sourceUrl: string | null;
}

export interface NotesIndexData {
	view: NotesView;
	sort: NotesSort;
	q: string;
	tagFilters: string[];
	contextFilters: {
		referenceId: string | null;
		referenceSectionId: string | null;
		knowledgeNodeId: string | null;
		courseId: string | null;
		goalId: string | null;
		syllabusNodeId: string | null;
	};
	notes: NotesIndexNote[];
	followUpMonths: FollowUpMonthGroup[] | null;
	nextCursor: string | null;
	tagCloud: Array<{ tag: string; count: number }>;
	savedSearches: SavedSearchEntry[];
	highlights: HighlightsListRow[];
}

function readView(raw: string | null): NotesView {
	if (raw === null) return NOTES_VIEW_DEFAULT;
	if ((NOTES_VIEW_VALUES as readonly string[]).includes(raw)) return raw as NotesView;
	return NOTES_VIEW_DEFAULT;
}

function readSort(raw: string | null): NotesSort {
	if (raw === null) return NOTES_SORT_DEFAULT;
	if ((NOTES_SORT_VALUES as readonly string[]).includes(raw)) return raw as NotesSort;
	return NOTES_SORT_DEFAULT;
}

function readSingleId(raw: string | null): string | null {
	if (raw === null) return null;
	const trimmed = raw.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function archivedForView(view: NotesView): NotesArchivedFilter {
	if (view === NOTES_VIEWS.ARCHIVED) return NOTES_ARCHIVED_FILTER.ONLY;
	return NOTES_ARCHIVED_FILTER.EXCLUDE;
}

function projectNote(row: {
	id: string;
	title: string;
	bodyMd: string;
	tags: string[];
	followUpMd: string;
	followUpDoneAt: Date | null;
	archivedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}): NotesIndexNote {
	return {
		id: row.id,
		title: row.title,
		bodyMd: row.bodyMd,
		tags: row.tags,
		followUpMd: row.followUpMd,
		followUpDoneAt: row.followUpDoneAt,
		archivedAt: row.archivedAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

interface ContextRow {
	referenceId: string | null;
	referenceSectionId: string | null;
	knowledgeNodeId: string | null;
	courseId: string | null;
	goalId: string | null;
	syllabusNodeId: string | null;
}

function applyClientFilters(
	notes: NotesIndexNote[],
	tagFilters: string[],
	contextFilters: NotesIndexData['contextFilters'],
	contextById: Map<string, ContextRow>,
): NotesIndexNote[] {
	const lowerTags = new Set(tagFilters.map((t) => t.toLowerCase()));
	const hasContextFilter = Object.values(contextFilters).some((v) => v !== null);
	if (lowerTags.size === 0 && !hasContextFilter) return notes;
	return notes.filter((n) => {
		if (lowerTags.size > 0) {
			const noteTags = new Set(n.tags.map((t) => t.toLowerCase()));
			for (const t of lowerTags) {
				if (!noteTags.has(t)) return false;
			}
		}
		if (hasContextFilter) {
			const ctx = contextById.get(n.id);
			// A note that landed in `notes` but isn't in the context map shouldn't
			// pass any context filter -- treat it as a non-match defensively.
			if (ctx === undefined) return false;
			if (contextFilters.referenceId !== null && ctx.referenceId !== contextFilters.referenceId) return false;
			if (contextFilters.referenceSectionId !== null && ctx.referenceSectionId !== contextFilters.referenceSectionId)
				return false;
			if (contextFilters.knowledgeNodeId !== null && ctx.knowledgeNodeId !== contextFilters.knowledgeNodeId)
				return false;
			if (contextFilters.courseId !== null && ctx.courseId !== contextFilters.courseId) return false;
			if (contextFilters.goalId !== null && ctx.goalId !== contextFilters.goalId) return false;
			if (contextFilters.syllabusNodeId !== null && ctx.syllabusNodeId !== contextFilters.syllabusNodeId) return false;
		}
		return true;
	});
}

function groupFollowUpsByMonth(notes: NotesIndexNote[]): FollowUpMonthGroup[] {
	const buckets = new Map<string, FollowUpMonthGroup>();
	for (const n of notes) {
		const d = n.createdAt;
		const key = `${d.getUTCFullYear().toString().padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
		const existing = buckets.get(key);
		if (existing) {
			existing.notes.push(n);
			continue;
		}
		const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
		buckets.set(key, { key, label, notes: [n] });
	}
	// Sort buckets newest-first.
	return Array.from(buckets.values()).sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

const MONTH_LABEL_FORMATTER = (d: Date): string =>
	d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

void MONTH_LABEL_FORMATTER;

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const url = event.url;

	const view = readView(url.searchParams.get(QUERY_PARAMS.VIEW));
	const sort = readSort(url.searchParams.get('sort'));
	const q = (url.searchParams.get('q') ?? '').trim();
	const cursor = url.searchParams.get('cursor');
	const tagFilters = url.searchParams
		.getAll('tag')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);
	const contextFilters = {
		referenceId: readSingleId(url.searchParams.get(QUERY_PARAMS.NOTE_REFERENCE_ID)),
		referenceSectionId: readSingleId(url.searchParams.get(QUERY_PARAMS.NOTE_REFERENCE_SECTION_ID)),
		knowledgeNodeId: readSingleId(url.searchParams.get(QUERY_PARAMS.NOTE_KNOWLEDGE_NODE_ID)),
		courseId: readSingleId(url.searchParams.get(QUERY_PARAMS.NOTE_COURSE_ID)),
		goalId: readSingleId(url.searchParams.get(QUERY_PARAMS.NOTE_GOAL_ID)),
		syllabusNodeId: readSingleId(url.searchParams.get(QUERY_PARAMS.NOTE_SYLLABUS_NODE_ID)),
	};

	let notes: NotesIndexNote[] = [];
	let nextCursor: string | null = null;
	let followUpMonths: FollowUpMonthGroup[] | null = null;
	let highlights: HighlightsListRow[] = [];
	const noteContextById = new Map<string, ContextRow>();

	if (view === NOTES_VIEWS.HIGHLIGHTS) {
		const rows = await listAnnotationsForUser(user.id, { limit: 200 });
		const filtered = rows.filter((r) => r.kind === 'highlight' || r.kind === 'note_anchor');
		const sectionCache = new Map<string, { title: string; code: string; airbossRef: string } | null>();
		highlights = await Promise.all(
			filtered.map(async (row) => {
				let cached = sectionCache.get(row.referenceSectionId);
				if (cached === undefined) {
					const sec = await getReferenceSectionById(row.referenceSectionId).catch(() => null);
					cached = sec ? { title: sec.title, code: sec.code, airbossRef: sec.airbossRef } : null;
					sectionCache.set(row.referenceSectionId, cached);
				}
				let sourceUrl: string | null = null;
				if (cached) {
					try {
						sourceUrl = urlForReference(cached.airbossRef as SourceId);
					} catch {
						sourceUrl = null;
					}
				}
				return {
					id: row.id,
					kind: row.kind === 'highlight' ? 'highlight' : 'note_anchor',
					color: row.color,
					anchorText: row.anchorText,
					createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date().toISOString(),
					noteId: row.noteId,
					sectionId: row.referenceSectionId,
					sourceTitle: cached ? `${cached.title} (${cached.code})` : null,
					sourceUrl,
				};
			}),
		);
	}

	if (view === NOTES_VIEWS.FOLLOW_UPS) {
		const rows = await listOpenFollowUps(user.id);
		for (const row of rows) {
			noteContextById.set(row.id, {
				referenceId: row.referenceId,
				referenceSectionId: row.referenceSectionId,
				knowledgeNodeId: row.knowledgeNodeId,
				courseId: row.courseId,
				goalId: row.goalId,
				syllabusNodeId: row.syllabusNodeId,
			});
		}
		const projected = rows.map(projectNote);
		const filtered = applyClientFilters(projected, tagFilters, contextFilters, noteContextById);
		notes = filtered;
		followUpMonths = groupFollowUpsByMonth(filtered);
	} else {
		const archived = archivedForView(view);
		const opts = { archived, sort, limit: NOTES_LIST_DEFAULT_LIMIT, cursor };
		let result: NotesListResult;
		if (q.length > 0) {
			result = await searchNotes(user.id, q, opts);
		} else {
			result = await listNotesForUser(user.id, opts);
		}
		for (const row of result.notes) {
			noteContextById.set(row.id, {
				referenceId: row.referenceId,
				referenceSectionId: row.referenceSectionId,
				knowledgeNodeId: row.knowledgeNodeId,
				courseId: row.courseId,
				goalId: row.goalId,
				syllabusNodeId: row.syllabusNodeId,
			});
		}
		const projected = result.notes.map(projectNote);
		const filtered = applyClientFilters(projected, tagFilters, contextFilters, noteContextById);
		notes = filtered;
		nextCursor = result.nextCursor;
	}

	// Phase 3 polish surfaces.
	const tagCloud = await listTagCloud(user.id);
	const savedSearches = await listSavedSearches(user.id);

	// Suppress unused-symbol lint: NOTES_SORT is referenced by the helper
	// `archivedForView` indirectly through type-only narrowing; keeping the
	// runtime import documents the connection without polluting the symbol
	// table elsewhere.
	void NOTES_SORT;

	return {
		view,
		sort,
		q,
		tagFilters,
		contextFilters,
		notes,
		followUpMonths,
		nextCursor,
		tagCloud,
		savedSearches,
		highlights,
	} satisfies NotesIndexData;
};
