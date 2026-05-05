import { requireAuth } from '@ab/auth';
import { getWeakAreas, type WeakArea } from '@ab/bc-study';
import {
	WEAKNESS_BUCKET_LIMIT,
	WEAKNESS_SEVERITY,
	WEAKNESS_SEVERITY_THRESHOLDS,
	WEAKNESS_SEVERITY_VALUES,
	type WeaknessSeverity,
} from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

function scoreToSeverity(score: number): WeaknessSeverity | null {
	const normalized = Math.max(0, Math.min(1, score / 3));
	if (normalized >= WEAKNESS_SEVERITY_THRESHOLDS[WEAKNESS_SEVERITY.SEVERE]) return WEAKNESS_SEVERITY.SEVERE;
	if (normalized >= WEAKNESS_SEVERITY_THRESHOLDS[WEAKNESS_SEVERITY.MODERATE]) return WEAKNESS_SEVERITY.MODERATE;
	if (normalized >= WEAKNESS_SEVERITY_THRESHOLDS[WEAKNESS_SEVERITY.MILD]) return WEAKNESS_SEVERITY.MILD;
	return null;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const severityRaw = event.params.severity;
	if (!WEAKNESS_SEVERITY_VALUES.includes(severityRaw as WeaknessSeverity)) {
		throw error(404, `Unknown severity '${severityRaw}'.`);
	}
	const severity = severityRaw as WeaknessSeverity;
	const all = await getWeakAreas(user.id, WEAKNESS_BUCKET_LIMIT);
	const areas: WeakArea[] = [];
	for (const area of all) {
		if (scoreToSeverity(area.score) === severity) areas.push(area);
		if (areas.length >= WEAKNESS_BUCKET_LIMIT) break;
	}
	return { severity, areas };
};
