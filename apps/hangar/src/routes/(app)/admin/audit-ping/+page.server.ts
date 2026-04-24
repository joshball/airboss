import { AUDIT_OPS, auditRecent, auditWrite } from '@ab/audit';
import { requireRole } from '@ab/auth';
import { AUDIT_TARGETS, ROLES } from '@ab/constants';
import type { Actions, PageServerLoad } from './$types';

const RECENT_LIMIT = 10;

/**
 * Load the last N `hangar.ping` audit rows so the home page can demonstrate
 * the full read-after-write path end-to-end.
 */
export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const rows = await auditRecent({ targetType: AUDIT_TARGETS.HANGAR_PING, limit: RECENT_LIMIT });
	return {
		user: { id: user.id, name: user.name, email: user.email, role: user.role },
		audits: rows.map((r) => ({
			id: r.id,
			timestamp: r.timestamp.toISOString(),
			actorId: r.actorId,
			op: r.op,
			targetType: r.targetType,
			metadata: r.metadata,
		})),
	};
};

export const actions: Actions = {
	/**
	 * Scaffold-era heartbeat: write a single audit row, tagged with the
	 * calling user and a request id. Proves the auth -> role gate -> form
	 * action -> audit write -> audit read-back path works end-to-end.
	 * Replaced by real actions (fetch, upload, extract, ...) in later WPs.
	 */
	ping: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		await auditWrite({
			actorId: user.id,
			op: AUDIT_OPS.ACTION,
			targetType: AUDIT_TARGETS.HANGAR_PING,
			targetId: null,
			metadata: {
				requestId: event.locals.requestId,
				userAgent: event.request.headers.get('user-agent') ?? null,
			},
		});
		return { ok: true };
	},
};
