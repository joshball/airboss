// Hangar BC -- runtime barrel (browser-safe).
//
// Every value re-export in this file MUST resolve to a module that does NOT
// statically import `@ab/db/connection` or `node:*`. Server-only helpers
// live in `./server.ts`; pure / browser-eligible code lives here.
//
// Type re-exports of server-only modules are safe -- TypeScript erases them
// at compile time so they never reach the browser bundle. Existing callers
// that did `import type { Foo } from '@ab/bc-hangar'` keep working.
//
// Validator: `scripts/check-browser-globals.ts` walks this barrel and fails
// if any value re-export reaches `@ab/db/connection` or `postgres`.

// Audit query types (functions + AUDIT_ACTOR_SYSTEM live in ./server).
export type {
	ActorSearchHit,
	AuditEntriesPage,
	AuditEntryDetail,
	AuditEntryRow,
	AuditFilters,
	DecodedAuditCursor,
} from './audit-queries';
export type { DocsSearchHit } from './docs-search';
export type { DocsTreeDirNode, DocsTreeFileNode, DocsTreeNode } from './docs-tree';
// Pure form helpers + schemas (zod-only).
export {
	type FieldErrors,
	getAll,
	getOptionalString,
	getString,
	parseJsonObject,
	splitCommaList,
	splitNewlineOrComma,
	zodIssuesToFieldErrors,
} from './form-helpers';
export {
	aliasesSchema,
	type BinaryVisualLocatorParsed,
	binaryVisualLocatorSchema,
	citationSchema,
	displayNameSchema,
	keywordsSchema,
	outboundUrlSchema,
	paraphraseSchema,
	type ReferenceInputParsed,
	referenceIdSchema,
	referenceSchema,
	relatedSchema,
	type SourceInputParsed,
	sourceFormatSchema,
	sourceIdSchema,
	sourceSchema,
	tagsSchema,
} from './form-schemas';
export {
	type AcceptInvitationFormInput,
	AcceptInvitationInputSchema,
	type CreateInvitationFormInput,
	CreateInvitationInputSchema,
	INVITABLE_ROLE_VALUES,
	type ResendInvitationFormInput,
	ResendInvitationInputSchema,
	type RevokeInvitationFormInput,
	RevokeInvitationInputSchema,
} from './invitation-schemas';
export {
	INVITATION_DETAIL_AUDIT_LIMIT,
	INVITATION_STATUS,
	INVITATION_STATUS_VALUES,
	INVITATIONS_LIST_LIMIT,
	type InvitationStatus,
	type InvitationStatusFilter,
} from './invitation-status';
export {
	formDataToInitial,
	parseCitations,
	type ReferenceValidationFailure,
	type ValidatedReference,
	validateReferenceForm,
} from './reference-form';
export { EMPTY_REFERENCE_INITIAL, type ReferenceFormInitial } from './reference-form-types';
export type {
	ListReferencesOptions,
	ListReferencesResult,
	ListSourcesOptions,
	ListSourcesResult,
	ReferenceInput,
	ReferenceTagsInput,
	SourceCitationInput,
	SourceInput,
} from './registry';
// Type-only re-exports of server-only modules (erased at compile time).
export type {
	CreateBucketInput,
	CreateTaskInput,
	ListItemsFilters,
	RecordStepInput,
	SessionSummary,
	UpdateTaskInput,
	UpsertItemInput,
	WalkerSummary,
} from './review';
export type { DiscoveredItem, DiscoveryError, DiscoveryResult } from './review-discovery';
export type { LastLoaderRun, LoaderResult } from './review-loader';
// Pure helpers (extracted from `./review.ts` to live without DB imports).
export {
	everyStepPassed,
	filterItemsByCriteria,
	getDerivedColumnName,
	resolveItemColumnId,
	validateBucketFilterCriteria,
} from './review-pure';
export type { TestPlanStep } from './review-test-plan';
export { parseToc, type TocEntry, type TocParseResult } from './review-toc';
// Schema row types + Drizzle table objects (browser-safe -- @ab/db has no
// runtime side-effects; the postgres driver lives in @ab/db/connection).
export {
	type BucketFilterCriteria,
	type CachedFrontmatterFields,
	type HangarBoardColumnRow,
	type HangarBoardRow,
	type HangarBoardTaskRow,
	type HangarDocsSearchIndexRow,
	type HangarInvitationRow,
	type HangarReferenceRow,
	type HangarReviewBucketRow,
	type HangarReviewItemRow,
	type HangarReviewKindRow,
	type HangarReviewSessionRow,
	type HangarReviewStepRow,
	type HangarSourceEdition,
	type HangarSourceMedia,
	type HangarSourceRow,
	type HangarSyncLogRow,
	hangarBoard,
	hangarBoardColumn,
	hangarBoardTask,
	hangarDocsSearchIndex,
	hangarInvitation,
	hangarReference,
	hangarReviewBucket,
	hangarReviewItem,
	hangarReviewKind,
	hangarReviewSession,
	hangarReviewStep,
	hangarSchema,
	hangarSource,
	hangarSyncLog,
	type NewHangarBoardColumnRow,
	type NewHangarBoardRow,
	type NewHangarBoardTaskRow,
	type NewHangarDocsSearchIndexRow,
	type NewHangarInvitationRow,
	type NewHangarReferenceRow,
	type NewHangarReviewBucketRow,
	type NewHangarReviewItemRow,
	type NewHangarReviewKindRow,
	type NewHangarReviewSessionRow,
	type NewHangarReviewStepRow,
	type NewHangarSourceRow,
	type NewHangarSyncLogRow,
} from './schema';
export { assertRevSnapshot, parseRevSnapshot, type RevSnapshot, RevSnapshotSchema } from './schema-types';
export type {
	ArchiveEntry,
	ArchiveReaderFn,
	BinaryVisualFetchOptions,
	DbUpdaterFn,
	DownloaderFn,
	LocatorShape,
	ResolverFn,
	SectionalFetchHooks,
	SectionalFetchInput,
	SectionalFetchOutcome,
	ThumbnailFn,
} from './source-fetch';
export {
	type OutboundUrlValidationFailure,
	type OutboundUrlValidationOk,
	type OutboundUrlValidationResult,
	type SourceValidationFailure,
	sourceFormDataToInitial,
	type ValidatedSource,
	validateSourceForm,
	validateSourceFormUrls,
} from './source-form';
export { EMPTY_SOURCE_INITIAL, type SourceFormInitial } from './source-form-types';
export type {
	FetchHandlerOptions,
	SourceJobOptions,
	SpawnResult,
	SpawnRunner,
	TargetedSourcePayload,
} from './source-jobs';
export type { UploadHandlerOptions, UploadJobPayload } from './upload-handler';
export {
	archiveFilename,
	destFilename,
	extensionOf,
	isNoChange,
	pickArchivesToPrune,
} from './upload-helpers';
export {
	type BanUserFormInput,
	BanUserInputSchema,
	type RevokeAllUserSessionsFormInput,
	RevokeAllUserSessionsInputSchema,
	type RevokeUserSessionFormInput,
	RevokeUserSessionInputSchema,
	type SetUserRoleFormInput,
	SetUserRoleInputSchema,
	type UnbanUserFormInput,
	UnbanUserInputSchema,
} from './user-write-schemas';
export type {
	AdminAuthApi,
	AdminAuthBundle,
	BanUserActionInput,
	RevokeAllUserSessionsInput,
	RevokeUserSessionInput,
	SelfTargetGuardOp,
	SetUserRoleInput,
	UnbanUserActionInput,
} from './user-writes';
export type {
	ListUsersOptions,
	UserAuditRow,
	UserDirectoryRow,
	UserSessionRow,
} from './users';
