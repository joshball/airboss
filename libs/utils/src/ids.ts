import { ulid } from 'ulidx';

/**
 * Generic prefixed ULID generator.
 * Produces lowercase `${prefix}_${ulid}` strings.
 */
export function createId(prefix: string): string {
	return `${prefix}_${ulid().toLowerCase()}`;
}

// Identity layer (better-auth): plain ULID, no prefix -- better-auth manages its own tables
export const generateAuthId = (): string => ulid().toLowerCase();

// Study BC
export const generateCardId = (): string => createId('crd');
export const generateReviewId = (): string => createId('rev');
/** Snooze row (study BC, snooze-and-flag WP). One row per Snooze press. */
export const generateCardSnoozeId = (): string => createId('csnz');
/** Card feedback row (study BC, snooze-and-flag WP). Like/dislike/flag. */
export const generateCardFeedbackId = (): string => createId('cfbk');
// Decision reps (study BC) -- scenarios only. `repAttempt` was deleted per
// ADR 012; rep outcomes live on session_item_result rows now.
export const generateScenarioId = (): string => createId('rep');
// Study plan + session engine.
export const generateStudyPlanId = (): string => createId('plan');
export const generateSessionId = (): string => createId('ses');
export const generateSessionItemResultId = (): string => createId('sir');
/** Memory-review session (review-sessions-url layer a "Resume"). */
export const generateReviewSessionId = (): string => createId('mrs');

// Audit BC -- generic change log, one row per mutation attempted through
// `auditWrite()` in libs/audit/src/log.ts.
export const generateAuditLogId = (): string => createId('aud');

/** Knowledge-node phase-progress row (per-user per-node). */
export const generateKnowledgeNodeProgressId = (): string => createId('knp');

/** Content-citation row (polymorphic source -> reference). */
export const generateContentCitationId = (): string => createId('ccit');

// Hangar BC -- job queue + streamed log + sync ledger.
export const generateHangarJobId = (): string => createId('job');
export const generateHangarJobLogId = (): string => createId('jlg');
export const generateHangarSyncLogId = (): string => createId('syn');

// Sim BC -- one row per completed flight (Track 5).
export const generateSimAttemptId = (): string => createId('sat');
