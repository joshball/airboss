// Study BC -- server-only barrel.
//
// Every value export in this file resolves to a module that statically
// imports `@ab/db/connection` (the live `postgres` driver). Re-exporting
// these from the runtime barrel (`./index.ts`) drags `postgres` into the
// browser bundle via Vite's deps optimizer, which crashes hydration with
// `ReferenceError: Buffer is not defined` (the postgres driver references
// Node's `Buffer` global at module-eval time).
//
// Consumers: `+page.server.ts`, `+layout.server.ts`, `+server.ts`,
// `apps/*/src/lib/server/**`, `apps/study/src/routes/**/_lib/build-*.ts`,
// `apps/flightbag/src/lib/*.ts` (used only from `+page.server.ts`),
// `scripts/**`, `tools/**`, server-side tests. Import as
// `from '@ab/bc-study/server'`.
//
// `./index.ts` keeps browser-safe value exports (deck-spec / srs / formatters
// / engine / lenses / schema table objects + types / pure validators) and
// `type`-only re-exports of every server-only module so existing
// `import type { Foo } from '@ab/bc-study'` lines in `.svelte` files keep
// working. TypeScript erases the type re-exports at compile time, so they
// never reach the browser bundle.
//
// Build-only helpers (seeders' upserts, manifest validators, citation
// audit, citation ingestion schemas) live in `./build.ts` -- separate
// barrel because they bypass per-user actor scoping. See chunk-2 security
// MAJOR finding in `docs/work/reviews/2026-05-01-study-bc-domain-security.md`.

// Advisories BC aggregator (one entry point for /library/advisories/* loaders).
export type {
	AdvisoriesBucketCard,
	AdvisoriesBulletinCard,
	AdvisoriesDetailView,
	AdvisoriesExternalLink,
	AdvisoriesLandingView,
	AdvisoriesReferenceCopy,
	AdvisoriesView,
	AdvisoriesViewNotFoundKey,
	AdvisoriesViewParams,
} from './advisories';
export { AdvisoriesViewNotFoundError, getAdvisoriesView } from './advisories';
// Annotations BC -- highlights, note-anchors, card-draft-anchors, drafts
// (wp-flightbag-rich-reader).
export type {
	CreateCardDraftInput,
	CreateCardDraftParsed,
	ListAnnotationsOpts,
	ListDraftsOpts,
	UpdateCardDraftInput,
} from './annotations';
export {
	AnnotationNotFoundError,
	CardDraftAlreadyPromotedError,
	CardDraftNotFoundError,
	createCardDraft,
	createCardDraftInputSchema,
	createHighlight,
	deleteAnnotation,
	discardCardDraft,
	getCardDraft,
	listAnnotationsForSection,
	listAnnotationsForUser,
	listHighlightsForSection,
	listOpenCardDrafts,
	markDraftPromoted,
	promoteDraftToCard,
	updateCardDraft,
	updateCardDraftInputSchema,
	updateHighlightColor,
} from './annotations';
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
export type { ListCoursesForReaderOpts, UpsertCourseInput, UpsertCourseStepInput } from './courses';
export {
	deleteCourseRow,
	deleteCourseStep,
	getCourseById,
	getCourseBySlug,
	getCourseGaps,
	getCourseStepByCode,
	getCourseStepsByCourse,
	getCoursesByGoal,
	listAllCourses,
	listCoursesForReader,
	pickOverlaySyllabus,
	upsertCourse,
	upsertCourseStep,
} from './courses';
export type {
	AreaMasteryRollup,
	CredentialDagSnapshot,
	CredentialMasteryRollup,
	ListCredentialsOptions,
} from './credentials';
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
export type { EngineTargeting, EngineTargetingSnapshot } from './engine-targeting';
export {
	emitEngineTargetingTelemetry,
	getEngineTargeting,
	getEngineTargetingSnapshot,
} from './engine-targeting';
export type { SubmitFeedbackInput } from './feedback';
export { FeedbackCommentRequiredError, getLatestFeedback, submitFeedback } from './feedback';
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
// Re-export every value the runtime barrel exposes, so server consumers
// only ever need a single import line. Anything that lives at
// `@ab/bc-study` is also reachable at `@ab/bc-study/server`.
export * from './index';
export type {
	CertAndDomainMatrix,
	CertProgress,
	DomainCertCell,
	DomainCertRow,
	KnowledgeEdgeRowWithTarget,
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
// Lens value implementations -- server-only because their module-level
// `import { ... } from './mastery'` reaches `@ab/db/connection`. Types
// for these live in the runtime barrel via `./index`.
export { acsLens, computeMasteryRollup, domainLens, LensError } from './lenses';
// Course-aware lenses (course-primitive WP, Phases 4 + 5). Server-only
// because the implementation imports `./mastery` (postgres driver). The
// `CourseLensFilters` / `CourseOverlayLensFilters` types are re-exported
// from `./index` (browser-safe).
export { courseLens, courseWithCertOverlayLens } from './lenses-course';
// Library-by-cert spine (ADR 016 / library-by-cert WP wave 3).
export type { CarryoverGroup, CertReferenceBundle } from './library-by-cert';
export {
	getReferenceCountsByCert,
	getReferenceCountsByTopic,
	getReferencesForCertWithCarryover,
	listReferencesByTopic,
} from './library-by-cert';
// Library-card projection -- pure ReferenceRow -> typed-wrapper payload.
// Re-exported from the server barrel for `+page.server.ts` ergonomics
// (one import line for the loader). Implementation has no DB / `node:*`
// dependency so the runtime barrel also re-exports it -- both barrels
// resolve to the same module.
export type {
	CfrPartUrlResolver,
	ExternalLink as LibraryExternalLink,
	LibraryCardPayload,
	LibraryCardVariant,
	LibraryTopicChip,
} from './library-card-projection';
export { projectReferenceToLibraryCard } from './library-card-projection';
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
// Notes BC -- platform-wide note primitive (wp-notes-primitive).
export type {
	CreateNoteInput,
	ListOpts as NotesListOpts,
	NotesListResult,
	NoteTagCount,
	UpdateNoteInput,
} from './notes';
export {
	archiveNote,
	clearFollowUp,
	createNote,
	createNoteInputSchema,
	createNoteWithAnchor,
	deleteNote,
	getNote,
	listDistinctTags,
	listNotesForCourse,
	listNotesForGoal,
	listNotesForKnowledgeNode,
	listNotesForReference,
	listNotesForSection,
	listNotesForSyllabusNode,
	listNotesForUser,
	listOpenFollowUps,
	listTagCloud,
	markFollowUpDone,
	NoFollowUpError,
	NoteNotFoundError,
	restoreNote,
	searchNotes,
	updateNote,
	updateNoteInputSchema,
} from './notes';
export { deriveNoteTitle, encodeNotesCursor } from './notes-display';
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
	ResolvedCitation,
} from './references';
export {
	computeReadingOrder,
	getFlatSection,
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
	listAllSectionRowsForReference,
	listAllSectionsForReference,
	listChapterSections,
	listFiguresForSection,
	listFlatTopLevelSections,
	listHandbookChapters,
	listReadStatesForReference,
	listReferences,
	listSectionsForSubpart,
	listSubpartsForReference,
	markAsReread,
	ReferenceNotFoundError,
	recordHeartbeat,
	resolveCitationsForRender,
	resolveCitationUrl,
	StaleWarningsTriageError,
	setComprehended,
	setReadStatus,
} from './references';
// Regulations BC aggregator (one entry point for /library/regulations/* loaders).
export type {
	RegulationsBucketCard,
	RegulationsChapterDetail,
	RegulationsChapterSummary,
	RegulationsCitingNode,
	RegulationsDetailView,
	RegulationsExternalLink,
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
	RegulationsSubpartGroup,
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
// Testing-standards BC aggregator (one entry point for /library/testing/* loaders).
export type {
	TestingBucketCard,
	TestingDetailView,
	TestingLandingView,
	TestingPublicationCard,
	TestingReferenceSummary,
	TestingView,
	TestingViewParams,
} from './testing';
export { getTestingView, TestingViewNotFoundError } from './testing';
export type {
	NotesSavedSearchesValue,
	PageExplainerDismissals,
	SavedNotesSearch,
	UserPrefValue,
} from './user-prefs';
export {
	getPageExplainerDismissals,
	getUserPrefs,
	InvalidUserPrefValueError,
	isUserPrefKey,
	listSavedSearches,
	NOTES_SAVED_SEARCHES_MAX,
	NotesSavedSearchLimitError,
	removeNotesSearch,
	saveNotesSearch,
	setPageExplainerDismissal,
	setUserPref,
	UnknownUserPrefKeyError,
	USER_PREF_SCHEMAS,
} from './user-prefs';
