// Hangar BC -- server-only barrel.
//
// Every value export in this file resolves to a module that statically
// imports `@ab/db/connection` (the postgres driver) OR a Node built-in
// (`node:fs`, `node:path`, `node:crypto`, `node:child_process`). Re-exporting
// these from the runtime barrel (`./index.ts`) drags `postgres` and the
// node:* graph into the browser bundle via Vite's deps optimizer, which
// crashes hydration -- the same failure mode that hit `apps/study /memory`
// (PRs #656, #659, #661, #663, #664) and the `hangar-review-queue` e2e
// cluster on 2026-05-08.
//
// Consumers: `+page.server.ts`, `+layout.server.ts`, `+server.ts`,
// `apps/hangar/src/lib/server/**`, `scripts/**`, `tools/**`, server-side
// tests. Import as `from '@ab/bc-hangar/server'`.
//
// `./index.ts` keeps browser-safe value exports (schema row types + table
// objects + types, pure helpers from `./review-pure`, form schemas + parsers
// that don't touch the DB, sentinels) and `type`-only re-exports of every
// server-only module so existing `import type { Foo } from '@ab/bc-hangar'`
// lines in `.svelte` files keep working. TypeScript erases the type
// re-exports at compile time, so they never reach the browser bundle.
//
// Server consumers get the union: this file re-exports everything from
// `./index` so a single `from '@ab/bc-hangar/server'` import covers both
// pure helpers + DB-touching helpers without needing two import lines per
// `+page.server.ts`.

export * from './index';

export {
	type ActorSearchHit,
	AUDIT_ACTOR_SYSTEM,
	type AuditEntriesPage,
	type AuditEntryDetail,
	type AuditEntryRow,
	type AuditFilters,
	buildAuditWhere,
	clampAuditLimit,
	type DecodedAuditCursor,
	decodeAuditCursor,
	encodeAuditCursor,
	getActorById,
	getAuditEntry,
	isLikelyAuthId,
	listAuditEntries,
	resolveActorForChip,
	searchActorIds,
} from './audit-queries';
export { HANGAR_BLOB_DIR, resolveHangarBlobRoot } from './blob-root';
export {
	countAllJobs,
	countLiveReferences,
	countLiveSources,
	countVerbatimReferences,
	listLiveSources,
} from './dashboard-queries';
export { countDocsIndex, readIndexedDoc, searchDocs } from './docs-search';
export { bustDocsTreeCache, isDocsPathAllowed, listDocsTree } from './docs-tree';
export type { FetchHtmlFn } from './edition-stub';
export { makeStubFetchHtml, withEditionStub } from './edition-stub';
export {
	type AcceptInvitationInput,
	type AcceptInvitationResult,
	acceptInvitation,
	type CreateInvitationInput,
	type CreateInvitationResult,
	createInvitation,
	deriveInvitationStatus,
	EmailAlreadyExistsError,
	generateInvitationToken,
	getInvitation,
	getInvitationByToken,
	INVITATION_DETAIL_AUDIT_LIMIT,
	INVITATION_STATUS,
	INVITATION_STATUS_VALUES,
	INVITATIONS_LIST_LIMIT,
	type InvitationEmailContent,
	type InvitationEmailContext,
	type InvitationEmailRenderer,
	type InvitationEmailSender,
	InvitationEmailSendFailedError,
	type InvitationListRow,
	InvitationRoleForbiddenError,
	InvitationStateError,
	type InvitationStatus,
	type InvitationStatusFilter,
	type ListInvitationsOptions,
	type ListInvitationsResult,
	listInvitations,
	listInvitationsBySender,
	type PasswordHasher,
	PendingInvitationExistsError,
	type ResendInvitationInput,
	type ResendInvitationResult,
	type RevokeInvitationInput,
	type RevokeInvitationResult,
	resendInvitation,
	revokeInvitation,
} from './invitations';
export {
	getActiveJobForTarget,
	getLatestCompleteJobByKind,
	getLatestCompleteJobForTarget,
	listRecentJobsForTarget,
	listRunningJobs,
} from './jobs-queries';
export {
	createReference,
	createSource,
	getReference,
	getSource,
	type ListReferencesOptions,
	type ListReferencesResult,
	type ListSourcesOptions,
	type ListSourcesResult,
	listReferences,
	listSources,
	NotFoundError,
	type ReferenceInput,
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
	type CreateBucketInput,
	type CreateTaskInput,
	countItemsByCriteria,
	countReviewQueueOpen,
	createBucket,
	createColumn,
	createTask,
	deleteBucket,
	deleteTask,
	findItemByRef,
	finishSession,
	getBoard,
	getBucket,
	getItem,
	getOpenSession,
	getOrCreateBoard,
	getTask,
	type ListItemsFilters,
	listBuckets,
	listColumns,
	listItems,
	listItemsWithPassingSession,
	listKinds,
	listSessions,
	listSteps,
	listTasks,
	pinItemToColumn,
	type RecordStepInput,
	recordStep,
	type SessionSummary,
	seedDefaultBuckets,
	seedDefaultColumns,
	seedReviewKinds,
	softDeleteItem,
	startSession,
	type UpdateTaskInput,
	type UpsertItemInput,
	updateBucket,
	updateTask,
	upsertItem,
	type WalkerSummary,
} from './review';
export {
	type DiscoveredItem,
	type DiscoveryError,
	type DiscoveryResult,
	discoverAllItems,
} from './review-discovery';
export { readFrontmatter, writeFrontmatterField, writeFrontmatterFields } from './review-frontmatter';
export { getLastLoaderRun, type LastLoaderRun, type LoaderResult, loadReviewItems } from './review-loader';
export { parseTestPlan, type TestPlanStep } from './review-test-plan';
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
	type FetchHandlerOptions,
	makeBuildHandler,
	makeDiffHandler,
	makeExtractHandler,
	makeFetchHandler,
	makeUploadHandler,
	makeValidateHandler,
	nodeSpawnRunner,
	REGISTRY_TARGET_ID,
	REPO_ROOT,
	type SourceJobOptions,
	type SpawnResult,
	type SpawnRunner,
	type TargetedSourcePayload,
} from './source-jobs';
export {
	getSeedSource,
	getSeedSourcesByType,
	isSeedSourceDownloaded,
	PENDING_DOWNLOAD,
	SOURCES as SEED_SOURCES,
} from './source-seed-registry';
export type { UploadHandlerOptions, UploadJobPayload } from './upload-handler';
export {
	type AdminAuthApi,
	type AdminAuthBundle,
	assertNotLastAdmin,
	assertSelfTargetAllowed,
	type BanUserActionInput,
	BetterAuthApiError,
	banUserAction,
	expiresAtToBanExpiresIn,
	LastAdminError,
	type RevokeAllUserSessionsInput,
	type RevokeUserSessionInput,
	revokeAllUserSessions,
	revokeUserSession,
	SelfTargetForbiddenError,
	type SelfTargetGuardOp,
	type SetUserRoleInput,
	setUserRole,
	type UnbanUserActionInput,
	unbanUserAction,
} from './user-writes';
export {
	buildUserSearchWhere,
	countUserSessions,
	countUsersByRole,
	getUser,
	hasUserSessionWithId,
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
