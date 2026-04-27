// Re-export CitationFraming from constants so consumers can import the
// citation primitive and its framing affordance from `@ab/types` together.
export type { CitationFraming } from '@ab/constants';
export type { ActionFailure, FieldErrors } from './actions';
export {
	type Citation,
	isHandbookCitation,
	isStructuredCitation,
	type LegacyCitation,
	type StructuredCitation,
	type StructuredCitationCommon,
} from './citation';
