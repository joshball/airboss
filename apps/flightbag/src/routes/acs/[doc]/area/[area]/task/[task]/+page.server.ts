/**
 * `/acs/[doc]/area/[area]/task/[task]` -- ACS task reader.
 *
 * Validates the URI parses end-to-end and renders the seeded task body
 * (References / Objective / Knowledge / Risk Management / Skills) plus
 * structured element rows (K/R/S triads) pulled from `reference_section`.
 *
 * Data shape: the task row sits at level=`task` under its area row
 * (level=`area`) under the publication row (level=`publication`). The task
 * `content_md` is the verbatim body block from the FAA PDF; element rows
 * (level=`element`) are the K/R/S bullets parented to the task. Codes:
 * area is Roman (`I`), task is `<roman>.<letter>` (`I.A`), element is the
 * full FAA identifier (`PA.I.A.K1`).
 *
 * URL params are 2-digit zero-padded area (`01`) and lowercase task letter
 * (`a`); `parseAcsLocator` validates both. The seeder writes
 * `area_padded` on area rows and `task_letter` on task rows so we can
 * resolve a (doc, padded-area, letter) tuple to a task id without
 * re-translating Roman numerals here.
 */

import { getReferenceByDocument, listAllSectionsForReference } from '@ab/bc-study/server';
import { externalUrlForReference, REFERENCE_SECTION_LEVELS, type ReferenceKind, ROUTES } from '@ab/constants';
import { isParseError, parseAcsLocator, parseIdentifier } from '@ab/sources';
import { error } from '@sveltejs/kit';
import { loadSectionAnnotationContext } from '../../../../../../../lib/server/section-annotations';
import { buildSourceLinks } from '../../../../../../../lib/source-links';
import type { PageServerLoad } from './$types';

const TRIAD_KNOWLEDGE = 'k';
const TRIAD_RISK = 'r';
const TRIAD_SKILL = 's';
type Triad = typeof TRIAD_KNOWLEDGE | typeof TRIAD_RISK | typeof TRIAD_SKILL;

interface ElementView {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly triad: Triad;
}

interface TaskNeighbor {
	readonly href: string;
	readonly label: string;
	readonly code: string;
}

interface AreaTaskView {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly letter: string;
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

/**
 * Extract a single labelled line ("References:", "Objective:") from the
 * task body. Lines may wrap onto subsequent lines until the next labelled
 * line or an element bullet row (lines starting with the FAA element code
 * `PA.<area>.<task>.<triad><N>`). Returns the joined prose with whitespace
 * collapsed, or null when the label isn't present.
 */
function extractLabelledBlock(body: string, label: string): string | null {
	const lines = body.split(/\r?\n/);
	const labelRegex = new RegExp(`^${label}\\s*:\\s*(.*)$`, 'i');
	const stopRegex = /^(References?|Objective|Note|Knowledge|Risk Management|Risk|Management|Skills?)\s*:/i;
	const elementRegex = /^[A-Z]{2,}\.[IVX]+\.[A-Z]\.[KRSkrs]\d/;
	let collected: string[] | null = null;
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (collected === null) {
			const match = labelRegex.exec(line);
			if (match) {
				const initial = (match[1] ?? '').trim();
				collected = initial.length > 0 ? [initial] : [];
			}
			continue;
		}
		if (line.length === 0) continue;
		if (stopRegex.test(line) || elementRegex.test(line)) break;
		collected.push(line);
	}
	if (collected === null) return null;
	const joined = collected.join(' ').replace(/\s+/g, ' ').trim();
	return joined.length > 0 ? joined : null;
}

function elementTriad(code: string): Triad | null {
	// Element codes look like `PA.I.A.K1` -- the final segment's first
	// character is the triad letter (k/r/s). Defensive: anything else
	// returns null and the row falls through to the "other" bucket.
	const tail = code.split('.').at(-1) ?? '';
	const ch = tail[0]?.toLowerCase() ?? '';
	if (ch === TRIAD_KNOWLEDGE || ch === TRIAD_RISK || ch === TRIAD_SKILL) {
		return ch;
	}
	return null;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const rawUri = `airboss-ref:acs/${params.doc}/area-${params.area}/task-${params.task}`;
	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) throw error(404, `Malformed ACS reference: ${parsed.message}`);
	const locator = parseAcsLocator(parsed.locator);
	if (locator.kind === 'error') throw error(404, `Malformed ACS locator: ${locator.message}`);
	const acs = locator.acs;
	if (acs === undefined || acs.area === undefined || acs.task === undefined) {
		throw error(404, 'ACS task locator missing area or task.');
	}

	const ref = await getReferenceByDocument(params.doc).catch(() => null);
	if (!ref) throw error(404, `ACS ${params.doc} not found.`);
	// Capture the slug into a non-nullable local so the `neighborFor`
	// closure below doesn't lose the `if (!ref)` narrowing. TypeScript
	// re-widens narrowed locals across closure boundaries when the outer
	// binding can be reassigned in a sibling scope; mirroring it here keeps
	// the narrowed type visible without scattering non-null assertions.
	const refSlug = ref.documentSlug;

	const sections = await listAllSectionsForReference(ref.id);

	// Resolve the area row by `area_padded` metadata, then the task row by
	// `task_letter` metadata under that area. Both fields are seeded on
	// every row by `libs/bc/study/src/seeders/acs.ts`; if either lookup
	// fails we surface a clean 404 rather than crashing the page.
	const areaRow = sections.find(
		(s) => s.level === REFERENCE_SECTION_LEVELS.AREA && readStringMetadata(s.metadata, 'area_padded') === acs.area,
	);
	if (!areaRow) throw error(404, `Area ${acs.area} not found in ${params.doc}.`);

	const taskRows = sections
		.filter((s) => s.level === REFERENCE_SECTION_LEVELS.TASK && s.parentId === areaRow.id)
		.sort((a, b) => a.ordinal - b.ordinal);
	const taskRow = taskRows.find((s) => readStringMetadata(s.metadata, 'task_letter') === acs.task);
	if (!taskRow) throw error(404, `Task ${acs.task} not found in area ${acs.area}.`);

	const elementRows = sections
		.filter((s) => s.level === REFERENCE_SECTION_LEVELS.ELEMENT && s.parentId === taskRow.id)
		.sort((a, b) => a.ordinal - b.ordinal);

	const knowledge: ElementView[] = [];
	const risk: ElementView[] = [];
	const skill: ElementView[] = [];
	for (const row of elementRows) {
		const triad = elementTriad(row.code);
		if (triad === null) continue;
		const view: ElementView = { id: row.id, code: row.code, title: row.title, triad };
		if (triad === TRIAD_KNOWLEDGE) knowledge.push(view);
		else if (triad === TRIAD_RISK) risk.push(view);
		else skill.push(view);
	}

	const references = extractLabelledBlock(taskRow.contentMd, 'References');
	const objective = extractLabelledBlock(taskRow.contentMd, 'Objective');

	// Prev / next within the publication's reading order. Walk every task
	// in `(area.ordinal, task.ordinal)` order; find this task's index and
	// expose neighbors on either side. Building this here (vs. delegating
	// to `computeReadingOrder`) is intentional: the ACS reading unit IS
	// the task, not the element, so the navigation strip should hop tasks
	// not elements.
	const allTaskRowsOrdered = sections
		.filter((s) => s.level === REFERENCE_SECTION_LEVELS.TASK)
		.sort((a, b) => {
			// Tasks are ordered first by their parent area's ordinal, then
			// by their own ordinal. Build a per-area ordinal map so tasks
			// from earlier areas come first regardless of insertion order.
			const aArea = sections.find((s) => s.id === a.parentId);
			const bArea = sections.find((s) => s.id === b.parentId);
			const aAreaOrd = aArea?.ordinal ?? 0;
			const bAreaOrd = bArea?.ordinal ?? 0;
			if (aAreaOrd !== bAreaOrd) return aAreaOrd - bAreaOrd;
			return a.ordinal - b.ordinal;
		});
	const currentIdx = allTaskRowsOrdered.findIndex((t) => t.id === taskRow.id);

	function neighborFor(idx: number): TaskNeighbor | null {
		const candidate = allTaskRowsOrdered[idx];
		if (!candidate) return null;
		const candidateArea = sections.find((s) => s.id === candidate.parentId);
		if (!candidateArea) return null;
		const padded = readStringMetadata(candidateArea.metadata, 'area_padded');
		const letter = readStringMetadata(candidate.metadata, 'task_letter');
		if (padded === null || letter === null) return null;
		return {
			href: ROUTES.FLIGHTBAG_ACS_TASK(refSlug, padded, letter),
			label: candidate.title,
			code: candidate.code,
		};
	}
	const prev = currentIdx > 0 ? neighborFor(currentIdx - 1) : null;
	const next = currentIdx >= 0 ? neighborFor(currentIdx + 1) : null;

	// Whole-publication TOC payload. Drives the persistent right-rail
	// `<TOCDrawer>` so the user can hop to any task without round-tripping
	// the publication landing. Structurally identical to the publication
	// page-loader's `areas[]` shape so `buildAcsTocEntries` works on either
	// page without a second adapter.
	const areaRowsOrdered = sections
		.filter((s) => s.level === REFERENCE_SECTION_LEVELS.AREA)
		.sort((a, b) => a.ordinal - b.ordinal);
	const tasksByAreaId = new Map<string, typeof allTaskRowsOrdered>();
	for (const t of allTaskRowsOrdered) {
		if (t.parentId === null) continue;
		const list = tasksByAreaId.get(t.parentId) ?? [];
		list.push(t);
		tasksByAreaId.set(t.parentId, list);
	}
	const areas: AreaView[] = areaRowsOrdered.map((area) => {
		const padded = readStringMetadata(area.metadata, 'area_padded') ?? String(area.ordinal + 1).padStart(2, '0');
		const tasks: AreaTaskView[] = (tasksByAreaId.get(area.id) ?? []).map((t) => ({
			id: t.id,
			code: t.code,
			title: t.title,
			letter: readStringMetadata(t.metadata, 'task_letter') ?? t.code.split('.').at(-1)?.toLowerCase() ?? '',
		}));
		return { id: area.id, code: area.code, title: area.title, padded, tasks };
	});

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	const annotationContext = await loadSectionAnnotationContext(locals.user?.id ?? null, taskRow.id);

	return {
		uri: rawUri,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			title: ref.title,
			acsHref: ROUTES.FLIGHTBAG_ACS(ref.documentSlug),
			externalUrl: externalUrlForReference(ref.kind as ReferenceKind, ref.documentSlug, ref.edition, ref.url),
		},
		area: {
			code: areaRow.code,
			title: areaRow.title,
			padded: acs.area,
		},
		task: {
			id: taskRow.id,
			code: taskRow.code,
			title: taskRow.title,
			letter: acs.task,
			references,
			objective,
		},
		elements: {
			knowledge,
			risk,
			skill,
		},
		nav: {
			prev,
			next,
		},
		areas,
		annotationContext,
		isAuthenticated: locals.user !== null,
	};
};
