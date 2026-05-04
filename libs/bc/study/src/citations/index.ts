// Citations -- polymorphic content-to-reference connections.
// Folded into bc-study because content_citations lives in the study Postgres
// schema and the ownership predicates target study tables. See work package
// docs/work-packages/bc-citations-coupling/.

export {
	AUDIT_FINDING_KINDS,
	type AuditFinding,
	type AuditFindingKind,
	type AuditReport,
	auditCitations,
	type CorpusCoverage,
	type TargetTypeTally,
} from './audit';
export {
	CitationNotFoundError,
	CitationNotOwnedError,
	CitationSourceNotFoundError,
	CitationTargetNotFoundError,
	CitationValidationError,
	type CitationWithSource,
	type CitationWithTarget,
	type CreateCitationInput,
	createCitation,
	DuplicateCitationError,
	deleteCitation,
	getCitationsOf,
	getCitedBy,
	resolveCitationSources,
	resolveCitationTargets,
} from './citations';
export { type ContentCitationRow, contentCitation, type NewContentCitationRow } from './schema';
export {
	formatSectionLabel,
	type KnowledgeNodeSearchResult,
	type SectionSearchResult,
	searchKnowledgeNodes,
	searchReferenceSections,
} from './search';
