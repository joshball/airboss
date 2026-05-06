// Study BC -- runtime / client-safe barrel.
//
// This barrel is reachable from `.svelte` files and any client-bundled
// SvelteKit module. Every value re-export here MUST resolve to a module
// that does NOT statically import `@ab/db/connection` (which loads the
// `postgres` driver and crashes browser hydration with `ReferenceError:
// Buffer is not defined`).
//
// Server-only value exports (everything that touches the database) live
// in `./server.ts`, exposed at `@ab/bc-study/server`. We still re-export
// the *types* of those server-only modules from this file: TypeScript
// erases type re-exports at compile time, so existing
// `import type { Foo } from '@ab/bc-study'` lines in `.svelte` files
// keep working without dragging postgres into the browser.
//
// Build-only helpers (seeders' upserts, manifest validators, citation
// audit, citation ingestion schemas) live in `./build.ts` -- a separate
// barrel because they bypass per-user actor scoping. See chunk-2 security
// MAJOR finding in `docs/work/reviews/2026-05-01-study-bc-domain-security.md`.

// ----------------------------------------------------------------------
// Browser-safe value exports (no DB connection import in their module)
// ----------------------------------------------------------------------

// Goal-CRUD Zod schemas + their inferred input types. The BC `goals.ts`
// write helpers parse against these inside their function bodies as a
// defense-in-depth layer on top of the route-level coercion.
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
// Pure deck-spec encoding/decoding -- used by `.svelte` pages directly.
export {
	canonicalDeckSpecJson,
	computeDeckHash,
	DeckSpecDecodeError,
	decodeDeckSpec,
	encodeDeckSpec,
	normalizeDeckSpec,
	summarizeDeckSpec,
} from './deck-spec';
// Pure session-engine entry point (callbacks abstract every DB read).
export { runEngine } from './engine';
// Cross-file error classes (shared by 2+ modules in the BC).
export { SourceRefRequiredError, UpsertReturnedNoRowError } from './errors';
// Display formatters (`.svelte` pages render review intervals via these).
export { formatNextInterval, formatNextIntervalAbsolute } from './formatters';
// Lens projection types only -- the value implementations
// (`acsLens`, `domainLens`, `computeMasteryRollup`, `LensError`) live in
// `./lenses`, which transitively imports `./mastery` -> `@ab/db/connection`
// -> postgres driver -> `Buffer.allocUnsafe` (Node-only). Importing the
// values from this client-safe barrel pulls postgres into the browser
// bundle and crashes hydration with `ReferenceError: Buffer is not
// defined`. Server callers import the values from `@ab/bc-study/server`.
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
// Drizzle table objects + row types. Drizzle's `pg-core` is browser-safe
// (it's a SQL builder; the postgres driver lives in `@ab/db/connection`).
// Table objects are exported here so cross-BC code, scripts, and SSR can
// reference them without dragging postgres into the client bundle.
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
// FSRS scheduler -- pure math.
export type { CardSchedulerState, ScheduleResult } from './srs';
export { fsrsDefaultParams, fsrsInitialState, fsrsPreviewAll, fsrsSchedule } from './srs';
// Pure Zod schemas for card / scenario / review submission shapes.
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

// ----------------------------------------------------------------------
// Type-only re-exports of server-only modules
//
// These are `export type` only -- they erase at compile time, so a
// `.svelte` file that does `import type { CalibrationBucket } from
// '@ab/bc-study'` does not pull `calibration.ts` (and its `@ab/db/connection`
// import) into the browser bundle. Every value export from these modules
// lives in `./server.ts` (`@ab/bc-study/server`).
// ----------------------------------------------------------------------

export type {
	CalibrationBucket,
	CalibrationPageData,
	CalibrationResult,
	CalibrationTrendPoint,
	DomainCalibration,
} from './calibration';
export type {
	CardCrossReferences,
	CardCrossRefsPlans,
	CardCrossRefsReps,
	CardCrossRefsScenarios,
} from './card-cross-references';
export type {
	CardFilters,
	CardsFacetCounts,
	CardWithState,
	CreateCardInput,
	RemovedCardRow,
	RemovedCardsFilters,
	UpdateCardInput,
} from './cards';
export type { PublicCard, PublicCardCitation } from './cards-public';
export type {
	CitationWithSource,
	CitationWithTarget,
	ContentCitationRow,
	CorpusCoverage,
	CreateCitationInput,
	KnowledgeNodeSearchResult,
	NewContentCitationRow,
	SectionSearchResult,
	TargetTypeTally,
} from './citations';
export type {
	AreaMasteryRollup,
	CredentialDagSnapshot,
	CredentialMasteryRollup,
	ListCredentialsOptions,
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
export type { EngineTargeting, EngineTargetingSnapshot } from './engine-targeting';
export type { SubmitFeedbackInput } from './feedback';
export type { ApplyCertGoalsResult, CreateGoalParams, ListGoalsOptions as ListGoalsOpts } from './goals';
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
export type { CarryoverGroup, CertReferenceBundle } from './library-by-cert';
export type { GateState, LeafMasteryState, NodeEvidenceState } from './mastery';
export type { CreatePlanInput, UpdatePlanInput } from './plans';
export type {
	ErrataDisplay,
	ErrataInsert,
	ReferenceSectionErrataRow,
} from './reference-errata';
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
	RegulationsUmbrellaCard,
	RegulationsView,
	RegulationsViewNotFoundKey,
	RegulationsViewParams,
} from './regulations';
export type {
	CardSessionRef,
	ReviewSessionCard,
	ReviewSessionState,
	SavedDeckSummary,
	StartReviewSessionInput,
} from './review-sessions';
export type { SubmitReviewInput } from './reviews';
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
export type {
	ItemResultInput,
	PreviewOptions,
	SessionPreview,
	SessionSuggestedAction,
	SessionSummary,
	SessionSummarySliceRow,
	SkipSessionSlotInput,
} from './sessions';
export type { SimScenarioNodeMappings } from './sim-bias';
export type { RemoveCardInput, ReplacementCardResult, RestoreCardInput, SnoozeCardInput } from './snooze';
export type {
	DashboardStats,
	DomainStats,
	MasteryStats,
	RecentAttemptRow,
	RecentReviewRow,
	ReviewStats,
} from './stats';
export type {
	ListSyllabiOptions,
	SyllabusAreaView,
	SyllabusLeafWithSyllabus,
	SyllabusTreeNode,
	SyllabusTreeValidationInput,
} from './syllabi';
export type {
	CreateTeachingExerciseInput,
	NewTeachingExerciseInput,
	TeachingExerciseFilters,
	TeachingExerciseRow,
	UpdateTeachingExerciseInput,
} from './teaching-exercises';
export type { PageExplainerDismissals, UserPrefValue } from './user-prefs';
