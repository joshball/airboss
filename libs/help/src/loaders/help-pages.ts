/**
 * Help-pages loader. Wraps `helpRegistry.search(parsed)` and translates the
 * help-registry's internal `SearchResult` shape into a typed `SearchResult`
 * tagged with `airboss.help` so the palette routes it into the App Help
 * column.
 */

import { ROUTES } from '@ab/constants';
import { helpRegistry } from '../registry';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult } from '../schema/result-types';

const LOADER_LIMIT = 30;

export function loadHelpPages(parsed: ParsedQuery, _host: PaletteHost): readonly SearchResult[] {
	void _host;
	if (parsed.freeText.trim().length === 0 && parsed.filters.length === 0) {
		return [];
	}
	const hits = helpRegistry.search(parsed);
	const out: SearchResult[] = [];
	for (const hit of hits.slice(0, LOADER_LIMIT)) {
		out.push({
			id: hit.id,
			type: 'airboss.help',
			title: hit.title,
			subtitle: 'App help',
			snippet: hit.snippet,
			href: ROUTES.HELP_ID(hit.id),
			// HelpRegistry's bucket scale is 1-3; project onto the palette's 1-5
			// scale by collapsing the registry's three buckets into 1, 3, 5.
			rankBucket: helpBucketToPalette(hit.rankBucket),
		});
	}
	return out;
}

function helpBucketToPalette(b: 1 | 2 | 3): RankBucket {
	if (b === 1) return 1;
	if (b === 2) return 3;
	return 5;
}
