export { createErrorHandler } from './error-handler';
export { type RequireIntResult, requireInt } from './form';
export {
	createId,
	generateAnnotationId,
	generateAuditLogId,
	generateAuthId,
	generateCardDraftId,
	generateCardFeedbackId,
	generateCardId,
	generateCardSnoozeId,
	generateContentCitationId,
	generateCredentialId,
	generateGoalId,
	generateHangarBoardColumnId,
	generateHangarBoardId,
	generateHangarBoardTaskId,
	generateHangarJobId,
	generateHangarJobLogId,
	generateHangarReviewBucketId,
	generateHangarReviewItemId,
	generateHangarReviewKindId,
	generateHangarReviewSessionId,
	generateHangarReviewStepId,
	generateHangarSyncLogId,
	generateKnowledgeNodeProgressId,
	generateNoteId,
	generatePlanItemId,
	generateReferenceFigureId,
	generateReferenceId,
	generateReferenceSectionErrataId,
	generateReferenceSectionId,
	generateReviewId,
	generateReviewSessionId,
	generateSavedDeckId,
	generateScenarioId,
	generateSessionId,
	generateSessionItemResultId,
	generateSimAttemptId,
	generateStudyPlanId,
	generateSyllabusId,
	generateSyllabusNodeId,
	generateSyllabusNodeLinkId,
	generateTeachingExerciseId,
} from './ids';
export { createLogger, type Logger } from './logger';
export {
	dedupeFirstHeading,
	escapeHtml,
	extractHandbookTableLinks,
	extractImageUrls,
	type FrontmatterEntry,
	findFigureReferences,
	type HandbookTableLink,
	injectFigureRefs,
	normalizeHandbookAssetPath,
	type ParsedFrontmatter,
	parseFrontmatter,
	renderMarkdown,
	sanitizeInlineHtml,
	setFrontmatterField,
	setFrontmatterFields,
	stripFrontmatter,
} from './markdown';
export { narrow } from './narrow';
export {
	type OutboundUrlError,
	type OutboundUrlOk,
	type OutboundUrlResult,
	type ValidateOutboundUrlOptions,
	validateOutboundUrl,
} from './outbound-url';
export { isSensitiveKey, REDACTED_PLACEHOLDER, redactSensitive } from './redact';
export { humanize, stripMarkdown, truncatePlainText } from './strings';
export { captureAnchor, reanchor, type TextAnchor, type TextRange } from './text-anchors';
export { type DiffOp, wordDiff } from './text-diff';
export { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND, userStartOfDay } from './time';
export { buildQuery } from './url';
export { withViewTransition } from './view-transition';
