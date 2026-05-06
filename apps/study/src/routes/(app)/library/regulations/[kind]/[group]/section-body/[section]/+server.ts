/**
 * Section-body endpoint -- powers inline-expand on the Part page.
 *
 * Returns one section's rendered HTML body so the section list (in
 * `/library/regulations/14-cfr/91`) can expand a row without a navigation.
 * The dedicated section page at `/library/regulations/[kind]/[group]/[section]`
 * remains the canonical deep-link target for the full study surface
 * (read-progress, citing nodes, errata).
 *
 * Response shape: `{ html, code, title }`. HTML is the markdown rendered
 * via `renderMarkdown` so the inline expansion looks identical to the
 * dedicated page's body. Auth is required -- inline body is study-app
 * content, not a public API.
 */

import { requireAuth } from '@ab/auth';
import { parseRegulationGroup, parseRegulationKind, parseRegulationSection } from '@ab/aviation';
import { getReferenceSectionById, resolveRegulationsSectionId } from '@ab/bc-study/server';
import { renderMarkdown } from '@ab/utils';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requireAuth(event);
	const kind = parseRegulationKind(event.params.kind);
	if (!kind) throw error(404, `Unknown regulations kind: ${event.params.kind}`);
	const group = parseRegulationGroup(kind, event.params.group);
	if (!group) throw error(404, `Invalid group slug: ${event.params.group}`);
	const parsedSection = parseRegulationSection(event.params.section);
	if (!parsedSection) throw error(404, `Invalid section slug: ${event.params.section}`);

	const sectionId = await resolveRegulationsSectionId({ kind, group, section: parsedSection });
	const section = await getReferenceSectionById(sectionId);
	if (!section) throw error(404, 'Section not found');

	return json({
		code: section.code,
		title: section.title,
		html: renderMarkdown(section.contentMd),
	});
};
