// Hangar BC -- registry CRUD, job pipelines, source ingest, users directory.
// Owns the `hangar.*` schema and every Drizzle query that touches it.

export {
	countAllJobs,
	countLiveReferences,
	countLiveSources,
	listLiveSources,
} from './dashboard-queries';
export type { FetchHtmlFn } from './edition-stub';
export { makeStubFetchHtml, withEditionStub } from './edition-stub';
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
	citationSchema,
	displayNameSchema,
	keywordsSchema,
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
export { hangarJobHandlers } from './jobs';
export {
	getActiveJobForTarget,
	getLatestCompleteJobByKind,
	getLatestCompleteJobForTarget,
	listRecentJobsForTarget,
	listRunningJobs,
} from './jobs-queries';
export {
	formDataToInitial,
	parseCitations,
	type ReferenceValidationFailure,
	type ValidatedReference,
	validateReferenceForm,
} from './reference-form';
export { EMPTY_REFERENCE_INITIAL, type ReferenceFormInitial } from './reference-form-types';
export {
	createReference,
	createSource,
	getReference,
	getReferenceSummary,
	getSource,
	type ListReferencesOptions,
	type ListReferencesResult,
	type ListSourcesOptions,
	type ListSourcesResult,
	listReferences,
	listSources,
	NotFoundError,
	type ReferenceInput,
	type ReferenceSummaryRow,
	type ReferenceTagsInput,
	RevConflictError,
	referenceDescSortByUpdated,
	type SourceCitationInput,
	type SourceInput,
	softDeleteReference,
	softDeleteSource,
	sourceDescSortByUpdated,
	updateReference,
	updateSource,
} from './registry';
export {
	type HangarJobLogRow,
	type HangarJobRow,
	type HangarReferenceRow,
	type HangarSourceEdition,
	type HangarSourceMedia,
	type HangarSourceRow,
	type HangarSyncLogRow,
	hangarJob,
	hangarJobLog,
	hangarReference,
	hangarSchema,
	hangarSource,
	hangarSyncLog,
	type NewHangarJobLogRow,
	type NewHangarJobRow,
	type NewHangarReferenceRow,
	type NewHangarSourceRow,
	type NewHangarSyncLogRow,
} from './schema';
export {
	type ArchiveEntry,
	type ArchiveReaderFn,
	type BinaryVisualFetchOptions,
	type DbUpdaterFn,
	type DownloaderFn,
	formatEditionDiff,
	handleBinaryVisualFetch,
	type LocatorShape,
	type ResolverFn,
	runSectionalFetch,
	SECTIONAL_CADENCE_DAYS,
	type SectionalFetchHooks,
	type SectionalFetchInput,
	type SectionalFetchOutcome,
	type ThumbnailFn,
} from './source-fetch';
export {
	type SourceValidationFailure,
	sourceFormDataToInitial,
	type ValidatedSource,
	validateSourceForm,
} from './source-form';
export { EMPTY_SOURCE_INITIAL, type SourceFormInitial } from './source-form-types';
export {
	type FetchHandlerOptions,
	makeBuildHandler,
	makeDiffHandler,
	makeExtractHandler,
	makeFetchHandler,
	makeSizeReportHandler,
	makeUploadHandler,
	makeValidateHandler,
	nodeSpawnRunner,
	REPO_ROOT,
	type SourceJobOptions,
	type SpawnResult,
	type SpawnRunner,
	type TargetedSourcePayload,
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
	buildUserSearchWhere,
	countUsersByRole,
	getUser,
	type ListUsersOptions,
	listRecentUserAudits,
	listRecentUserSessions,
	listUsers,
	narrowRole,
	USER_DETAIL_AUDIT_LIMIT,
	USER_DETAIL_SESSION_LIMIT,
	USERS_LIST_LIMIT,
	type UserAuditRow,
	type UserDirectoryRow,
	type UserSessionRow,
} from './users';
