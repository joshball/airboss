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
export type { CardFilters, CardWithState, CreateCardInput, UpdateCardInput } from './cards';
export {
	CardNotEditableError,
	CardNotFoundError,
	createCard,
	getCard,
	getCards,
	getDueCards,
	SourceRefRequiredError,
	setCardStatus,
	updateCard,
} from './cards';
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
	CardRow,
	CardStateRow,
	KnowledgeEdgeRow,
	KnowledgeNodeProgressRow,
	KnowledgeNodeRow,
	NewCardRow,
	NewCardStateRow,
	NewKnowledgeEdgeRow,
	NewKnowledgeNodeProgressRow,
	NewKnowledgeNodeRow,
	NewReviewRow,
	NewScenarioRow,
	NewSessionItemResultRow,
	NewSessionRow,
	NewStudyPlanRow,
	ReviewRow,
	ScenarioOption,
	ScenarioRow,
	SessionItem,
	SessionItemResultRow,
	SessionRow,
	StudyPlanRow,
} from './schema';
export {
	card,
	cardState,
	knowledgeEdge,
	knowledgeNode,
	knowledgeNodeProgress,
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
	startSession,
} from './sessions';
export type { CardSchedulerState, ScheduleResult } from './srs';
export { fsrsDefaultParams, fsrsInitialState, fsrsSchedule } from './srs';
export type { DashboardStats, DomainStats, MasteryStats, RecentReviewRow, ReviewStats } from './stats';
export {
	getCardMastery,
	getDashboardStats,
	getDomainBreakdown,
	getDueCardCount,
	getMasteredCount,
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
