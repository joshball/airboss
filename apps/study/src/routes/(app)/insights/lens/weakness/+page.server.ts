import { requireAuth } from '@ab/auth';
import { getWeakAreas, type WeakArea } from '@ab/bc-study';
import {
	WEAKNESS_INDEX_LIMIT,
	WEAKNESS_SEVERITY,
	WEAKNESS_SEVERITY_THRESHOLDS,
	type WeaknessSeverity,
} from '@ab/constants';
import type { PageServerLoad } from './$types';

export interface WeaknessBucketView {
	severity: WeaknessSeverity;
	areas: WeakArea[];
}

/**
 * Map a `WeakArea.score` to a severity bucket. The existing scoring formula
 * in `getWeakAreas` produces unbounded scores (typically 0 to ~3). Normalise
 * by dividing by 3 and clamping to [0, 1] so the thresholds in
 * WEAKNESS_SEVERITY_THRESHOLDS (which are in [0, 1]) apply.
 *
 * Returns null when the score is below the mild threshold; such areas are
 * not surfaced.
 */
function scoreToSeverity(score: number): WeaknessSeverity | null {
	const normalized = Math.max(0, Math.min(1, score / 3));
	if (normalized >= WEAKNESS_SEVERITY_THRESHOLDS[WEAKNESS_SEVERITY.SEVERE]) return WEAKNESS_SEVERITY.SEVERE;
	if (normalized >= WEAKNESS_SEVERITY_THRESHOLDS[WEAKNESS_SEVERITY.MODERATE]) return WEAKNESS_SEVERITY.MODERATE;
	if (normalized >= WEAKNESS_SEVERITY_THRESHOLDS[WEAKNESS_SEVERITY.MILD]) return WEAKNESS_SEVERITY.MILD;
	return null;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	// Pull a generous limit so all three buckets get filled. WEAK_AREA_LIMIT is
	// 5 by default; lens index wants up to WEAKNESS_INDEX_LIMIT per bucket.
	const all = await getWeakAreas(user.id, WEAKNESS_INDEX_LIMIT * 3);
	const buckets: Record<WeaknessSeverity, WeakArea[]> = {
		[WEAKNESS_SEVERITY.SEVERE]: [],
		[WEAKNESS_SEVERITY.MODERATE]: [],
		[WEAKNESS_SEVERITY.MILD]: [],
	};
	for (const area of all) {
		const severity = scoreToSeverity(area.score);
		if (severity === null) continue;
		buckets[severity].push(area);
	}
	const views: WeaknessBucketView[] = [
		{ severity: WEAKNESS_SEVERITY.SEVERE, areas: buckets[WEAKNESS_SEVERITY.SEVERE].slice(0, WEAKNESS_INDEX_LIMIT) },
		{ severity: WEAKNESS_SEVERITY.MODERATE, areas: buckets[WEAKNESS_SEVERITY.MODERATE].slice(0, WEAKNESS_INDEX_LIMIT) },
		{ severity: WEAKNESS_SEVERITY.MILD, areas: buckets[WEAKNESS_SEVERITY.MILD].slice(0, WEAKNESS_INDEX_LIMIT) },
	];
	return { buckets: views };
};
