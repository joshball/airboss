/**
 * Audit target-type constants used by `auditWrite({ targetType, ... })`.
 *
 * Every write to `audit.audit_log` tags the action with a `targetType` string
 * so readers can filter ("all hangar.ping events", "all study.card edits").
 * Centralizing the strings keeps the grammar consistent across apps and
 * prevents drift from typos at call sites.
 *
 * Convention: `<schema>.<table>` for row-scoped mutations, `<app>.<verb>`
 * for non-row actions (login, export, scaffold-ping).
 */
export const AUDIT_TARGETS = {
	/**
	 * Scaffold-era heartbeat emitted by `apps/hangar/` to prove the
	 * auth -> role gate -> form action -> audit write path end-to-end.
	 * Replaced by real targets (hangar.source, hangar.reference, ...)
	 * as later work packages land.
	 */
	HANGAR_PING: 'hangar.ping',
	/** Reference-registry edits in hangar (create / update / delete). */
	HANGAR_REFERENCE: 'hangar.reference',
	/** Source-registry edits in hangar. */
	HANGAR_SOURCE: 'hangar.source',
	/** Sync-to-disk events (the glossary/sources TOML commit flow). */
	HANGAR_SYNC: 'hangar.sync',
	/** Lifecycle events on a `hangar.job` row (enqueue, start, complete, fail). */
	HANGAR_JOB: 'hangar.job',
	/** wp-hangar-non-textual: edition resolver produced a resolved URL. */
	HANGAR_SOURCE_EDITION_RESOLVED: 'hangar.source.edition-resolved',
	/** wp-hangar-non-textual: fetch saw same edition date but different sha. */
	HANGAR_SOURCE_EDITION_DRIFT: 'hangar.source.edition-drift',
	/** wp-hangar-non-textual: thumbnail generated successfully at ingest. */
	HANGAR_SOURCE_THUMBNAIL_GENERATED: 'hangar.source.thumbnail-generated',
	/**
	 * Edits to a `bauth_user` row from the hangar admin surface (role assign,
	 * ban / unban, session revoke). The op-distinguishing kind is carried in
	 * `metadata.subKind` from the closed `HANGAR_USER_OP_SUBKINDS` set below.
	 */
	HANGAR_USER: 'hangar.user',
} as const;

export type AuditTarget = (typeof AUDIT_TARGETS)[keyof typeof AUDIT_TARGETS];

/** Allow-list values used by the DB CHECK constraint on `audit_log.target_type`. */
export const AUDIT_TARGET_VALUES: readonly AuditTarget[] = Object.values(AUDIT_TARGETS);

/**
 * Op-distinguishing sub-kind for `AUDIT_TARGETS.HANGAR_USER` audit rows.
 * Carried in `metadata.subKind` so the audit schema's `op` enum stays tight
 * (`update` / `action`) while still allowing fine-grained filters in queries
 * (e.g. `metadata->>'subKind' = 'ban'`).
 */
export const HANGAR_USER_OP_SUBKINDS = {
	/** Admin set the target user's `role` column. `op = update`. */
	ROLE_ASSIGN: 'role-assign',
	/** Admin flipped `banned` to `true` (with reason / optional expiry). `op = update`. */
	BAN: 'ban',
	/** Admin flipped `banned` to `false`. `op = update`. */
	UNBAN: 'unban',
	/** Admin revoked a single session for the target user. `op = action`. */
	SESSION_REVOKE: 'session-revoke',
	/** Admin revoked every session for the target user. `op = action`. */
	SESSION_REVOKE_ALL: 'session-revoke-all',
} as const;

export type HangarUserOpSubkind = (typeof HANGAR_USER_OP_SUBKINDS)[keyof typeof HANGAR_USER_OP_SUBKINDS];
export const HANGAR_USER_OP_SUBKIND_VALUES: readonly HangarUserOpSubkind[] = Object.values(HANGAR_USER_OP_SUBKINDS);
