import {
	ANNOTATION_ID_PREFIX,
	AUDIT_LOG_ID_PREFIX,
	CARD_DRAFT_ID_PREFIX,
	CARD_FEEDBACK_ID_PREFIX,
	CARD_ID_PREFIX,
	CARD_SNOOZE_ID_PREFIX,
	CONTENT_CITATION_ID_PREFIX,
	CREDENTIAL_ID_PREFIX,
	GOAL_ID_PREFIX,
	HANGAR_BOARD_COLUMN_ID_PREFIX,
	HANGAR_BOARD_ID_PREFIX,
	HANGAR_BOARD_TASK_ID_PREFIX,
	HANGAR_JOB_ID_PREFIX,
	HANGAR_JOB_LOG_ID_PREFIX,
	HANGAR_REVIEW_BUCKET_ID_PREFIX,
	HANGAR_REVIEW_ITEM_ID_PREFIX,
	HANGAR_REVIEW_KIND_ID_PREFIX,
	HANGAR_REVIEW_SESSION_ID_PREFIX,
	HANGAR_REVIEW_STEP_ID_PREFIX,
	HANGAR_SYNC_LOG_ID_PREFIX,
	KNOWLEDGE_NODE_PROGRESS_ID_PREFIX,
	NOTE_ID_PREFIX,
	PERSONAL_MINIMUMS_ID_PREFIX,
	PLAN_ITEM_ID_PREFIX,
	REFERENCE_FIGURE_ID_PREFIX,
	REFERENCE_ID_PREFIX,
	REFERENCE_SECTION_ERRATA_ID_PREFIX,
	REFERENCE_SECTION_ID_PREFIX,
	REVIEW_ID_PREFIX,
	REVIEW_SESSION_ID_PREFIX,
	SAVED_DECK_ID_PREFIX,
	SCENARIO_ID_PREFIX,
	SESSION_ID_PREFIX,
	SESSION_ITEM_RESULT_ID_PREFIX,
	SIM_ATTEMPT_ID_PREFIX,
	STUDY_PLAN_ID_PREFIX,
	SYLLABUS_ID_PREFIX,
	SYLLABUS_NODE_ID_PREFIX,
	SYLLABUS_NODE_LINK_ID_PREFIX,
	TEACHING_EXERCISE_ID_PREFIX,
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
export const generateCardId = (): string => createId(CARD_ID_PREFIX);
export const generateReviewId = (): string => createId(REVIEW_ID_PREFIX);
/** Snooze row (study BC, snooze-and-flag WP). One row per Snooze press. */
export const generateCardSnoozeId = (): string => createId(CARD_SNOOZE_ID_PREFIX);
/** Card feedback row (study BC, snooze-and-flag WP). Like/dislike/flag. */
export const generateCardFeedbackId = (): string => createId(CARD_FEEDBACK_ID_PREFIX);
// Decision reps (study BC) -- scenarios only. `repAttempt` was deleted per
// ADR 012; rep outcomes live on session_item_result rows now.
export const generateScenarioId = (): string => createId(SCENARIO_ID_PREFIX);
/**
 * Teaching-exercise row (study BC, evidence-kind-data-layer WP). Free-response
 * "explain / demonstrate" prompt that the candidate's session_item_result
 * binds to via `teaching_exercise_id`.
 */
export const generateTeachingExerciseId = (): string => createId(TEACHING_EXERCISE_ID_PREFIX);
// Study plan + session engine.
export const generateStudyPlanId = (): string => createId(STUDY_PLAN_ID_PREFIX);
/**
 * Plan-item row (study BC, command-palette-pin-to-today). One row per
 * learner pin: knowledge node, reference section, card, or glossary term
 * placed on a date-scoped queue. See `study.plan_item` schema for the
 * polymorphic-FK shape.
 */
export const generatePlanItemId = (): string => createId(PLAN_ITEM_ID_PREFIX);
export const generateSessionId = (): string => createId(SESSION_ID_PREFIX);
export const generateSessionItemResultId = (): string => createId(SESSION_ITEM_RESULT_ID_PREFIX);
/** Memory-review session (review-sessions-url layer a "Resume"). */
export const generateReviewSessionId = (): string => createId(REVIEW_SESSION_ID_PREFIX);
/**
 * Saved-deck row (study BC). One row per (user, deckHash) when the learner
 * has renamed or dismissed the implicit Saved Decks entry derived from
 * memory-review sessions.
 */
export const generateSavedDeckId = (): string => createId(SAVED_DECK_ID_PREFIX);

// Audit BC -- generic change log, one row per mutation attempted through
// `auditWrite()` in libs/audit/src/log.ts.
export const generateAuditLogId = (): string => createId(AUDIT_LOG_ID_PREFIX);

/** Knowledge-node phase-progress row (per-user per-node). */
export const generateKnowledgeNodeProgressId = (): string => createId(KNOWLEDGE_NODE_PROGRESS_ID_PREFIX);

/** Content-citation row (polymorphic source -> reference). */
export const generateContentCitationId = (): string => createId(CONTENT_CITATION_ID_PREFIX);

// Reference substrate (post-WP-SUB; ADR 016 phase 0 + library-completeness).
// `reference` = edition-versioned citation source for any corpus (handbook,
// CFR, AC, AIM, ...); `referenceSection` = per-content-node row in the
// hierarchy; `referenceFigure` = per-figure asset record. Errata + read-state
// rows live in their own tables (errata gets its own id; read-state has a
// composite PK).
export const generateReferenceId = (): string => createId(REFERENCE_ID_PREFIX);
export const generateReferenceSectionId = (): string => createId(REFERENCE_SECTION_ID_PREFIX);
export const generateReferenceFigureId = (): string => createId(REFERENCE_FIGURE_ID_PREFIX);
export const generateReferenceSectionErrataId = (): string => createId(REFERENCE_SECTION_ERRATA_ID_PREFIX);

// Hangar BC -- job queue + streamed log + sync ledger.
export const generateHangarJobId = (): string => createId(HANGAR_JOB_ID_PREFIX);
export const generateHangarJobLogId = (): string => createId(HANGAR_JOB_LOG_ID_PREFIX);
export const generateHangarSyncLogId = (): string => createId(HANGAR_SYNC_LOG_ID_PREFIX);

// Hangar BC -- review queue (hangar-review-queue WP). Boards + columns hold
// review items / tasks; sessions + steps capture the per-walker progress;
// kinds + buckets are configuration for what items render where.
export const generateHangarBoardId = (): string => createId(HANGAR_BOARD_ID_PREFIX);
export const generateHangarBoardColumnId = (): string => createId(HANGAR_BOARD_COLUMN_ID_PREFIX);
export const generateHangarReviewKindId = (): string => createId(HANGAR_REVIEW_KIND_ID_PREFIX);
export const generateHangarReviewBucketId = (): string => createId(HANGAR_REVIEW_BUCKET_ID_PREFIX);
export const generateHangarReviewItemId = (): string => createId(HANGAR_REVIEW_ITEM_ID_PREFIX);
export const generateHangarReviewSessionId = (): string => createId(HANGAR_REVIEW_SESSION_ID_PREFIX);
export const generateHangarReviewStepId = (): string => createId(HANGAR_REVIEW_STEP_ID_PREFIX);
export const generateHangarBoardTaskId = (): string => createId(HANGAR_BOARD_TASK_ID_PREFIX);

// Sim BC -- one row per completed flight (Track 5).
export const generateSimAttemptId = (): string => createId(SIM_ATTEMPT_ID_PREFIX);

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

// Personal-minimums (personal-minimums-as-typed-contract WP). One row per
// revision of a pilot's stated go/no-go floors; the active record + the
// append-only revision history live on `study.personal_minimums`.
export const generatePersonalMinimumsId = (): string => createId(PERSONAL_MINIMUMS_ID_PREFIX);

// Rich-reader annotations + card-drafts (wp-flightbag-rich-reader).
// Annotation rows tie a passage anchor to a kind (highlight / note_anchor /
// card_draft_anchor). Card-draft rows hold prefilled card content awaiting
// the user's promote / discard decision in `/memory/drafts`.
export const generateAnnotationId = (): string => createId(ANNOTATION_ID_PREFIX);
export const generateCardDraftId = (): string => createId(CARD_DRAFT_ID_PREFIX);
