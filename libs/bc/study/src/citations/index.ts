// Citations -- polymorphic content-to-reference connections.
// Folded into bc-study because content_citations lives in the study Postgres
// schema and the ownership predicates target study tables. See work package
// docs/work-packages/bc-citations-coupling/.

export {
	CitationNotFoundError,
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
export { type RegulationSearchResult, searchAcReferences, searchKnowledgeNodes, searchRegulationNodes } from './search';
