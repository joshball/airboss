/**
 * Hangar admin home -- a small dashboard with one tile per planned area
 * (Content / People / System). Each tile shows live counts pulled from
 * the runtime mirrors so an operator can read the system at a glance.
 *
 * All counts run in parallel and use Drizzle's `count()` aggregate so we
 * never load full rows just to size them. Anything that throws or returns
 * empty falls back to 0; this page must never blow up just because one
 * counter is unavailable.
 */

import { auditLog } from '@ab/audit';
import { bauthUser, requireRole } from '@ab/auth';
import { ROLES } from '@ab/constants';
import { db, hangarJob, hangarReference, hangarSource } from '@ab/db';
import { count, gte, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const AUDIT_WINDOW_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

async function safeCount(query: Promise<{ c: number }[]>): Promise<number> {
	try {
		const rows = await query;
		return Number(rows[0]?.c ?? 0);
	} catch {
		return 0;
	}
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);

	const auditWindowStart = new Date(Date.now() - AUDIT_WINDOW_HOURS * MS_PER_HOUR);

	const [sourceCount, glossaryCount, userCount, recentAuditCount, jobCount] = await Promise.all([
		safeCount(db.select({ c: count() }).from(hangarSource).where(isNull(hangarSource.deletedAt))),
		safeCount(db.select({ c: count() }).from(hangarReference).where(isNull(hangarReference.deletedAt))),
		safeCount(db.select({ c: count() }).from(bauthUser)),
		safeCount(db.select({ c: count() }).from(auditLog).where(gte(auditLog.timestamp, auditWindowStart))),
		safeCount(db.select({ c: count() }).from(hangarJob)),
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
