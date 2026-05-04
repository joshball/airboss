// Study BC -- spaced repetition, cards, reviews, scenarios, calibration,
// and the polymorphic content-citation surface (folded in from the former
// citations package; see docs/work-packages/bc-citations-coupling/).
//
// Build-only helpers (seeders' upserts, manifest validators, citation audit,
// citation ingestion schemas) live in `./build.ts`. They are intentionally
// not re-exported from this barrel so a route loader / form action can never
// reach them. Closes the chunk-2 security MAJOR finding in
// `docs/work/reviews/2026-05-01-study-bc-domain-security.md`.

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
	CardsFacetCounts,
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
	getCardsFacetCounts,
	getCardsForNodeByKind,
	getDueCards,
	getRemovedCards,
	getRemovedCardsCount,
	InvalidCardKindError,
	setCardStatus,
	updateCard,
} from './cards';
export type { PublicCard, PublicCardCitation } from './cards-public';
export { composePublicCardCitations, getPublicCard } from './cards-public';
// Citation audit (`AUDIT_FINDING_KINDS`, `AuditFinding`, `AuditFindingKind`,
// `AuditReport`, `auditCitations`) is build-only -- exported from
// `@ab/bc-study/build`. It reads every citation row across all users.
export {
	CitationNotFoundError,
	CitationNotOwnedError,
	CitationSourceNotFoundError,
	CitationTargetNotFoundError,
	CitationValidationError,
	type CitationWithSource,
	type CitationWithTarget,
	type ContentCitationRow,
	type CorpusCoverage,
	type CreateCitationInput,
	contentCitation,
	createCitation,
	DuplicateCitationError,
	deleteCitation,
	formatSectionLabel,
	getCitationsOf,
	getCitedBy,
	type KnowledgeNodeSearchResult,
	type NewContentCitationRow,
	resolveCitationSources,
	resolveCitationTargets,
	type SectionSearchResult,
	searchKnowledgeNodes,
	searchReferenceSections,
	type TargetTypeTally,
} from './citations';
export type {
	AreaMasteryRollup,
	CredentialDagSnapshot,
	CredentialMasteryRollup,
	ListCredentialsOptions,
} from './credentials';
// Credential writers (`upsertCredential`, `upsertCredentialPrereq`,
// `upsertCredentialSyllabus`) and `validateCredentialDag` are build-only
// -- exported from `@ab/bc-study/build`. Credentials are shared course
// content rewritten by seeders, not per-user data.
export {
	CredentialNotFoundError,
	CredentialPrereqCycleError,
	CredentialPrereqUnresolvedNodesError,
	getCertsCoveredBy,
	getCredentialById,
	getCredentialBySlug,
	getCredentialIdsCoveredBy,
	getCredentialMastery,
	getCredentialMasteryMap,
	getCredentialPrereqDag,
	getCredentialPrereqs,
	getCredentialPrimarySyllabus,
	getCredentialSyllabi,
	getCredentialsByIds,
	listCredentials,
} from './credentials';
// Goal-CRUD Zod schemas + their inferred input types. The BC `goals.ts`
// write helpers parse against these inside their function bodies as a
// defense-in-depth layer on top of the route-level coercion. Re-exported
// so route actions and cross-BC callers reach for the same shape the BC
// enforces at function entry.
export {
	type AddGoalNodeInput,
	type AddGoalSyllabusInput,
	type ApplyCertGoalsInput,
	addGoalNodeInputSchema,
	addGoalSyllabusInputSchema,
	applyCertGoalsInputSchema,
	type CreateGoalInput,
	createGoalInputSchema,
	type GoalDomainList,
	type GoalNodeIdList,
	goalDomainListSchema,
	goalNodeIdListSchema,
	type UpdateGoalInput,
	updateGoalInputSchema,
} from './credentials.validation';
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
	getFirstTouchDate,
	getRecentActivity,
	getRepBacklog,
	getWeakAreas,
	overdueCutoff,
} from './dashboard';
export {
	canonicalDeckSpecJson,
	computeDeckHash,
	DeckSpecDecodeError,
	decodeDeckSpec,
	encodeDeckSpec,
	normalizeDeckSpec,
	summarizeDeckSpec,
} from './deck-spec';
export { runEngine } from './engine';
export type { EngineTargeting, EngineTargetingSnapshot } from './engine-targeting';
export {
	emitEngineTargetingTelemetry,
	getEngineTargeting,
	getEngineTargetingSnapshot,
} from './engine-targeting';
// Cross-file error classes (shared by 2+ modules in the BC).
export { SourceRefRequiredError, UpsertReturnedNoRowError } from './errors';
export type { SubmitFeedbackInput } from './feedback';
export { FeedbackCommentRequiredError, getLatestFeedback, submitFeedback } from './feedback';
export { formatNextInterval, formatNextIntervalAbsolute } from './formatters';
export type { ApplyCertGoalsResult, CreateGoalParams, ListGoalsOptions as ListGoalsOpts } from './goals';
export {
	addGoalNode,
	addGoalSyllabus,
	applyCertGoalsToPrimaryGoal,
	archiveGoal,
	createGoal,
	GoalAlreadyPrimaryError,
	GoalNotFoundError,
	GoalNotOwnedError,
	getActiveGoals,
	getDerivedCertGoals,
	getGoalById,
	getGoalFocusDomains,
	getGoalNodes,
	getGoalNodeUnion,
	getGoalSkipDomains,
	getGoalSkipNodes,
	getGoalSyllabi,
	getOwnedGoal,
	getPrimaryGoal,
	listGoals,
	removeGoalNode,
	removeGoalSyllabus,
	setGoalFocusDomains,
	setGoalNodeWeight,
	setGoalSkipDomains,
	setGoalSkipNodes,
	setGoalSyllabusWeight,
	setPrimaryGoal,
	updateGoal,
} from './goals';
export type {
	CertAndDomainMatrix,
	CertProgress,
	DomainCertCell,
	DomainCertRow,
	KnowledgeFacetCounts,
	KnowledgeNodeListRow,
	ListNodesFilters,
	NodeMasteryGate,
	NodeMasterySnapshot,
	NodeMasteryStats,
	NodePhaseProgress,
	NodeSummary,
	NodeView,
} from './knowledge';
// Knowledge-graph writers (`upsertKnowledgeNode`, `replaceNodeEdges`,
// `refreshEdgeTargetExists`) are build-only -- exported from
// `@ab/bc-study/build`. They rewrite shared knowledge_node /
// knowledge_edge rows, not per-user data.
export {
	computeCardGate,
	computeDisplayScore,
	computeRepGate,
	findRequiresCycle,
	getCardsForNode,
	getCertAndDomainMatrix,
	getCertProgress,
	getCitationsForKnowledgeNode,
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
	listNodesWithFacets,
	recordPhaseCompleted,
	recordPhaseVisited,
	splitContentPhases,
} from './knowledge';
export type {
	AcsLensFilters,
	DomainLensFilters,
	Lens,
	LensInput,
	LensLeaf,
	LensResult,
	LensTreeNode,
	MasteryRollup,
} from './lenses';
export { acsLens, computeMasteryRollup, domainLens, LensError } from './lenses';
// Library-by-cert spine (ADR 016 / library-by-cert WP wave 3).
export type { CarryoverGroup, CertReferenceBundle } from './library-by-cert';
export {
	getReferenceCountsByCert,
	getReferenceCountsByTopic,
	getReferencesForCertWithCarryover,
	listReferencesByTopic,
} from './library-by-cert';
// Runtime handbook input schemas. Route handlers parse `+server.ts` request
// bodies (heartbeat / notes) and form-action submissions (read status)
// against these. Manifest schemas + citation ingestion schemas
// (manifestSchema, acsManifestSchema, citationSchema, legacyCitationSchema,
// structuredCitationSchema, etc.) are build-only -- exported from
// `@ab/bc-study/build`.
export {
	handbookHeartbeatInputSchema,
	handbookNotesInputSchema,
	handbookReadStatusSchema,
} from './manifest-validation';
export type { GateState, LeafMasteryState, NodeEvidenceState } from './mastery';
export {
	aggregateLeafKindStates,
	credentialSlugToCertApplicability,
	getLeafMasteryStateMap,
	getNodeEvidenceState,
	getNodeEvidenceStateMap,
	isLeafMastered,
	SyllabusLeafNotFoundError,
} from './mastery';
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
	PlanCertGoalsDeprecatedError,
	PlanNotFoundError,
	removeSkipDomain,
	removeSkipNode,
	updatePlan,
} from './plans';
// Reference-section errata (apply-errata-and-afh-mosaic WP).
export type {
	ErrataDisplay,
	ErrataInsert,
	ReferenceSectionErrataRow,
} from './reference-errata';
export {
	countSectionsByErratumId,
	deleteErrataByErratumId,
	ErrataValidationError,
	formatErrataForDisplay,
	hasErrata,
	insertErrataRows,
	listErrataForSection,
	newErrataId,
	validateErrataInsert,
} from './reference-errata';
// Reference ingestion + reader (post-WP-SUB substrate; ADR 016 phase 0).
export type {
	CitingNodesBatchQuery,
	CitingNodesQuery,
	GetOpenWarningsOptions,
	GetReferenceOptions,
	HandbookProgressSummary,
	HandbookSectionView,
	ListReferencesOptions,
	OpenWarning,
	ReadingOrderEntry,
} from './references';
export {
	computeReadingOrder,
	getHandbookChapter,
	getHandbookProgress,
	getHandbookProgressMap,
	getHandbookSection,
	getNextInReadingOrder,
	getNodesCitingSection,
	getNodesCitingSectionsBatch,
	getOpenWarningsForReference,
	getPreviousInReadingOrder,
	getReadableReferenceIds,
	getReadingOrder,
	getReadState,
	getReferenceByDocument,
	getReferenceById,
	getReferenceSectionById,
	HandbookSectionNotFoundError,
	HandbookValidationError,
	listAllSectionsForReference,
	listChapterSections,
	listFiguresForSection,
	listHandbookChapters,
	listReadStatesForReference,
	listReferences,
	markAsReread,
	ReferenceNotFoundError,
	recordHeartbeat,
	resolveCitationUrl,
	StaleWarningsTriageError,
	setComprehended,
	setNotes,
	setReadStatus,
} from './references';
// Regulations BC aggregator (one entry point for /library/regulations/* loaders).
export type {
	RegulationsBucketCard,
	RegulationsChapterDetail,
	RegulationsCitingNode,
	RegulationsDetailView,
	RegulationsFigureTile,
	RegulationsGroupCard,
	RegulationsGroupView,
	RegulationsLandingView,
	RegulationsReadState,
	RegulationsReferenceSummary,
	RegulationsSectionDetail,
	RegulationsSectionListView,
	RegulationsSectionRow,
	RegulationsSiblingRow,
	RegulationsUmbrellaCard,
	RegulationsView,
	RegulationsViewNotFoundKey,
	RegulationsViewParams,
} from './regulations';
export { getRegulationsView, RegulationsViewNotFoundError, resolveRegulationsSectionId } from './regulations';
export type {
	CardSessionRef,
	ReviewSessionCard,
	ReviewSessionState,
	SavedDeckSummary,
	StartReviewSessionInput,
} from './review-sessions';
export {
	abandonStaleSessions,
	advanceReviewSession,
	findResumableSessionByDeckHash,
	getLatestResumableSession,
	getReviewedCardIdsInSession,
	getSessionsForCard,
	jumpToIndex,
	listSavedDecks,
	ReviewSessionJumpOutOfRangeError,
	ReviewSessionNotActiveError,
	ReviewSessionNotFoundError,
	replaceSessionAtIndex,
	resumeReviewSession,
	shrinkSessionAtIndex,
	startReviewSession,
} from './review-sessions';
export type { SubmitReviewInput } from './reviews';
export { CardNotReviewableError, NoReviewToUndoError, submitReview, undoReview } from './reviews';
export {
	deleteSavedDeck,
	getSavedDeckOverlays,
	normalizeSavedDeckLabel,
	renameSavedDeck,
	SavedDeckLabelTooLongError,
} from './saved-decks';
export type {
	CreateScenarioInput,
	DomainAccuracyStats,
	RepAccuracyStats,
	RepAttemptOutcome,
	RepDashboardStats,
	RepStats,
	ScenarioFilters,
	ScenariosFacetCounts,
	ScenarioWithOptions,
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
	getScenarioOptionCounts,
	getScenarioOptions,
	getScenarios,
	getScenariosCount,
	getScenariosFacetCounts,
	getScenariosForNodeByMethod,
	getScenarioWithOptions,
	InvalidAssessmentMethodError,
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
	CredentialPrereqRow,
	CredentialRow,
	CredentialSyllabusRow,
	GoalNodeRow,
	GoalRow,
	GoalSyllabusRow,
	KnowledgeEdgeRow,
	KnowledgeNodeProgressRow,
	KnowledgeNodeRow,
	MemoryReviewSessionRow,
	NewCardFeedbackRow,
	NewCardRow,
	NewCardSnoozeRow,
	NewCardStateRow,
	NewCredentialPrereqRow,
	NewCredentialRow,
	NewCredentialSyllabusRow,
	NewGoalNodeRow,
	NewGoalRow,
	NewGoalSyllabusRow,
	NewKnowledgeEdgeRow,
	NewKnowledgeNodeProgressRow,
	NewKnowledgeNodeRow,
	NewMemoryReviewSessionRow,
	NewReferenceFigureRow,
	NewReferenceRow,
	NewReferenceSectionReadStateRow,
	NewReferenceSectionRow,
	NewReviewRow,
	NewSavedDeckRow,
	NewScenarioOptionRow,
	NewScenarioRow,
	NewSessionItemResultRow,
	NewSessionRow,
	NewStudyPlanRow,
	NewSyllabusNodeLinkRow,
	NewSyllabusNodeRow,
	NewSyllabusRow,
	ReferenceFigureRow,
	ReferenceRow,
	ReferenceSectionReadStateRow,
	ReferenceSectionRow,
	ReviewRow,
	ReviewSessionDeckSpec,
	SavedDeckRow,
	ScenarioOption,
	ScenarioOptionRow,
	ScenarioRow,
	SessionItem,
	SessionItemResultRow,
	SessionRow,
	StudyPlanRow,
	SyllabusNodeLinkRow,
	SyllabusNodeRow,
	SyllabusRow,
	UserPrefRow,
} from './schema';
export {
	card,
	cardFeedback,
	cardSnooze,
	cardState,
	credential,
	credentialPrereq,
	credentialSyllabus,
	goal,
	goalNode,
	goalSyllabus,
	knowledgeEdge,
	knowledgeNode,
	knowledgeNodeProgress,
	memoryReviewSession,
	reference,
	referenceFigure,
	referenceSection,
	referenceSectionErrata,
	referenceSectionReadState,
	review,
	savedDeck,
	scenario,
	scenarioOption,
	session,
	sessionItemResult,
	studyPlan,
	studySchema,
	syllabus,
	syllabusNode,
	syllabusNodeLink,
	teachingExercise,
	userPref,
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
	buildSlotUpdateSet,
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
	ReviewNotFoundError,
	recordItemResult,
	SessionNotFoundError,
	SessionSlotNotFoundError,
	skipSessionSlot,
	startSession,
} from './sessions';
export type { SimScenarioNodeMappings } from './sim-bias';
export { aggregateSimNodePressure, simWeaknessByNode } from './sim-bias';
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
export type {
	ListSyllabiOptions,
	SyllabusAreaView,
	SyllabusLeafWithSyllabus,
	SyllabusTreeNode,
	SyllabusTreeValidationInput,
} from './syllabi';
// Syllabus writers (`upsertSyllabus`, `upsertSyllabusNode`,
// `replaceSyllabusNodeLinks`) and the seed-time leaf validator
// (`validateAirbossRefForLeaf`) are build-only -- exported from
// `@ab/bc-study/build`. The pure tree validator (`validateSyllabusTree`)
// stays here because it's reusable from feature code.
export {
	AirbossRefValidationError,
	buildSyllabusTreeFromRows,
	getCitationsForSyllabusNode,
	getCitationsForSyllabusNodes,
	getKnowledgeNodesForSyllabusLeaf,
	getKnowledgeNodesForSyllabusLeaves,
	getSyllabusArea,
	getSyllabusById,
	getSyllabusBySlug,
	getSyllabusLeaves,
	getSyllabusLeavesForKnowledgeNode,
	getSyllabusTree,
	levelIsLeafEligible,
	listSyllabi,
	SyllabusNotFoundError,
	SyllabusValidationError,
	validateSyllabusTree,
} from './syllabi';
export type {
	CreateTeachingExerciseInput,
	NewTeachingExerciseInput,
	TeachingExerciseFilters,
	TeachingExerciseRow,
	UpdateTeachingExerciseInput,
} from './teaching-exercises';
export {
	createTeachingExercise,
	deleteTeachingExercise,
	getTeachingExercise,
	getTeachingExercises,
	getTeachingExercisesForNode,
	TeachingExerciseNotEditableError,
	TeachingExerciseNotFoundError,
	updateTeachingExercise,
} from './teaching-exercises';
export type { UserPrefValue } from './user-prefs';
export {
	getUserPrefs,
	InvalidUserPrefValueError,
	isUserPrefKey,
	setUserPref,
	UnknownUserPrefKeyError,
	USER_PREF_SCHEMAS,
} from './user-prefs';
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
