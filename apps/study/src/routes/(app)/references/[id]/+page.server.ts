/**
 * Reference detail (`/references/<id>`) -- minimal surface for hangar.reference
 * rows targeted by `content-citations` regulation_node + ac_reference targets.
 *
 * Glossary already has a detail page (`/glossary/<id>`), but it loads from the
 * in-memory `@ab/aviation` registry, not from `hangar.reference`. The two
 * registries have different ID spaces, so the citation picker (which writes
 * hangar.reference ids) needs a target route that reads from the same DB rows.
 *
 * The page is intentionally thin: name, source label, paraphrase, and the
 * "Cited by" panel. A richer reference editor lives in `apps/hangar`. This
 * route only exists to close the citation-surface loop in study.
 */

import { requireAuth } from '@ab/auth';
import { type CitationWithSource, getCitedBy, resolveCitationSources } from '@ab/bc-citations';
import { CITATION_TARGET_TYPES, REFERENCE_SOURCE_TYPES, SOURCE_TYPE_LABELS } from '@ab/constants';
import { db, hangarReference } from '@ab/db';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAuth(event);

	const [row] = await db
		.select({
			id: hangarReference.id,
			displayName: hangarReference.displayName,
			paraphrase: hangarReference.paraphrase,
			tags: hangarReference.tags,
		})
		.from(hangarReference)
		.where(eq(hangarReference.id, event.params.id))
		.limit(1);

	if (!row) error(404, { message: 'Reference not found' });

	// Both regulation_node and ac_reference target hangar.reference; bucket
	// per-type so the page header can show the right "source kind" label and
	// the Cited By panel pulls citations of either kind targeting this row.
	const tagsRecord = (row.tags ?? {}) as Record<string, unknown>;
	const sourceTypeRaw = typeof tagsRecord.sourceType === 'string' ? tagsRecord.sourceType : null;
	const isAc = sourceTypeRaw === REFERENCE_SOURCE_TYPES.AC;
	const targetType = isAc ? CITATION_TARGET_TYPES.AC_REFERENCE : CITATION_TARGET_TYPES.REGULATION_NODE;

	const citedByRows = await getCitedBy(targetType, row.id);
	const citedBy: CitationWithSource[] = await resolveCitationSources(citedByRows);

	const sourceLabel =
		sourceTypeRaw && sourceTypeRaw in SOURCE_TYPE_LABELS
			? SOURCE_TYPE_LABELS[sourceTypeRaw as keyof typeof SOURCE_TYPE_LABELS]
			: 'Reference';

	return {
		reference: {
			id: row.id,
			displayName: row.displayName,
			paraphrase: row.paraphrase,
			sourceLabel,
		},
		citedBy,
	};
};
