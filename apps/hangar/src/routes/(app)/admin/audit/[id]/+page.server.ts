/**
 * Hangar admin audit explorer -- detail route loader.
 *
 * Looks up one `audit_log` row by primary key, joined with the actor's
 * identity in a single query (`getAuditEntry`). 404s when the row is
 * missing -- the cursor pagination tolerates a stale id silently, but
 * a deep-linked detail URL with a missing id should fail loud.
 *
 * ADMIN-only. Same gate as `/admin/audit` (the layout-level
 * AUTHOR | OPERATOR | ADMIN gate is too permissive for raw audit
 * payloads).
 */

import { requireRole } from '@ab/auth';
import { getAuditEntry } from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Defense-in-depth: redact secrets-shaped keys in audit JSON before render. */
const SECRET_KEY = /token|secret|password|cookie|apikey|api_key|bearer/i;
const REDACTED = '[redacted]';

function redact(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) return value.map(redact);
	if (typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = SECRET_KEY.test(k) ? REDACTED : redact(v);
		}
		return out;
	}
	return value;
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);

	const row = await getAuditEntry(event.params.id);
	if (!row) error(404, 'Audit row not found');

	return {
		entry: {
			id: row.id,
			timestamp: row.timestamp.toISOString(),
			actorId: row.actorId,
			actorName: row.actorName,
			actorEmail: row.actorEmail,
			actorRole: row.actorRole,
			op: row.op,
			targetType: row.targetType,
			targetId: row.targetId,
			before: redact(row.before),
			after: redact(row.after),
			metadata: redact(row.metadata),
		},
	};
};
