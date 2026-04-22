import { axisCounts, listReferences, search } from '@ab/aviation';
import { QUERY_PARAMS } from '@ab/constants';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const searchText = url.searchParams.get(QUERY_PARAMS.SEARCH) ?? '';

	const references = searchText.trim() ? search({ text: searchText }) : listReferences();

	return {
		references,
		counts: axisCounts(),
		searchText,
	};
};
