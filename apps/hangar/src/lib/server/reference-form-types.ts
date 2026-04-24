/**
 * Plain TS mirror of the `ReferenceFormInitial` shape declared inside
 * `lib/components/ReferenceForm.svelte`. Lives on the server so
 * `+page.server.ts` files can return it without transitively importing
 * a svelte component module.
 */
export interface ReferenceFormInitial {
	id: string;
	displayName: string;
	paraphrase: string;
	aliasesText: string;
	keywordsText: string;
	sourceType: string;
	aviationTopic: readonly string[];
	flightRules: string;
	knowledgeKind: string;
	phaseOfFlight: readonly string[];
	certApplicability: readonly string[];
	relatedText: string;
	citationsJson: string;
	author: string;
	reviewedAt: string;
}

export const EMPTY_REFERENCE_INITIAL: ReferenceFormInitial = {
	id: '',
	displayName: '',
	paraphrase: '',
	aliasesText: '',
	keywordsText: '',
	sourceType: '',
	aviationTopic: [],
	flightRules: '',
	knowledgeKind: '',
	phaseOfFlight: [],
	certApplicability: [],
	relatedText: '',
	citationsJson: '[]',
	author: '',
	reviewedAt: '',
};
