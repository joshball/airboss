/**
 * Hangar admin audit explorer -- list route loader.
 *
 * Reads filters from `event.url.searchParams` (per
 * docs/work-packages/hangar-audit-explorer/spec.md, decision 1: default
 * window 24h), composes them into an `AuditFilters` value, and calls the
 * `listAuditEntries` BC. Returns the page rows + nextCursor + the
 * actor-typeahead snapshot (when an actor search is active) so the UI
 * doesn't need a second round trip for the typical "I typed a name and
 * picked a hit" flow.
 *
 * Gated to ADMIN-only. The (app) layout already enforces
 * AUTHOR | OPERATOR | ADMIN; raw audit data needs the higher floor so
 * we re-gate at the page-server level (matches `/users`).
 */

import { requireRole } from '@ab/auth';
import { type AuditFilters, listAuditEntries, resolveActorForChip } from '@ab/bc-hangar/server';
import { AUDIT_LIST_DEFAULT_LIMIT, ROLES } from '@ab/constants';
import type { PageServerLoad } from './$types';
import { decodeAuditFilters } from './filters';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);

	const decoded = decodeAuditFilters(event.url.searchParams);

	const filters: AuditFilters = {
		actorId: decoded.actorId,
		targetType: decoded.targetType,
		targetId: decoded.targetId,
		op: decoded.op,
		from: decoded.resolvedWindow.from,
		to: decoded.resolvedWindow.to,
		cursor: decoded.cursor,
		limit: AUDIT_LIST_DEFAULT_LIMIT,
	};

	// Deep-link resolution for the actor chip: the URL carries `?actor=<id>`
	// when the user picked a typeahead hit (better-auth user id). The old
	// implementation called `searchActorIds(id, 1)` which runs an
	// ILIKE-on-name/email query that better-auth ids never match, leaving
	// every shared/bookmarked URL with a silently-empty chip.
	// `resolveActorForChip` routes id-shaped values to the exact-match
	// lookup and falls back to the typeahead search only for hand-edited
	// free-text values.
	const [page, actorOptions] = await Promise.all([listAuditEntries(filters), resolveActorForChip(decoded.actorId)]);

	return {
		rows: page.rows.map((r) => ({
			id: r.id,
			timestamp: r.timestamp.toISOString(),
			actorId: r.actorId,
			actorName: r.actorName,
			actorEmail: r.actorEmail,
			op: r.op,
			targetType: r.targetType,
			targetId: r.targetId,
			metadataPreview: r.metadataPreview,
		})),
		nextCursor: page.nextCursor,
		filters: {
			actorId: decoded.actorId ?? null,
			targetType: decoded.targetType ?? null,
			targetId: decoded.targetId ?? null,
			op: decoded.op ?? null,
			window: decoded.resolvedWindow.window,
			from: decoded.resolvedWindow.from?.toISOString() ?? null,
			to: decoded.resolvedWindow.to?.toISOString() ?? null,
		},
		// Hint for the filter bar: when the URL carries an ?actor=<id>, this
		// is the matching name/email so the typeahead can render the active
		// chip without re-querying. Empty array when no actor filter or
		// when the system-write sentinel is active.
		actorOptions: actorOptions.map((a) => ({ id: a.id, name: a.name, email: a.email })),
		limit: AUDIT_LIST_DEFAULT_LIMIT,
		/** Cap-banner trigger -- mirrors the `/users` "showing first N" treatment. */
		capReached: page.rows.length === AUDIT_LIST_DEFAULT_LIMIT,
	};
};
