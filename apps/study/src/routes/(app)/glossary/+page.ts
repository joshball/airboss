import { axisCounts, listReferences, type SearchHit, search } from '@ab/aviation';
import { QUERY_PARAMS } from '@ab/constants';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const searchText = url.searchParams.get(QUERY_PARAMS.SEARCH) ?? '';
	const trimmed = searchText.trim();

	const hits: readonly SearchHit[] | null = trimmed ? search({ text: searchText }) : null;
	const references = hits ? hits.map((h) => h.reference) : listReferences();

	return {
		references,
		hits,
		counts: axisCounts(),
		searchText,
	};
};
