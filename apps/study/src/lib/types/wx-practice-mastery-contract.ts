/**
 * Local mirror of the FROZEN `@ab/bc-wx-practice` schema contract.
 *
 * Drill Phase 3 owns `libs/bc/wx-practice/` and exposes `WxPracticeMasteryRow`
 * from `@ab/bc-wx-practice`. The mastery dashboard (Drill Phase 3b) imports
 * the type from this local file while Phase 3 is in flight; once
 * `@ab/bc-wx-practice` lands, the two import sites in this app switch to
 * `import type { WxPracticeMasteryRow } from '@ab/bc-wx-practice'` and this
 * file is deleted. The shape MUST stay byte-identical to the Phase 3 source
 * of truth -- see
 * `docs/work/plans/2026-05-14-wx-drill-and-practice.md` ("Frozen schema
 * contract from Drill Phase 3").
 *
 * @see docs/work/plans/2026-05-14-wx-drill-and-practice.md
 */

/** ISO-8601 timestamp (zoned, e.g. `2026-05-14T13:24:34.960Z`). */
export type ISO8601 = string;

/** Encoded-text products covered by the practice surface. */
export type WxPracticeProduct = 'metar' | 'taf' | 'pirep' | 'fb' | 'airmet';

/** Mastery state machine -- see Drill Phase 3 sampler design. */
export type WxPracticeState = 'active' | 'passive' | 'demoted';

/**
 * One row per `(user, product, family[, subFamily])` -- the per-token-family
 * mastery ledger. The dashboard renders one card per row plus one card per
 * "never seen" family (catalog families with no row for this user).
 */
export interface WxPracticeMasteryRow {
	readonly userId: string;
	readonly product: WxPracticeProduct;
	readonly family: string;
	readonly subFamily: string | null;
	readonly attempts: number;
	readonly correct: number;
	readonly recentRing: readonly boolean[];
	readonly streakAcrossSessions: number;
	readonly state: WxPracticeState;
	readonly lastSeenAt: ISO8601 | null;
	readonly lastUpdatedAt: ISO8601;
}
