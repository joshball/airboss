/**
 * External tools loader. Surfaces the curated list from
 * `libs/aviation/src/external-tools.ts` as `web.tool` rows in the External
 * Tools column. Both tiers (validated + community) appear by default;
 * `kind:web` filter narrows to web tools, `kind:web.validated` to the trusted
 * tier (Phase 2g may add this filter; for now both tiers always render).
 */

import { findExternalTools } from '@ab/aviation';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult } from '../schema/result-types';

export function loadExternalTools(parsed: ParsedQuery, _host: PaletteHost): readonly SearchResult[] {
	void _host;
	const text = parsed.freeText.trim();
	// Empty needle returns [] -- mirrors every other loader. Without this guard,
	// a filter-only query like `mine` would surface all seven external tools
	// at rank 4 (the empty-needle bucket), flooding External Tools with
	// unrelated rows the user did not query for.
	if (text.length === 0) return [];
	const tools = findExternalTools(text);
	const out: SearchResult[] = [];
	for (const tool of tools) {
		const bucket = computeBucket(text, tool.label, tool.keywords, tool.description);
		out.push({
			id: tool.id,
			type: 'web.tool',
			title: tool.label,
			subtitle: tool.tier === 'validated' ? 'Validated · External tool' : 'Community · External tool',
			snippet: tool.description,
			href: tool.url,
			rankBucket: bucket,
			tier: tool.tier,
		});
	}
	return out;
}

function computeBucket(needle: string, label: string, keywords: readonly string[], description: string): RankBucket {
	if (needle.length === 0) return 4;
	const n = needle.toLowerCase();
	if (label.toLowerCase() === n) return 1;
	if (label.toLowerCase().startsWith(n)) return 2;
	if (keywords.some((k) => k === n)) return 2;
	if (keywords.some((k) => k.includes(n))) return 3;
	if (description.toLowerCase().includes(n)) return 4;
	return 5;
}
