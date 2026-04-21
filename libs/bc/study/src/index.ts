// Study BC -- spaced repetition, cards, reviews, scenarios, calibration.

export type { CalibrationBucket, CalibrationResult, CalibrationTrendPoint, DomainCalibration } from './calibration';
export { getCalibration, getCalibrationPointCount, getCalibrationTrend } from './calibration';
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
export type {
	KnowledgeNodeListRow,
	ListNodesFilters,
	NodeMasteryGate,
	NodeMasteryStats,
	NodeSummary,
	NodeView,
} from './knowledge';
export {
	computeCardGate,
	computeDisplayScore,
	computeRepGate,
	findRequiresCycle,
	getCardsForNode,
	getNodeMastery,
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
	refreshEdgeTargetExists,
	replaceNodeEdges,
	splitContentPhases,
	upsertKnowledgeNode,
} from './knowledge';
export type { SubmitReviewInput } from './reviews';
export { CardNotReviewableError, submitReview } from './reviews';
export type {
	CreateScenarioInput,
	DomainAccuracyStats,
	RepAccuracyStats,
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
	KnowledgeNodeRow,
	NewCardRow,
	NewCardStateRow,
	NewKnowledgeEdgeRow,
	NewKnowledgeNodeRow,
	NewRepAttemptRow,
	NewReviewRow,
	NewScenarioRow,
	RepAttemptRow,
	ReviewRow,
	ScenarioOption,
	ScenarioRow,
} from './schema';
export { card, cardState, knowledgeEdge, knowledgeNode, repAttempt, review, scenario, studySchema } from './schema';
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
