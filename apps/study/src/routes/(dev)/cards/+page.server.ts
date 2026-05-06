/**
 * `/cards` -- card-completeness audit page (dev-only).
 *
 * Three sections render below:
 *
 *   1. **Variants gallery** -- every wrapper rendered with a complete
 *      fixture and a "minimum-required" fixture so the design stays
 *      consistent and so a refactor that breaks an optional-field path
 *      shows up here first.
 *   2. **Live audit table** -- pulls every `study.reference` row, runs it
 *      through the appropriate validator, and lists missing required +
 *      recommended fields. Functions as the Wave 1 authoring punch list.
 *   3. **Wrapper inventory** -- summary of what variant exists and which
 *      reference kinds map to it.
 *
 * The (dev) group is guarded by `+layout.server.ts` so this never reaches
 * production. Even so, each load is an authenticated request -- audit
 * surface stays behind the same gate as the regulations browse routes.
 */

import {
	type CardVariant,
	RECOMMENDED_FIELDS_BY_VARIANT,
	REQUIRED_FIELDS_BY_VARIANT,
	validateCardData,
} from '@ab/aviation/ui/cards/validation';
import { listReferences } from '@ab/bc-study/server';
import { LIBRARY_REGULATIONS_KIND_COPY, LIBRARY_REGULATIONS_KINDS, REFERENCE_KINDS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { buildEcfrUrl, buildPartUrl } from '@ab/sources';
import type { PageServerLoad } from './$types';

interface AuditRow {
	readonly subject: string;
	readonly variant: CardVariant;
	readonly missingRequired: readonly string[];
	readonly missingRecommended: readonly string[];
}

interface VariantSummary {
	readonly variant: CardVariant;
	readonly requiredFields: readonly string[];
	readonly recommendedFields: readonly string[];
	readonly totalChecked: number;
	readonly missingRequiredCount: number;
	readonly missingRecommendedCount: number;
}

/** Pick the wrapper variant for a given reference kind + slug shape. */
function pickVariant(refKind: string, documentSlug: string): CardVariant {
	if (refKind === REFERENCE_KINDS.CFR) return 'CfrPartCard';
	if (refKind === REFERENCE_KINDS.AIM || refKind === REFERENCE_KINDS.PCG) return 'AimCorpusCard';
	if (refKind === REFERENCE_KINDS.AC) return 'AcCard';
	if (refKind === REFERENCE_KINDS.NTSB) return 'NtsbCard';
	if (refKind === REFERENCE_KINDS.HANDBOOK) return 'HandbookCard';
	void documentSlug;
	return 'UmbrellaCard';
}

function projectForVariant(
	variant: CardVariant,
	ref: { documentSlug: string; title: string; edition: string; publisher: string; metadata: unknown },
): Record<string, unknown> {
	const m = ref.metadata && typeof ref.metadata === 'object' ? (ref.metadata as Record<string, unknown>) : {};
	switch (variant) {
		case 'CfrPartCard': {
			const titleNumber = ref.documentSlug.startsWith('14cfr') ? 14 : ref.documentSlug.startsWith('49cfr') ? 49 : null;
			const partNumber = ref.documentSlug.replace(/^(14|49)cfr/, '');
			const external =
				titleNumber === 14 || titleNumber === 49 ? { url: buildPartUrl(titleNumber, partNumber), label: 'eCFR' } : null;
			return {
				titleNumber,
				partNumber,
				partTitle: m.officialTitle ?? ref.title,
				description: m.description,
				whyItMatters: m.whyItMatters,
				external,
			};
		}
		case 'CfrTitleCard': {
			return {
				shortLabel: m.shortLabel ?? '',
				topic: m.topic ?? '',
				description: m.description ?? '',
				whyItMatters: m.whyItMatters ?? '',
				external: m.external ?? null,
			};
		}
		case 'AimCorpusCard':
			return {
				title: ref.title,
				officialTitle: m.officialTitle ?? null,
				description: m.description ?? '',
				whyItMatters: m.whyItMatters ?? '',
			};
		case 'AcCard':
			return {
				acNumber: ref.documentSlug.replace(/^ac-/, ''),
				acTitle: ref.title,
				edition: ref.edition,
				description: m.description,
			};
		case 'NtsbCard':
			return {
				reportNumber: ref.documentSlug,
				reportTitle: ref.title,
				summary: m.description,
				date: m.date,
			};
		case 'HandbookCard':
			return {
				shortSlug: ref.documentSlug,
				fullTitle: ref.title,
				edition: ref.edition,
				publisher: ref.publisher,
				description: m.description,
				whyItMatters: m.whyItMatters,
			};
		default:
			// CfrSectionCard + UmbrellaCard fall through here. Both render
			// from the reference's title alone in this audit projection.
			return { title: ref.title };
	}
}

export const load: PageServerLoad = async () => {
	const refs = await listReferences({}, db);

	const audit: AuditRow[] = [];
	for (const ref of refs) {
		const variant = pickVariant(ref.kind, ref.documentSlug);
		const data = projectForVariant(variant, {
			documentSlug: ref.documentSlug,
			title: ref.title,
			edition: ref.edition,
			publisher: ref.publisher,
			metadata: ref.metadata,
		});
		const result = validateCardData(variant, ref.documentSlug, data);
		audit.push({
			subject: ref.documentSlug,
			variant,
			missingRequired: result.missingRequired,
			missingRecommended: result.missingRecommended,
		});
	}

	// Bucket the kind-level CfrTitleCard / NTSB-corpus checks separately --
	// these are not stored on a `reference` row but in the static kind-copy
	// registry. Validate against the registry directly.
	const kindLevelAudit: AuditRow[] = [];
	for (const kind of [LIBRARY_REGULATIONS_KINDS.CFR_14, LIBRARY_REGULATIONS_KINDS.CFR_49]) {
		const copy = LIBRARY_REGULATIONS_KIND_COPY[kind];
		const titleNumber = kind === LIBRARY_REGULATIONS_KINDS.CFR_14 ? 14 : 49;
		const result = validateCardData('CfrTitleCard', `${kind} kind copy`, {
			shortLabel: copy.shortLabel,
			topic: copy.topic,
			description: copy.description,
			whyItMatters: copy.whyItMatters,
			external: { url: buildEcfrUrl(titleNumber, {}), label: 'eCFR' },
		});
		kindLevelAudit.push({
			subject: `${kind} (kind copy)`,
			variant: 'CfrTitleCard',
			missingRequired: result.missingRequired,
			missingRecommended: result.missingRecommended,
		});
	}

	// Variant inventory + summary stats.
	const variants: CardVariant[] = [
		'CfrTitleCard',
		'CfrPartCard',
		'CfrSectionCard',
		'AimCorpusCard',
		'AcCard',
		'NtsbCard',
		'HandbookCard',
		'UmbrellaCard',
	];
	const summary: VariantSummary[] = variants.map((v) => {
		const rows = [...audit, ...kindLevelAudit].filter((r) => r.variant === v);
		return {
			variant: v,
			requiredFields: REQUIRED_FIELDS_BY_VARIANT[v],
			recommendedFields: RECOMMENDED_FIELDS_BY_VARIANT[v],
			totalChecked: rows.length,
			missingRequiredCount: rows.filter((r) => r.missingRequired.length > 0).length,
			missingRecommendedCount: rows.filter((r) => r.missingRecommended.length > 0).length,
		};
	});

	return {
		audit: [...kindLevelAudit, ...audit],
		summary,
	};
};
