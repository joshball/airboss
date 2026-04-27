/**
 * `/handbooks/[doc]/[chapter]/[section]` -- per-section read view.
 *
 * Lights up for handbooks whose ingestion produced section-granularity rows.
 * v1 PHAK ingestion only produces chapter rows so PHAK URLs at this depth
 * 404 -- the chapter page renders the body in that case. AvWX / AFH / future
 * re-ingestions can populate these rows when section-level extraction lands.
 */

import { requireAuth } from '@ab/auth';
import {
	getHandbookSection,
	getNodesCitingSection,
	getReadState,
	getReferenceByDocument,
	getReferenceById,
	HandbookValidationError,
	handbookReadStatusSchema,
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
	const sectionCode = event.params.section;
	const editionParam = event.url.searchParams.get(QUERY_PARAMS.EDITION) ?? undefined;

	const ref = await getReferenceByDocument(documentSlug, { edition: editionParam }).catch(() => null);
	if (!ref) throw error(404, `Handbook not found: ${documentSlug}`);

	const view = await getHandbookSection(ref.id, chapterCode, sectionCode).catch(() => null);
	if (!view) throw error(404, `Section not found: ${documentSlug} / ${chapterCode}.${sectionCode}`);

	const readState = await getReadState(user.id, view.section.id);
	const citingNodes = await getNodesCitingSection({
		referenceId: ref.id,
		chapter: Number(chapterCode),
		section: Number(sectionCode),
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
		section: {
			id: view.section.id,
			code: view.section.code,
			title: view.section.title,
			contentMd: view.section.contentMd,
			sourceLocator: view.section.sourceLocator,
			faaPageStart: view.section.faaPageStart,
			faaPageEnd: view.section.faaPageEnd,
		},
		chapter: {
			id: view.chapter.id,
			code: view.chapter.code,
			title: view.chapter.title,
		},
		figures: view.figures.map((f) => ({
			id: f.id,
			ordinal: f.ordinal,
			caption: f.caption,
			assetPath: f.assetPath,
			width: f.width,
			height: f.height,
		})),
		siblings: view.siblings.map((s) => ({
			id: s.id,
			code: s.code,
			title: s.title,
			ordinal: s.ordinal,
		})),
		readState: readState
			? {
					status: readState.status,
					comprehended: readState.comprehended,
					notesMd: readState.notesMd,
					totalSecondsVisible: readState.totalSecondsVisible,
				}
			: {
					status: HANDBOOK_READ_STATUSES.UNREAD,
					comprehended: false,
					notesMd: '',
					totalSecondsVisible: 0,
				},
		citingNodes: citingNodes.map((n) => ({
			id: n.id,
			title: n.title,
			domain: n.domain,
		})),
	};
};

export const actions: Actions = {
	'set-status': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params.doc, event.params.chapter, event.params.section);
		const formData = await event.request.formData();
		const parsed = handbookReadStatusSchema.safeParse(String(formData.get('status') ?? ''));
		if (!parsed.success) return fail(400, { fieldError: 'Invalid status' });
		await setReadStatus(user.id, sectionId, parsed.data);
		return { ok: true };
	},
	'set-comprehended': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params.doc, event.params.chapter, event.params.section);
		const formData = await event.request.formData();
		const comprehended = String(formData.get('comprehended') ?? '') === 'true';
		try {
			await setComprehended(user.id, sectionId, comprehended);
		} catch (err) {
			if (err instanceof HandbookValidationError) return fail(409, { fieldError: err.message });
			throw err;
		}
		return { ok: true };
	},
	'mark-reread': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params.doc, event.params.chapter, event.params.section);
		try {
			await markAsReread(user.id, sectionId);
		} catch (err) {
			if (err instanceof HandbookValidationError) return fail(409, { fieldError: err.message });
			throw err;
		}
		return { ok: true };
	},
	'set-notes': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params.doc, event.params.chapter, event.params.section);
		const formData = await event.request.formData();
		const notesMd = String(formData.get('notesMd') ?? '');
		if (notesMd.length > HANDBOOK_NOTES_MAX_LENGTH) {
			return fail(400, { fieldError: `Notes exceed ${HANDBOOK_NOTES_MAX_LENGTH} characters.` });
		}
		await setNotes(user.id, sectionId, notesMd);
		return { ok: true };
	},
};

async function resolveSectionId(documentSlug: string, chapterCode: string, sectionCode: string): Promise<string> {
	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, 'Handbook not found');
	const view = await getHandbookSection(ref.id, chapterCode, sectionCode).catch(() => null);
	if (!view) throw error(404, 'Section not found');
	return view.section.id;
}
