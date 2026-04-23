import { CONCEPT_GROUPS, type ConceptGroup } from '@ab/constants';
import { type HelpPage, helpRegistry } from '@ab/help';
import '$lib/help/register';
import type { PageLoad } from './$types';

/**
 * Concept-page groups rendered on /help/concepts. Ordered to match the
 * reading flow: learning-science first (the why behind the scheduler
 * and sessions), then airboss architecture (the how), then aviation
 * doctrine (the what-this-maps-to in the airplane).
 */
const GROUP_ORDER: readonly ConceptGroup[] = [
	CONCEPT_GROUPS.LEARNING_SCIENCE,
	CONCEPT_GROUPS.AIRBOSS_ARCHITECTURE,
	CONCEPT_GROUPS.AVIATION_DOCTRINE,
];

export interface ConceptGroupPayload {
	group: ConceptGroup;
	pages: readonly HelpPage[];
}

export const load: PageLoad = () => {
	const conceptPages = helpRegistry.getAllPages().filter((page) => page.concept === true);

	const byGroup = new Map<ConceptGroup, HelpPage[]>();
	for (const page of conceptPages) {
		// Pages that forgot their group fall into airboss-architecture per spec.
		const group: ConceptGroup = page.tags.conceptGroup ?? CONCEPT_GROUPS.AIRBOSS_ARCHITECTURE;
		const bucket = byGroup.get(group);
		if (bucket) bucket.push(page);
		else byGroup.set(group, [page]);
	}

	// Sort within each group by title for a stable, deterministic index.
	for (const [, pages] of byGroup) {
		pages.sort((a, b) => a.title.localeCompare(b.title));
	}

	const groups: readonly ConceptGroupPayload[] = GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({
		group,
		pages: byGroup.get(group) ?? [],
	}));

	return { groups, totalCount: conceptPages.length };
};
