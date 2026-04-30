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
} as const;

export type AuditTarget = (typeof AUDIT_TARGETS)[keyof typeof AUDIT_TARGETS];

/** Allow-list values used by the DB CHECK constraint on `audit_log.target_type`. */
export const AUDIT_TARGET_VALUES: readonly AuditTarget[] = Object.values(AUDIT_TARGETS);

/**
 * Preset time-window options for the hangar audit explorer filter bar.
 *
 *   - `1h` / `24h` / `7d` / `30d`: rolling lookback from `now()`.
 *   - `all`: no time bound.
 *   - `custom`: caller supplies explicit `from` / `to` ISO datetimes.
 *
 * The default applied when no `window` / `from` / `to` query params are
 * present is {@link AUDIT_WINDOW_DEFAULT}.
 */
export const AUDIT_WINDOWS = {
	HOUR_1: '1h',
	HOUR_24: '24h',
	DAY_7: '7d',
	DAY_30: '30d',
	ALL: 'all',
	CUSTOM: 'custom',
} as const;

export type AuditWindow = (typeof AUDIT_WINDOWS)[keyof typeof AUDIT_WINDOWS];

export const AUDIT_WINDOW_VALUES: readonly AuditWindow[] = Object.values(AUDIT_WINDOWS);

/** Default time window when no explicit `window` / `from` / `to` is supplied. */
export const AUDIT_WINDOW_DEFAULT: AuditWindow = AUDIT_WINDOWS.HOUR_24;

/** Human-readable labels for the chip group in the filter bar. */
export const AUDIT_WINDOW_LABELS: Record<AuditWindow, string> = {
	[AUDIT_WINDOWS.HOUR_1]: '1h',
	[AUDIT_WINDOWS.HOUR_24]: '24h',
	[AUDIT_WINDOWS.DAY_7]: '7d',
	[AUDIT_WINDOWS.DAY_30]: '30d',
	[AUDIT_WINDOWS.ALL]: 'all',
	[AUDIT_WINDOWS.CUSTOM]: 'custom',
};

/**
 * Default page size for `listAuditEntries`. Matches the spec's "default 50".
 */
export const AUDIT_LIST_DEFAULT_LIMIT = 50;

/** Hard cap on `listAuditEntries` page size. Spec section "In Scope" #6. */
export const AUDIT_LIST_HARD_CAP = 200;

/** Cap on `searchActorIds` typeahead results. */
export const AUDIT_ACTOR_SEARCH_LIMIT = 20;
