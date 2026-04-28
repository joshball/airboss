/**
 * Hangar admin home -- a small dashboard with one tile per planned area
 * (Content / People / System). Each tile shows live counts pulled from
 * the runtime mirrors so an operator can read the system at a glance.
 *
 * All counts run in parallel via BC helpers. Anything that throws falls
 * back to 0; this page must never blow up just because one counter is
 * unavailable.
 */

import { countAuditEntriesSince } from '@ab/audit';
import { countAllUsers, requireRole } from '@ab/auth';
import { countAllJobs, countLiveReferences, countLiveSources } from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import type { PageServerLoad } from './$types';

const AUDIT_WINDOW_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

async function safeCount(query: Promise<number>): Promise<number> {
	try {
		return await query;
	} catch {
		return 0;
	}
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);

	const auditWindowStart = new Date(Date.now() - AUDIT_WINDOW_HOURS * MS_PER_HOUR);

	const [sourceCount, glossaryCount, userCount, recentAuditCount, jobCount] = await Promise.all([
		safeCount(countLiveSources()),
		safeCount(countLiveReferences()),
		safeCount(countAllUsers()),
		safeCount(countAuditEntriesSince(auditWindowStart)),
		safeCount(countAllJobs()),
	]);

	return {
		counts: {
			sources: sourceCount,
			glossary: glossaryCount,
			users: userCount,
			recentAudits: recentAuditCount,
			jobs: jobCount,
		},
		auditWindowHours: AUDIT_WINDOW_HOURS,
	};
};
