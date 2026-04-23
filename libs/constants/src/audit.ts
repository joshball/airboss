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
} as const;

export type AuditTarget = (typeof AUDIT_TARGETS)[keyof typeof AUDIT_TARGETS];
