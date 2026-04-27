/**
 * Phase 3 -- eCFR live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`regs` corpus URL conventions) + the eCFR
 * Versioner endpoint shape documented in the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`.
 *
 * Current edition uses `https://www.ecfr.gov/current/title-<title>/...`.
 * Past editions use `https://www.ecfr.gov/on/<YYYY-MM-DD>/title-<title>/...`.
 *
 * The "past vs current" branch is a runtime decision the resolver makes; this
 * module accepts both as parameters and constructs the URL accordingly.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseRegsLocator } from './locator.ts';

const ECFR_BASE = 'https://www.ecfr.gov';

const SOURCE_ID_PREFIX = 'airboss-ref:regs/';

export interface RegsUrlContext {
	/** Snapshot date for past editions (e.g. '2026-01-01'). Required for past URLs. */
	readonly snapshotDate?: string;
	/** True when `edition` IS the current edition for the corpus. Drives '/current/' vs '/on/<date>/'. */
	readonly isCurrent: boolean;
}

/**
 * Build the eCFR URL for a given `regs` entry + edition.
 *
 * Returns null when the SourceId can't be parsed (defensive; the validator
 * should already have rejected such inputs upstream).
 */
export function getRegsLiveUrl(id: SourceId, edition: EditionId, ctx: RegsUrlContext): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseRegsLocator(locator);
	if (parsed.kind !== 'ok' || parsed.regs === undefined) return null;

	const { title, part, subpart, section } = parsed.regs;

	const datePrefix = ctx.isCurrent
		? '/current'
		: ctx.snapshotDate !== undefined && ctx.snapshotDate.length > 0
			? `/on/${ctx.snapshotDate}`
			: `/on/${edition}`;

	const titleSegment = `/title-${title}`;
	const partSegment = `/part-${part}`;

	if (section !== undefined) {
		return `${ECFR_BASE}${datePrefix}${titleSegment}${partSegment}/section-${part}.${section}`;
	}

	if (subpart !== undefined) {
		return `${ECFR_BASE}${datePrefix}${titleSegment}${partSegment}/subpart-${subpart.toUpperCase()}`;
	}

	return `${ECFR_BASE}${datePrefix}${titleSegment}${partSegment}`;
}
