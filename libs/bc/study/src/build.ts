/**
 * Study BC -- build-only barrel.
 *
 * Re-exports BC helpers that bypass per-user actor scoping: schema upserts,
 * shared-row mutators, manifest validators, seed-time validators, citation
 * audit (cross-user read of every citation row), and the ingestion-time
 * citation schemas. These paths are safe for `scripts/db/seed-*.ts`,
 * `scripts/sources/*.ts`, and other build / admin tooling to call but must
 * NEVER be reachable from a route loader / form action -- a future route
 * that imported `@ab/bc-study` could otherwise call `upsertKnowledgeNode`
 * (etc.) and rewrite shared content for every user.
 *
 * Closes the chunk-2 security MAJOR finding in
 * `docs/work/reviews/2026-05-01-study-bc-domain-security.md`. The runtime
 * barrel (`./index.ts`) deliberately omits everything this file re-exports.
 *
 * Consumers: `scripts/db/seed-*.ts`, `scripts/sources/*.ts`, and any other
 * build / admin tooling. Import as `from '@ab/bc-study/build'`.
 */

// Citation audit -- cross-user read of every citation row, for the
// `scripts/sources/audit-citations.ts` admin/CLI tool. Not actor-scoped.
export {
	AUDIT_FINDING_KINDS,
	type AuditFinding,
	type AuditFindingKind,
	type AuditReport,
	auditCitations,
} from './citations';
// Credential writers + DAG validator (seed-time only -- credentials are shared
// course content, not per-user data).
export {
	upsertCredential,
	upsertCredentialPrereq,
	upsertCredentialSyllabus,
	validateCredentialDag,
} from './credentials';
// Knowledge-graph writers (rewrite shared knowledge_node / knowledge_edge rows).
export {
	refreshEdgeTargetExists,
	replaceNodeEdges,
	upsertKnowledgeNode,
} from './knowledge';
// Manifest schemas + types -- consumed exclusively by seeders. Read-state
// runtime input schemas (handbookHeartbeatInputSchema, handbookNotesInputSchema,
// handbookReadStatusSchema) stay in the runtime barrel because route handlers
// parse `+server.ts` request bodies against them.
export {
	type AcManifest,
	type AcsManifest,
	type AcsManifestArea,
	type AcsManifestElement,
	type AcsManifestTask,
	type AimManifest,
	type AimManifestEntry,
	acManifestSchema,
	acsManifestAreaSchema,
	acsManifestElementSchema,
	acsManifestSchema,
	acsManifestTaskSchema,
	aimManifestEntrySchema,
	aimManifestSchema,
	type BulletinManifestSection,
	bulletinManifestSectionSchema,
	type CfrManifest,
	type CfrManifestSource,
	type CfrSectionEntry,
	type CfrSectionsFile,
	cfrManifestSchema,
	cfrManifestSourceSchema,
	cfrSectionEntrySchema,
	cfrSectionsFileSchema,
	citationSchema,
	HANDBOOK_MANIFEST_WARNING_CODES,
	HANDBOOK_WARNING_TRIAGE_STATUS_VALUES,
	type HandbookManifestErrataEntry,
	type HandbookManifestErrataSectionPatched,
	type HandbookManifestExtraction,
	type HandbookManifestFigure,
	type HandbookManifestSection,
	type HandbookManifestWarning,
	type HandbookManifestWarningCode,
	type HandbookSectionFrontmatter,
	type HandbookWarningsFile,
	type HandbookWarningsFileEntry,
	type HandbookWarningsTriageFile,
	type HandbookWarningTriageEntry,
	type HandbookWarningTriageStatus,
	handbookManifestErrataEntrySchema,
	handbookManifestErrataSectionPatchedSchema,
	handbookManifestExtractionSchema,
	handbookManifestFigureSchema,
	handbookManifestSectionSchema,
	handbookManifestWarningSchema,
	handbookSectionFrontmatterSchema,
	handbookWarningsFileEntrySchema,
	handbookWarningsFileSchema,
	handbookWarningsTriageFileSchema,
	handbookWarningTriageEntrySchema,
	type InfoManifest,
	infoManifestSchema,
	legacyCitationSchema,
	type Manifest,
	manifestSchema,
	type SafoManifest,
	type SectionTreeManifest,
	safoManifestSchema,
	sectionTreeManifestSchema,
	structuredCitationSchema,
	type WholeDocManifest,
	WP_FIXABLE_WARNING_CODES,
	wholeDocManifestSchema,
} from './manifest-validation';
export type {
	FigureInput,
	UpsertReferenceInput,
	UpsertReferenceSectionInput,
} from './references';
// Reference + handbook section writers (seed-references-from-manifest path).
// These were already not in the runtime barrel; surfacing them here gives
// seed scripts a single import surface and preserves the no-runtime-access
// invariant.
export {
	attachSupersededByLatest,
	replaceFiguresForSection,
	upsertReference,
	upsertReferenceSection,
} from './references';
// Syllabus writers + the airboss-ref leaf validator used by the syllabi
// seeder. Pure tree validators stay in the runtime barrel because they're
// reusable from feature code.
export {
	replaceSyllabusNodeLinks,
	upsertSyllabus,
	upsertSyllabusNode,
	validateAirbossRefForLeaf,
} from './syllabi';
