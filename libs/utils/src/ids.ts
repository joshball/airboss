import {
	ANNOTATION_ID_PREFIX,
	CARD_DRAFT_ID_PREFIX,
	CREDENTIAL_ID_PREFIX,
	GOAL_ID_PREFIX,
	NOTE_ID_PREFIX,
	PLAN_ITEM_ID_PREFIX,
	SYLLABUS_ID_PREFIX,
	SYLLABUS_NODE_ID_PREFIX,
	SYLLABUS_NODE_LINK_ID_PREFIX,
} from '@ab/constants';
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
/**
 * Teaching-exercise row (study BC, evidence-kind-data-layer WP). Free-response
 * "explain / demonstrate" prompt that the candidate's session_item_result
 * binds to via `teaching_exercise_id`.
 */
export const generateTeachingExerciseId = (): string => createId('texr');
// Study plan + session engine.
export const generateStudyPlanId = (): string => createId('plan');
/**
 * Plan-item row (study BC, command-palette-pin-to-today). One row per
 * learner pin: knowledge node, reference section, card, or glossary term
 * placed on a date-scoped queue. See `study.plan_item` schema for the
 * polymorphic-FK shape.
 */
export const generatePlanItemId = (): string => createId(PLAN_ITEM_ID_PREFIX);
export const generateSessionId = (): string => createId('ses');
export const generateSessionItemResultId = (): string => createId('sir');
/** Memory-review session (review-sessions-url layer a "Resume"). */
export const generateReviewSessionId = (): string => createId('mrs');
/**
 * Saved-deck row (study BC). One row per (user, deckHash) when the learner
 * has renamed or dismissed the implicit Saved Decks entry derived from
 * memory-review sessions.
 */
export const generateSavedDeckId = (): string => createId('sdck');

// Audit BC -- generic change log, one row per mutation attempted through
// `auditWrite()` in libs/audit/src/log.ts.
export const generateAuditLogId = (): string => createId('aud');

/** Knowledge-node phase-progress row (per-user per-node). */
export const generateKnowledgeNodeProgressId = (): string => createId('knp');

/** Content-citation row (polymorphic source -> reference). */
export const generateContentCitationId = (): string => createId('ccit');

// Reference substrate (post-WP-SUB; ADR 016 phase 0 + library-completeness).
// `reference` = edition-versioned citation source for any corpus (handbook,
// CFR, AC, AIM, ...); `referenceSection` = per-content-node row in the
// hierarchy; `referenceFigure` = per-figure asset record. Errata + read-state
// rows live in their own tables (errata gets its own id; read-state has a
// composite PK).
export const generateReferenceId = (): string => createId('ref');
export const generateReferenceSectionId = (): string => createId('refsec');
export const generateReferenceFigureId = (): string => createId('reffig');
export const generateReferenceSectionErrataId = (): string => createId('refera');

// Hangar BC -- job queue + streamed log + sync ledger.
export const generateHangarJobId = (): string => createId('job');
export const generateHangarJobLogId = (): string => createId('jlg');
export const generateHangarSyncLogId = (): string => createId('syn');

// Hangar BC -- review queue (hangar-review-queue WP). Boards + columns hold
// review items / tasks; sessions + steps capture the per-walker progress;
// kinds + buckets are configuration for what items render where.
export const generateHangarBoardId = (): string => createId('brd');
export const generateHangarBoardColumnId = (): string => createId('bcol');
export const generateHangarReviewKindId = (): string => createId('rkind');
export const generateHangarReviewBucketId = (): string => createId('rbkt');
export const generateHangarReviewItemId = (): string => createId('ritem');
export const generateHangarReviewSessionId = (): string => createId('rses');
export const generateHangarReviewStepId = (): string => createId('rstp');
export const generateHangarBoardTaskId = (): string => createId('task');

// Sim BC -- one row per completed flight (Track 5).
export const generateSimAttemptId = (): string => createId('sat');

// Cert-syllabus-and-goal-composer (ADR 016 phases 1-6). Credential =
// pilot-cert / instructor-cert / rating / endorsement DAG node; syllabus =
// authored ACS / PTS / school / personal track; syllabus_node = one row in
// a syllabus tree; syllabus_node_link = leaf -> knowledge_node edge with
// weight; goal = learner-owned composition of syllabi + ad-hoc nodes.
//
// goal_syllabus and goal_node have composite PKs (goal_id + secondary id),
// so they don't need their own row id.
export const generateCredentialId = (): string => createId(CREDENTIAL_ID_PREFIX);
export const generateSyllabusId = (): string => createId(SYLLABUS_ID_PREFIX);
export const generateSyllabusNodeId = (): string => createId(SYLLABUS_NODE_ID_PREFIX);
export const generateSyllabusNodeLinkId = (): string => createId(SYLLABUS_NODE_LINK_ID_PREFIX);
export const generateGoalId = (): string => createId(GOAL_ID_PREFIX);

// Notes BC (wp-notes-primitive). One row per note; the markdown body
// + context FKs + tags live on `study.note`.
export const generateNoteId = (): string => createId(NOTE_ID_PREFIX);

// Rich-reader annotations + card-drafts (wp-flightbag-rich-reader).
// Annotation rows tie a passage anchor to a kind (highlight / note_anchor /
// card_draft_anchor). Card-draft rows hold prefilled card content awaiting
// the user's promote / discard decision in `/memory/drafts`.
export const generateAnnotationId = (): string => createId(ANNOTATION_ID_PREFIX);
export const generateCardDraftId = (): string => createId(CARD_DRAFT_ID_PREFIX);
