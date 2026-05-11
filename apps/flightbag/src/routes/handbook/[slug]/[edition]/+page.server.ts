/**
 * `/handbook/[slug]/[edition]` -- handbook landing.
 *
 * Reshape under WP-FLIGHTBAG-READER-UX Phase 4: the body becomes the
 * `<TOCRender mode="overview">` grid, with the rail-bearing chrome
 * supplied by the parent `+layout.svelte`. The loader queries the
 * MAX(last_read_at) for the user × this reference so the "Resume reading"
 * pin can link to the user's most-recently-read section.
 */

import { listReadStatesForReference } from '@ab/bc-study/server';
import { ROUTES } from '@ab/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Inherit the handbook + reading-order shape from the parent layout
	// loader so this page doesn't re-fetch them.
	const parentData = await event.parent();
	const { handbook, readingOrder } = parentData;

	// Resume target: the user's most-recently-read section in this
	// handbook. Anonymous visitors get null and the "Resume" pin is
	// suppressed by the page template.
	const userId = event.locals.user?.id ?? null;
	let resume: { sectionId: string; code: string; title: string; href: string; lastReadAt: string } | null = null;
	if (userId) {
		const states = await listReadStatesForReference(userId, handbook.id);
		let mostRecent: { sectionId: string; lastReadAt: Date } | null = null;
		for (const state of states) {
			if (!state.lastReadAt) continue;
			if (!mostRecent || state.lastReadAt > mostRecent.lastReadAt) {
				mostRecent = { sectionId: state.referenceSectionId, lastReadAt: state.lastReadAt };
			}
		}
		if (mostRecent) {
			const entry = readingOrder.find((e) => e.sectionId === mostRecent.sectionId);
			if (entry) {
				const href = (() => {
					if (entry.parentId === null) {
						return ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(handbook.documentSlug, handbook.shortEdition, entry.code);
					}
					const parts = entry.code.split('.');
					if (parts.length !== 2) return null;
					const [ch, sec] = parts;
					if (!ch || !sec) return null;
					return ROUTES.FLIGHTBAG_HANDBOOK_SECTION(handbook.documentSlug, handbook.shortEdition, ch, sec);
				})();
				if (href) {
					resume = {
						sectionId: entry.sectionId,
						code: entry.code,
						title: entry.title,
						href,
						lastReadAt: mostRecent.lastReadAt.toISOString(),
					};
				}
			}
		}
	}

	return {
		uri: `airboss-ref:handbooks/${handbook.documentSlug}/${handbook.shortEdition}`,
		resume,
	};
};
