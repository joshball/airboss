/**
 * `/handbooks/[doc]/[chapter]` -- chapter overview / read view.
 *
 * For handbooks whose ingestion produced sections under a chapter, this page
 * lists those sections. For handbooks whose v1 ingestion only produced
 * chapter-granularity rows (PHAK 25C), this page renders the chapter's
 * markdown body directly so a learner can read end-to-end without a separate
 * URL hop. The "Knowledge nodes that cite this chapter" panel works either way.
 */

import { requireAuth } from '@ab/auth';
import {
	getHandbookChapter,
	getNodesCitingSection,
	getReadState,
	getReferenceByDocument,
	getReferenceById,
	HandbookValidationError,
	handbookReadStatusSchema,
	listChapterSections,
	listFiguresForSection,
	markAsReread,
	setComprehended,
	setNotes,
	setReadStatus,
} from '@ab/bc-study';
import { HANDBOOK_NOTES_MAX_LENGTH, HANDBOOK_READ_STATUSES, QUERY_PARAMS } from '@ab/constants';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const documentSlug = event.params.doc;
	const chapterCode = event.params.chapter;
	const editionParam = event.url.searchParams.get(QUERY_PARAMS.EDITION) ?? undefined;

	const ref = await getReferenceByDocument(documentSlug, { edition: editionParam }).catch(() => null);
	if (!ref) throw error(404, `Handbook not found: ${documentSlug}`);

	const chapter = await getHandbookChapter(ref.id, chapterCode).catch(() => null);
	if (!chapter) throw error(404, `Chapter not found: ${documentSlug} / ${chapterCode}`);

	const sections = await listChapterSections(chapter.id);
	const figures = sections.length === 0 ? await listFiguresForSection(chapter.id) : [];
	const readState = await getReadState(user.id, chapter.id);
	const citingNodes = await getNodesCitingSection({
		referenceId: ref.id,
		chapter: Number(chapterCode),
	});

	const latest = ref.supersededById ? await getReferenceById(ref.supersededById).catch(() => null) : null;

	return {
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			supersededByEdition: latest?.edition ?? null,
		},
		chapter: {
			id: chapter.id,
			code: chapter.code,
			title: chapter.title,
			contentMd: chapter.contentMd,
			faaPageStart: chapter.faaPageStart,
			faaPageEnd: chapter.faaPageEnd,
			sourceLocator: chapter.sourceLocator,
		},
		sections: sections.map((s) => ({
			id: s.id,
			code: s.code,
			title: s.title,
			ordinal: s.ordinal,
			faaPageStart: s.faaPageStart,
			faaPageEnd: s.faaPageEnd,
		})),
		figures: figures.map((f) => ({
			id: f.id,
			ordinal: f.ordinal,
			caption: f.caption,
			assetPath: f.assetPath,
			width: f.width,
			height: f.height,
		})),
		readState: readState
			? {
					status: readState.status,
					comprehended: readState.comprehended,
					notesMd: readState.notesMd,
				}
			: { status: HANDBOOK_READ_STATUSES.UNREAD, comprehended: false, notesMd: '' },
		citingNodes: citingNodes.map((n) => ({
			id: n.id,
			title: n.title,
			domain: n.domain,
		})),
	};
};

/**
 * Form actions backing the read-progress control + notes editor on the
 * chapter page. Each action operates on the chapter row's `id` (resolved
 * from the URL params), so a learner reading the chapter directly gets
 * the same per-section read tracking as future per-section pages.
 */
export const actions: Actions = {
	'set-status': async (event) => {
		const user = requireAuth(event);
		const ref = await getReferenceByDocument(event.params.doc).catch(() => null);
		if (!ref) throw error(404, 'Handbook not found');
		const chapter = await getHandbookChapter(ref.id, event.params.chapter).catch(() => null);
		if (!chapter) throw error(404, 'Chapter not found');

		const formData = await event.request.formData();
		const rawStatus = String(formData.get('status') ?? '');
		const parsed = handbookReadStatusSchema.safeParse(rawStatus);
		if (!parsed.success) return fail(400, { fieldError: 'Invalid status' });
		await setReadStatus(user.id, chapter.id, parsed.data);
		return { ok: true };
	},

	'set-comprehended': async (event) => {
		const user = requireAuth(event);
		const ref = await getReferenceByDocument(event.params.doc).catch(() => null);
		if (!ref) throw error(404, 'Handbook not found');
		const chapter = await getHandbookChapter(ref.id, event.params.chapter).catch(() => null);
		if (!chapter) throw error(404, 'Chapter not found');

		const formData = await event.request.formData();
		const comprehended = String(formData.get('comprehended') ?? '') === 'true';
		try {
			await setComprehended(user.id, chapter.id, comprehended);
		} catch (err) {
			if (err instanceof HandbookValidationError) {
				return fail(409, { fieldError: err.message });
			}
			throw err;
		}
		return { ok: true };
	},

	'mark-reread': async (event) => {
		const user = requireAuth(event);
		const ref = await getReferenceByDocument(event.params.doc).catch(() => null);
		if (!ref) throw error(404, 'Handbook not found');
		const chapter = await getHandbookChapter(ref.id, event.params.chapter).catch(() => null);
		if (!chapter) throw error(404, 'Chapter not found');
		try {
			await markAsReread(user.id, chapter.id);
		} catch (err) {
			if (err instanceof HandbookValidationError) {
				return fail(409, { fieldError: err.message });
			}
			throw err;
		}
		return { ok: true };
	},

	'set-notes': async (event) => {
		const user = requireAuth(event);
		const ref = await getReferenceByDocument(event.params.doc).catch(() => null);
		if (!ref) throw error(404, 'Handbook not found');
		const chapter = await getHandbookChapter(ref.id, event.params.chapter).catch(() => null);
		if (!chapter) throw error(404, 'Chapter not found');

		const formData = await event.request.formData();
		const notesMd = String(formData.get('notesMd') ?? '');
		if (notesMd.length > HANDBOOK_NOTES_MAX_LENGTH) {
			return fail(400, { fieldError: `Notes exceed ${HANDBOOK_NOTES_MAX_LENGTH} characters.` });
		}
		await setNotes(user.id, chapter.id, notesMd);
		return { ok: true };
	},
};
