/**
 * `/acs/[doc]` -- ACS publication landing.
 *
 * Surfaces the publication's hierarchy: areas of operation -> tasks. Tasks
 * link to the per-task reader. Element rows are NOT rendered here (they're
 * task-internal content the per-task page renders); the publication page is
 * the table of contents + chrome.
 *
 * Data shape: areas live at level=`area` directly under the publication
 * row (level=`publication`); tasks live at level=`task` under their area.
 * URL params at the per-task layer use 2-digit zero-padded area ordinals
 * (`area-05`) and lowercase task letters (`task-a`); the DB code is the
 * Roman-numeral form (`I.A`). Area metadata carries `area_padded` /
 * `area_roman`; task metadata carries `task_letter` -- read those to
 * build navigation URLs without re-deriving the translation here.
 */

import { getReferenceByDocument, listAllSectionsForReference } from '@ab/bc-study/server';
import {
	externalUrlForReference,
	REFERENCE_KINDS,
	REFERENCE_SECTION_LEVELS,
	type ReferenceKind,
	ROUTES,
} from '@ab/constants';
import { error } from '@sveltejs/kit';
import { buildSourceLinks } from '../../../lib/source-links';
import type { PageServerLoad } from './$types';

const SLUG_SHAPE = /^[a-z0-9-]+$/i;

interface AreaTaskView {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly letter: string;
	readonly href: string;
}

interface AreaView {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly padded: string;
	readonly tasks: ReadonlyArray<AreaTaskView>;
}

function readStringMetadata(metadata: unknown, key: string): string | null {
	if (typeof metadata !== 'object' || metadata === null) return null;
	const value = (metadata as Record<string, unknown>)[key];
	return typeof value === 'string' && value.length > 0 ? value : null;
}

export const load: PageServerLoad = async ({ params }) => {
	if (!SLUG_SHAPE.test(params.doc)) throw error(404, 'Invalid ACS slug.');

	const ref = await getReferenceByDocument(params.doc).catch(() => null);
	if (!ref) throw error(404, `ACS ${params.doc} not found.`);
	if (ref.kind !== REFERENCE_KINDS.ACS && ref.kind !== REFERENCE_KINDS.PTS) {
		throw error(404, `${params.doc} is not an ACS publication.`);
	}

	const sections = await listAllSectionsForReference(ref.id);

	// Locate the publication container row -- one per ACS, at depth 0. Its
	// `content_md` is empty per the seeder; carries the manifest_slug /
	// page_count metadata used for chrome.
	const publicationRow = sections.find((s) => s.level === REFERENCE_SECTION_LEVELS.PUBLICATION) ?? null;

	const areaRows = sections
		.filter((s) => s.level === REFERENCE_SECTION_LEVELS.AREA)
		.sort((a, b) => a.ordinal - b.ordinal);

	const taskRows = sections.filter((s) => s.level === REFERENCE_SECTION_LEVELS.TASK);
	const tasksByAreaId = new Map<string, typeof taskRows>();
	for (const task of taskRows) {
		if (task.parentId === null) continue;
		const list = tasksByAreaId.get(task.parentId) ?? [];
		list.push(task);
		tasksByAreaId.set(task.parentId, list);
	}
	for (const list of tasksByAreaId.values()) {
		list.sort((a, b) => a.ordinal - b.ordinal);
	}

	const areas: AreaView[] = areaRows.map((area) => {
		// `area_padded` is the 2-digit zero-padded ordinal string the URL
		// params and on-disk manifest use (`'01'`, `'12'`). Fall back to
		// padding `area.ordinal + 1` if the metadata field is missing on a
		// historical row -- the seeder writes it today, but the renderer
		// shouldn't crash if a stale row predates the field.
		const padded = readStringMetadata(area.metadata, 'area_padded') ?? String(area.ordinal + 1).padStart(2, '0');
		const tasks: AreaTaskView[] = (tasksByAreaId.get(area.id) ?? []).map((task) => {
			const letter =
				readStringMetadata(task.metadata, 'task_letter') ?? task.code.split('.').at(-1)?.toLowerCase() ?? '';
			return {
				id: task.id,
				code: task.code,
				title: task.title,
				letter,
				href: ROUTES.FLIGHTBAG_ACS_TASK(ref.documentSlug, padded, letter),
			};
		});
		return {
			id: area.id,
			code: area.code,
			title: area.title,
			padded,
			tasks,
		};
	});

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		uri: `airboss-ref:acs/${ref.documentSlug}`,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			publisher: ref.publisher,
			subjects: [...ref.subjects],
			externalUrl: externalUrlForReference(ref.kind as ReferenceKind, ref.documentSlug, ref.edition, ref.url),
		},
		publication: {
			contentMd: publicationRow?.contentMd ?? '',
		},
		areas,
	};
};
