/**
 * `/library/regulations/[kind]/[group]/[section]` -- regulations leaf reader.
 *
 * Resolves the matching `study.reference` row for `kind/group`, then loads
 * the section row by code. Reuses the shared handbook-section resolver --
 * regulations live in the same `handbook_section` table once their content
 * is ingested.
 */

import { requireAuth } from '@ab/auth';
import {
	formatErrataForDisplay,
	getHandbookSection,
	getNodesCitingSection,
	getReadState,
	getReferenceById,
	HandbookValidationError,
	handbookReadStatusSchema,
	listErrataForSection,
	listReferences,
	markAsReread,
	setComprehended,
	setNotes,
	setReadStatus,
} from '@ab/bc-study';
import {
	HANDBOOK_NOTES_MAX_LENGTH,
	HANDBOOK_READ_STATUSES,
	LIBRARY_REGULATIONS_KIND_VALUES,
	LIBRARY_REGULATIONS_KINDS,
	type LibraryRegulationsKind,
	REFERENCE_KINDS,
} from '@ab/constants';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function isLibraryRegulationsKind(value: string): value is LibraryRegulationsKind {
	return (LIBRARY_REGULATIONS_KIND_VALUES as readonly string[]).includes(value);
}

async function resolveReferenceForGroup(
	kind: LibraryRegulationsKind,
	group: string,
): Promise<{ id: string; documentSlug: string; edition: string; title: string }> {
	const refs = await listReferences();
	let match: (typeof refs)[number] | undefined;
	switch (kind) {
		case LIBRARY_REGULATIONS_KINDS.CFR_14:
			match = refs.find((r) => r.documentSlug === `14cfr${group}`);
			break;
		case LIBRARY_REGULATIONS_KINDS.CFR_49:
			match = refs.find((r) => r.documentSlug === `49cfr${group}`);
			break;
		case LIBRARY_REGULATIONS_KINDS.AIM:
			match = refs.find((r) => r.kind === REFERENCE_KINDS.AIM && r.documentSlug === group);
			break;
		case LIBRARY_REGULATIONS_KINDS.AC:
			match = refs.find((r) => r.kind === REFERENCE_KINDS.AC && r.documentSlug.startsWith(`ac-${group}-`));
			break;
		case LIBRARY_REGULATIONS_KINDS.NTSB:
			match = refs.find((r) => r.kind === REFERENCE_KINDS.NTSB && r.documentSlug === group);
			break;
	}
	if (!match) throw error(404, `No reference for ${kind} / ${group}`);
	return { id: match.id, documentSlug: match.documentSlug, edition: match.edition, title: match.title };
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const kindParam = event.params.kind;
	if (!isLibraryRegulationsKind(kindParam)) {
		throw error(404, `Unknown regulations kind: ${kindParam}`);
	}
	const kind = kindParam;
	const group = event.params.group;
	const sectionCode = event.params.section;

	const ref = await resolveReferenceForGroup(kind, group);

	// Section codes in regulations follow the same `<chapter>.<section>` shape
	// the handbook resolver expects -- e.g. `91.103` lives at chapter `91`,
	// section `103`. We pass through whatever shape the URL carries.
	const dotIndex = sectionCode.indexOf('.');
	const chapterCode = dotIndex >= 0 ? sectionCode.slice(0, dotIndex) : sectionCode;
	const subCode = dotIndex >= 0 ? sectionCode.slice(dotIndex + 1) : '';

	const view = await getHandbookSection(ref.id, chapterCode, subCode).catch(() => null);
	if (!view) throw error(404, `Section not found: ${kind} / ${group} / ${sectionCode}`);

	const readState = await getReadState(user.id, view.section.id);
	const citingNodes = await getNodesCitingSection({
		referenceId: ref.id,
		chapter: Number(chapterCode),
		section: subCode === '' ? undefined : Number(subCode),
	});

	const errataRows = await listErrataForSection(view.section.id);
	const errata = errataRows.map(formatErrataForDisplay);

	const latestRow = await getReferenceById(ref.id).catch(() => null);
	const supersededByEdition = latestRow?.supersededById
		? ((await getReferenceById(latestRow.supersededById).catch(() => null))?.edition ?? null)
		: null;

	return {
		kind,
		group,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			supersededByEdition,
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
		errata,
	};
};

export const actions: Actions = {
	'set-status': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params);
		const formData = await event.request.formData();
		const parsed = handbookReadStatusSchema.safeParse(String(formData.get('status') ?? ''));
		if (!parsed.success) return fail(400, { fieldError: 'Invalid status' });
		await setReadStatus(user.id, sectionId, parsed.data);
		return { ok: true };
	},
	'set-comprehended': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params);
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
		const sectionId = await resolveSectionId(event.params);
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
		const sectionId = await resolveSectionId(event.params);
		const formData = await event.request.formData();
		const notesMd = String(formData.get('notesMd') ?? '');
		if (notesMd.length > HANDBOOK_NOTES_MAX_LENGTH) {
			return fail(400, { fieldError: `Notes exceed ${HANDBOOK_NOTES_MAX_LENGTH} characters.` });
		}
		await setNotes(user.id, sectionId, notesMd);
		return { ok: true };
	},
};

async function resolveSectionId(params: { kind: string; group: string; section: string }): Promise<string> {
	if (!isLibraryRegulationsKind(params.kind)) throw error(404, `Unknown regulations kind: ${params.kind}`);
	const ref = await resolveReferenceForGroup(params.kind, params.group);
	const sectionCode = params.section;
	const dotIndex = sectionCode.indexOf('.');
	const chapterCode = dotIndex >= 0 ? sectionCode.slice(0, dotIndex) : sectionCode;
	const subCode = dotIndex >= 0 ? sectionCode.slice(dotIndex + 1) : '';
	const view = await getHandbookSection(ref.id, chapterCode, subCode).catch(() => null);
	if (!view) throw error(404, 'Section not found');
	return view.section.id;
}
