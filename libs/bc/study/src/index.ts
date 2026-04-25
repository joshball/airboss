// Study BC -- spaced repetition, cards, reviews, scenarios, calibration.

export type {
	CalibrationBucket,
	CalibrationPageData,
	CalibrationResult,
	CalibrationTrendPoint,
	DomainCalibration,
} from './calibration';
export {
	getCalibration,
	getCalibrationPageData,
	getCalibrationPointCount,
	getCalibrationTrend,
} from './calibration';
export type {
	CardCrossReferences,
	CardCrossRefsPlans,
	CardCrossRefsReps,
	CardCrossRefsScenarios,
} from './card-cross-references';
export { CROSS_REF_SESSION_LIMIT, getCardCrossReferences } from './card-cross-references';
export type {
	CardFilters,
	CardWithState,
	CreateCardInput,
	RemovedCardRow,
	RemovedCardsFilters,
	UpdateCardInput,
} from './cards';
export {
	CardNotEditableError,
	CardNotFoundError,
	createCard,
	getCard,
	getCards,
	getCardsCount,
	getDueCards,
	getRemovedCards,
	getRemovedCardsCount,
	SourceRefRequiredError,
	setCardStatus,
	updateCard,
} from './cards';
export type { PublicCard, PublicCardCitation } from './cards-public';
export { getPublicCard } from './cards-public';
export type {
	ActivityDay,
	DashboardFetchers,
	DashboardPayload,
	PanelResult,
	RecentActivity,
	RepBacklog,
	RepBacklogDomain,
	WeakArea,
	WeakAreaReason,
} from './dashboard';
export {
	getDashboardPayload,
	getRecentActivity,
	getRepBacklog,
	getWeakAreas,
	overdueCutoff,
} from './dashboard';
export { runEngine } from './engine';
export type { SubmitFeedbackInput } from './feedback';
export { FeedbackCommentRequiredError, getLatestFeedback, submitFeedback } from './feedback';
export { formatNextInterval, formatNextIntervalAbsolute } from './formatters';
export type {
	CertAndDomainMatrix,
	CertProgress,
	DomainCertCell,
	DomainCertRow,
	KnowledgeNodeListRow,
	ListNodesFilters,
	NodeMasteryGate,
	NodeMasterySnapshot,
	NodeMasteryStats,
	NodePhaseProgress,
	NodeSummary,
	NodeView,
} from './knowledge';
export {
	computeCardGate,
	computeDisplayScore,
	computeRepGate,
	findRequiresCycle,
	getCardsForNode,
	getCertAndDomainMatrix,
	getCertProgress,
	getDomainCertMatrix,
	getNodeMastery,
	getNodeMasteryMap,
	getNodeProgress,
	getNodesByIds,
	getNodeView,
	isMastered,
	isNodeMastered,
	KnowledgeGraphCycleError,
	KnowledgeNodeNotFoundError,
	lifecycleFromContent,
	listNodeIds,
	listNodeSummaries,
	listNodesForBrowse,
	recordPhaseCompleted,
	recordPhaseVisited,
	refreshEdgeTargetExists,
	replaceNodeEdges,
	splitContentPhases,
	upsertKnowledgeNode,
} from './knowledge';
export type { CreatePlanInput, UpdatePlanInput } from './plans';
export {
	activatePlan,
	addSkipDomain,
	addSkipNode,
	archivePlan,
	createPlan,
	DomainOverlapError,
	DuplicateActivePlanError,
	getActivePlan,
	getPlan,
	getPlans,
	NoActivePlanError,
	PlanNotFoundError,
	removeSkipDomain,
	removeSkipNode,
	updatePlan,
} from './plans';
export type {
	CardSessionRef,
	ReviewSessionCard,
	ReviewSessionState,
	StartReviewSessionInput,
} from './review-sessions';
export {
	abandonStaleSessions,
	advanceReviewSession,
	computeDeckHash,
	getLatestResumableSession,
	getSessionsForCard,
	ReviewSessionNotFoundError,
	resumeReviewSession,
	startReviewSession,
} from './review-sessions';
export type { SubmitReviewInput } from './reviews';
export { CardNotReviewableError, NoReviewToUndoError, submitReview, undoReview } from './reviews';
export type {
	CreateScenarioInput,
	DomainAccuracyStats,
	RepAccuracyStats,
	RepAttemptOutcome,
	RepDashboardStats,
	RepStats,
	ScenarioFilters,
	SubmitAttemptInput,
} from './scenarios';
export {
	createScenario,
	getDomainAccuracy,
	getNextScenarios,
	getRepAccuracy,
	getRepDashboard,
	getRepStats,
	getScenario,
	getScenarios,
	getScenariosCount,
	InvalidOptionError,
	ScenarioNotAttemptableError,
	ScenarioNotFoundError,
	setScenarioStatus,
	submitAttempt,
} from './scenarios';
// Drizzle table objects + row types. Table objects are exported for scripts
// and seed code; route handlers should prefer BC functions and never issue
// raw db.insert/select on these tables.
export type {
	CardFeedbackRow,
	CardRow,
	CardSnoozeRow,
	CardStateRow,
	KnowledgeEdgeRow,
	KnowledgeNodeProgressRow,
	KnowledgeNodeRow,
	MemoryReviewSessionRow,
	NewCardFeedbackRow,
	NewCardRow,
	NewCardSnoozeRow,
	NewCardStateRow,
	NewKnowledgeEdgeRow,
	NewKnowledgeNodeProgressRow,
	NewKnowledgeNodeRow,
	NewMemoryReviewSessionRow,
	NewReviewRow,
	NewScenarioRow,
	NewSessionItemResultRow,
	NewSessionRow,
	NewStudyPlanRow,
	ReviewRow,
	ReviewSessionDeckSpec,
	ScenarioOption,
	ScenarioRow,
	SessionItem,
	SessionItemResultRow,
	SessionRow,
	StudyPlanRow,
} from './schema';
export {
	card,
	cardFeedback,
	cardSnooze,
	cardState,
	knowledgeEdge,
	knowledgeNode,
	knowledgeNodeProgress,
	memoryReviewSession,
	review,
	scenario,
	session,
	sessionItemResult,
	studyPlan,
	studySchema,
} from './schema';
export type {
	ItemResultInput,
	PreviewOptions,
	SessionPreview,
	SessionSuggestedAction,
	SessionSummary,
	SessionSummarySliceRow,
	SkipSessionSlotInput,
} from './sessions';
export {
	buildEnginePools,
	commitSession,
	completeSession,
	getResumableSession,
	getSession,
	getSessionItemResult,
	getSessionItemResults,
	getSessionSummary,
	getSessions,
	getStreakDays,
	previewSession,
	recordItemResult,
	SessionNotFoundError,
	SessionSlotNotFoundError,
	skipSessionSlot,
	startSession,
} from './sessions';
export type { RemoveCardInput, ReplacementCardResult, RestoreCardInput, SnoozeCardInput } from './snooze';
export {
	CardAlreadyRemovedError,
	getActiveSnoozes,
	getReplacementCard,
	getUnresolvedReEntrySnooze,
	markCardEditedForActiveBadQuestionSnoozes,
	removeCard,
	resolveBadQuestionSnooze,
	restoreCard,
	restoreCardByCard,
	SnoozeCommentRequiredError,
	SnoozeNotFoundError,
	snoozeCard,
} from './snooze';
export type { CardSchedulerState, ScheduleResult } from './srs';
export { fsrsDefaultParams, fsrsInitialState, fsrsPreviewAll, fsrsSchedule } from './srs';
export type {
	DashboardStats,
	DomainStats,
	MasteryStats,
	RecentAttemptRow,
	RecentReviewRow,
	ReviewStats,
} from './stats';
export {
	getCardMastery,
	getDashboardStats,
	getDomainBreakdown,
	getDueCardCount,
	getMasteredCount,
	getRecentAttemptsForScenario,
	getRecentReviewsForCard,
	getReviewStats,
} from './stats';
export {
	cardTagsSchema,
	cardTextSchema,
	confidenceSchema,
	type NewCardInput,
	type NewScenarioInput,
	newCardSchema,
	newScenarioSchema,
	regReferencesSchema,
	reviewRatingSchema,
	scenarioOptionSchema,
	scenarioOptionsSchema,
	submitAttemptSchema,
	submitReviewSchema,
	updateCardSchema,
} from './validation';
