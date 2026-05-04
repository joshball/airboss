/**
 * `/handbook/[slug]/[edition]/[chapter]/[section]` -- handbook section reader.
 *
 * Resolves the `(reference, chapter, section)` tuple via the BC's
 * `getHandbookSection` view. Validates the URI parses end-to-end so a
 * malformed deep link is rejected before a DB query fires.
 */

import { parseHandbookChapter, parseHandbookSection, parseHandbookSlug } from '@ab/aviation';
import { getHandbookSection, getReferenceByDocument } from '@ab/bc-study';
import { type ReferenceKind, ROUTES } from '@ab/constants';
import { isParseError, parseHandbooksLocator, parseIdentifier } from '@ab/sources';
import { error } from '@sveltejs/kit';
import { buildSourceLinks } from '../../../../../../lib/source-links';
import { shortHandbookEdition } from '../../../../../reader-url';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const documentSlug = parseHandbookSlug(params.slug);
	if (!documentSlug) throw error(404, 'Handbook not found.');
	const chapterCode = parseHandbookChapter(params.chapter);
	if (!chapterCode) throw error(404, 'Section not found.');
	const sectionCode = parseHandbookSection(params.section);
	if (!sectionCode) throw error(404, 'Section not found.');

	const ref = await getReferenceByDocument(documentSlug).catch(() => null);
	if (!ref) throw error(404, `No handbook found for ${params.slug}`);

	const shortEdition = shortHandbookEdition(ref.edition);
	if (params.edition !== shortEdition && params.edition !== ref.edition) {
		throw error(404, `Edition ${params.edition} not found for ${ref.title}`);
	}

	// Validate the canonical URI shape (which uses the short edition) parses
	// end-to-end so a malformed deep link is rejected before the DB query.
	const rawUri = `airboss-ref:handbooks/${documentSlug}/${shortEdition}/${chapterCode}/${sectionCode}`;
	const parsed = parseIdentifier(rawUri);
	if (isParseError(parsed)) throw error(404, `Malformed handbook reference: ${parsed.message}`);
	const locator = parseHandbooksLocator(parsed.locator);
	if (locator.kind === 'error') throw error(404, `Malformed handbook locator: ${locator.message}`);

	const view = await getHandbookSection(ref.id, chapterCode, sectionCode).catch(() => null);
	if (!view) throw error(404, `Section ${chapterCode}.${sectionCode} not found in ${ref.title}`);

	const sourceLinks = buildSourceLinks({
		kind: ref.kind as ReferenceKind,
		documentSlug: ref.documentSlug,
		edition: ref.edition,
		url: ref.url,
	});

	return {
		uri: rawUri,
		sourceLinks,
		reference: {
			id: ref.id,
			documentSlug: ref.documentSlug,
			edition: ref.edition,
			shortEdition,
			title: ref.title,
			handbookHref: ROUTES.FLIGHTBAG_HANDBOOK(ref.documentSlug, shortEdition),
			chapterHref: ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(ref.documentSlug, shortEdition, chapterCode),
		},
		chapter: {
			id: view.chapter.id,
			code: view.chapter.code,
			title: view.chapter.title,
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
			href: ROUTES.FLIGHTBAG_HANDBOOK_SECTION(
				ref.documentSlug,
				shortEdition,
				chapterCode,
				s.code.split('.').slice(1).join('.'),
			),
		})),
	};
};
