import { requireAuth } from '@ab/auth';
import {
	getNodesCitingSection,
	getReferenceByDocument,
	type HandbookSectionRow,
	type KnowledgeNodeRow,
	listChapterSections,
	listHandbookChapters,
	ReferenceNotFoundError,
	type ReferenceRow,
} from '@ab/bc-study';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export interface SectionWithNodes {
	section: HandbookSectionRow;
	citingNodes: KnowledgeNodeRow[];
}

export interface ChapterLensData {
	reference: ReferenceRow;
	chapter: HandbookSectionRow;
	sections: SectionWithNodes[];
}

/**
 * Parse a section code like "12.3" into chapter+section integers.
 * Handbook section codes follow the dotted-decimal convention enforced by
 * the schema CHECK constraint. The handbook lens needs the parts as numbers
 * for the citation reverse-lookup (`getNodesCitingSection` matches on
 * numeric `locator.chapter` / `locator.section`).
 */
function parseSectionCode(code: string): { chapter: number; section: number | null } {
	const parts = code.split('.');
	const chapterRaw = parts[0];
	const sectionRaw = parts[1];
	const chapter = Number.parseInt(chapterRaw ?? '', 10);
	if (!Number.isFinite(chapter)) return { chapter: 0, section: null };
	if (sectionRaw === undefined) return { chapter, section: null };
	const section = Number.parseInt(sectionRaw, 10);
	return { chapter, section: Number.isFinite(section) ? section : null };
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);
	const { doc, chapter: chapterCode } = event.params;
	let reference: ReferenceRow;
	try {
		reference = await getReferenceByDocument(doc);
	} catch (err) {
		if (err instanceof ReferenceNotFoundError) {
			throw error(404, `Handbook '${doc}' not found.`);
		}
		throw err;
	}
	const chapters = await listHandbookChapters(reference.id);
	const chapter = chapters.find((c) => c.code === chapterCode);
	if (!chapter) {
		throw error(404, `Chapter '${chapterCode}' not found in ${reference.title}.`);
	}
	const sections = await listChapterSections(chapter.id);
	const sectionsWithNodes: SectionWithNodes[] = await Promise.all(
		sections.map(async (section) => {
			const parsed = parseSectionCode(section.code);
			const citingNodes =
				parsed.section === null
					? []
					: await getNodesCitingSection({
							referenceId: reference.id,
							chapter: parsed.chapter,
							section: parsed.section,
						});
			return { section, citingNodes };
		}),
	);
	return { reference, chapter, sections: sectionsWithNodes } satisfies ChapterLensData;
};
