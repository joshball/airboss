import { requireAuth } from '@ab/auth';
import {
	getNodesCitingSectionsBatch,
	getReferenceByDocument,
	type KnowledgeNodeRow,
	listChapterSections,
	listHandbookChapters,
	ReferenceNotFoundError,
	type ReferenceRow,
	type ReferenceSectionRow,
} from '@ab/bc-study';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export interface SectionWithNodes {
	section: ReferenceSectionRow;
	citingNodes: KnowledgeNodeRow[];
}

export interface ChapterLensData {
	reference: ReferenceRow;
	chapter: ReferenceSectionRow;
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

	// Batched citation reverse-lookup: pull every cited-by node for this
	// chapter in one indexed JSONB-containment query instead of one per
	// section. See `getNodesCitingSectionsBatch` in
	// `@ab/bc-study/references.ts`. Closes the chunk-1 perf MAJOR /
	// backend MAJOR N+1 (review-tail-2026-05).
	const parsedByCode = new Map<string, { chapter: number; section: number | null }>();
	const sectionNumbers: number[] = [];
	for (const section of sections) {
		const parsed = parseSectionCode(section.code);
		parsedByCode.set(section.code, parsed);
		if (parsed.section !== null) sectionNumbers.push(parsed.section);
	}
	// Use the chapter's own parsed `chapter` integer as the probe -- every
	// section under a chapter shares it. Chapter rows themselves can have
	// `parsed.section === null` and resolve to an empty list.
	const chapterParsed = parseSectionCode(chapter.code);
	const nodesBySection =
		sectionNumbers.length === 0
			? new Map<number, KnowledgeNodeRow[]>()
			: await getNodesCitingSectionsBatch({
					referenceId: reference.id,
					chapter: chapterParsed.chapter,
					sections: sectionNumbers,
				});

	const sectionsWithNodes: SectionWithNodes[] = sections.map((section) => {
		const parsed = parsedByCode.get(section.code) ?? { chapter: 0, section: null };
		const citingNodes = parsed.section === null ? [] : (nodesBySection.get(parsed.section) ?? []);
		return { section, citingNodes };
	});
	return { reference, chapter, sections: sectionsWithNodes } satisfies ChapterLensData;
};
