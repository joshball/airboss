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
import { getAuditEntry } from '@ab/bc-hangar/server';
import { ROLES } from '@ab/constants';
import { redactSensitive } from '@ab/utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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
			// Defense-in-depth scrub of any payload key whose name suggests
			// a credential / session token. The BC has no schema constraint
			// on what gets written into `metadata`, so a future caller could
			// plant a session token or temp-file path that an admin reader
			// would otherwise see verbatim. Closes chunk-6 security MIN.
			before: redactSensitive(row.before),
			after: redactSensitive(row.after),
			metadata: redactSensitive(row.metadata),
		},
	};
};
