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
	/**
	 * Per-slot result writes on `study.session_item_result` driven by the
	 * session runner (`recordItemResult`, `skipSessionSlot`). Captures the
	 * before / after row snapshot so an operator can reconstruct what the
	 * learner submitted on a given slot without joining the mutable table.
	 */
	STUDY_SESSION_ITEM: 'study.session_item_result',
	/**
	 * Successful sign-in via better-auth (`/api/auth/sign-in/email` and any
	 * other future credential path). `actor_id` is the signed-in user's id;
	 * `target_id` mirrors that id so "all auth events for user X" reads
	 * cleanly off the `(target_type, target_id, timestamp)` composite. `op =
	 * action`, since login is non-mutating in the BC-row sense even though
	 * the auth schema creates a session row -- that lifecycle is captured
	 * separately. The audit row exists so admin surfaces can answer "who
	 * signed in last hour" without joining session history.
	 */
	AUTH_LOGIN: 'auth.login',
	/**
	 * Failed sign-in attempt -- bad credentials, rate-limited, banned-block,
	 * 5xx. `actor_id` is null because the request never authenticated; the
	 * email is intentionally NOT recorded in `metadata` (a verbose audit log
	 * full of typed-wrong emails is itself a user-enumeration leak). The
	 * `metadata.outcome` tag distinguishes the cases for the admin reader.
	 */
	AUTH_LOGIN_FAILED: 'auth.login-failed',
	/**
	 * Sign-out via `/api/auth/sign-out`. `actor_id` is the user that owned
	 * the session being terminated, captured before better-auth deletes the
	 * row. `target_id` mirrors the actor so the row reads cleanly in the
	 * "actions on user X" filter alongside `AUTH_LOGIN`.
	 */
	AUTH_LOGOUT: 'auth.logout',
	/**
	 * Lifecycle events on a `hangar.invitation` row (create / revoke / resend
	 * / accept). The per-op kind is carried in `metadata.subKind` from the
	 * closed `HANGAR_INVITATION_OP_SUBKINDS` set below. Distinct target type
	 * from `hangar.user` because invites are their own row family with their
	 * own id; the eventual `accepted_user_id` is recorded in metadata, not
	 * promoted to `targetId`. See
	 * `docs/work-packages/hangar-invite-flow/spec.md` decision (h).
	 */
	HANGAR_INVITATION: 'hangar.invitation',
	/**
	 * Per-user preference write on `study.user_pref` (study-home WP). Each
	 * `setUserPref` call emits one audit row; `target_id` is `<userId>:<key>`
	 * so the composite-PK pair stays addressable. WP 3 reuses the same
	 * target type for the render-mode preference key.
	 */
	USER_PREF: 'study.user_pref',
} as const;

export type AuditTarget = (typeof AUDIT_TARGETS)[keyof typeof AUDIT_TARGETS];

/**
 * Retired audit-target strings. These values are no longer emitted by any
 * call site, but the DB CHECK constraint on `audit.audit_log.target_type`
 * still has to allow them because existing audit rows are append-only per
 * ADR 004. Authors choosing a new audit target type MUST NOT reuse any of
 * these strings.
 *
 * Move a value out of `AUDIT_TARGETS` and into here when a target retires.
 */
export const AUDIT_TARGETS_RETIRED = {
	/**
	 * Scaffold-era heartbeat. The `/admin/audit-ping` route was removed once
	 * real BC writes (cards, sources, hangar.user) made the diagnostic
	 * redundant.
	 */
	HANGAR_PING: 'hangar.ping',
} as const;

export type AuditTargetRetired = (typeof AUDIT_TARGETS_RETIRED)[keyof typeof AUDIT_TARGETS_RETIRED];

/**
 * Allow-list values used by the DB CHECK constraint on `audit_log.target_type`.
 * Includes both currently-emitted targets (`AUDIT_TARGETS`) and retired
 * targets (`AUDIT_TARGETS_RETIRED`) so historic rows stay valid against the
 * generated CHECK clause.
 */
export const AUDIT_TARGET_VALUES: readonly (AuditTarget | AuditTargetRetired)[] = [
	...Object.values(AUDIT_TARGETS),
	...Object.values(AUDIT_TARGETS_RETIRED),
];

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

/**
 * Op-distinguishing sub-kind for `AUDIT_TARGETS.HANGAR_INVITATION` audit rows.
 * Mirrors {@link HANGAR_USER_OP_SUBKINDS} -- the audit `op` enum stays tight
 * (`create` / `update` / `action`) and the per-op flavour rides in
 * `metadata.subKind`. The accept event (`subKind = accept`) is the only one
 * the recipient drives; create / revoke / resend are admin-driven.
 */
export const HANGAR_INVITATION_OP_SUBKINDS = {
	/** Admin created an invitation. `op = create`. */
	CREATE: 'create',
	/** Admin revoked a pending invitation (soft-delete). `op = update`. */
	REVOKE: 'revoke',
	/** Admin re-sent an invitation; old token invalidated. `op = action`. */
	RESEND: 'resend',
	/** Recipient redeemed the token and signed up. `op = action`. */
	ACCEPT: 'accept',
} as const;

export type HangarInvitationOpSubkind =
	(typeof HANGAR_INVITATION_OP_SUBKINDS)[keyof typeof HANGAR_INVITATION_OP_SUBKINDS];
export const HANGAR_INVITATION_OP_SUBKIND_VALUES: readonly HangarInvitationOpSubkind[] =
	Object.values(HANGAR_INVITATION_OP_SUBKINDS);

/**
 * Default expiry on a freshly minted hangar invitation, in days. Matches
 * `docs/work-packages/hangar-invite-flow/spec.md` decision (a). Long enough
 * for a busy CFI to act on it; short enough that a stale token in someone's
 * inbox stops working before it can be misused.
 */
export const INVITATION_DEFAULT_EXPIRY_DAYS = 7;

/**
 * Number of random bytes in a hangar invitation token. base64url-encoded
 * the token is 43 characters. Decision (b) in the spec: 32 bytes via
 * `crypto.getRandomValues`, no JWT, no signed envelope. Lookup is a
 * unique-index hit on `hangar.invitation.token`.
 */
export const INVITATION_TOKEN_BYTES = 32;
