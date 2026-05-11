/**
 * Detect whether a query looks like a partial FAA / CFR / AC / AIM document
 * code. When `detectDocCodeIntent` returns a `DocCodeIntent`, the UI should
 * show a dropdown of matching docs (vscode-style autocomplete) instead of (or
 * above) regular search results.
 *
 * Pattern source: palette design note,
 * `docs/work/plans/2026-05-10-command-palette-design.md#doc-code-autocomplete`.
 */

import { listReferences } from './registry';

export interface DocCodeIntent {
	/** The portion of the input that triggered the detection. */
	readonly fragment: string;
	/** The detected document family ("handbook" / "ac" / "cfr" / "aim" / "acs" / "unknown"). */
	readonly family: DocCodeFamily;
	/** True if the fragment is unambiguously a doc code (vs. could-also-be-search). */
	readonly confident: boolean;
}

export type DocCodeFamily = 'handbook' | 'ac' | 'cfr' | 'aim' | 'acs' | 'unknown';

const HANDBOOK_ABBREVS = new Set([
	'avwx',
	'phak',
	'afh',
	'ifh',
	'iph',
	'rmh',
	'aih',
	'iah',
	'hfh',
	'gfh',
	'bfh',
	'amt',
]);

interface TriggerRule {
	pattern: RegExp;
	family: DocCodeFamily;
	confident: boolean;
}

const TRIGGERS: readonly TriggerRule[] = [
	{ pattern: /^faa-h-/i, family: 'handbook', confident: true },
	{ pattern: /^faa-s-/i, family: 'acs', confident: true },
	{ pattern: /^faa-p-/i, family: 'handbook', confident: true },
	{ pattern: /^ac\s|^ac-/i, family: 'ac', confident: true },
	{ pattern: /^14[\s-]?cfr/i, family: 'cfr', confident: true },
	{ pattern: /^49[\s-]?cfr/i, family: 'cfr', confident: true },
	{ pattern: /^part\s+\d/i, family: 'cfr', confident: true },
	{ pattern: /^§\s*\d/i, family: 'cfr', confident: true },
	{ pattern: /^aim\s?\d/i, family: 'aim', confident: true },
	{ pattern: /^acs\s/i, family: 'acs', confident: true },
	{ pattern: /^pts\s/i, family: 'acs', confident: true },
	// Bare numeric fragments that look like FAA doc numbers (3+ digits).
	{ pattern: /^\d{3,5}(-\d{1,4})?$/, family: 'unknown', confident: false },
	{ pattern: /^\d{2}-\d{1,4}[a-z]?$/i, family: 'ac', confident: false },
];

/**
 * Check whether a query string looks like a partial doc code. Returns null
 * if no trigger matched.
 */
export function detectDocCodeIntent(query: string): DocCodeIntent | null {
	const trimmed = query.trim();
	if (!trimmed) return null;

	for (const rule of TRIGGERS) {
		if (rule.pattern.test(trimmed)) {
			return { fragment: trimmed, family: rule.family, confident: rule.confident };
		}
	}

	// Known handbook abbrev (PHAK, AvWX, IFH, ...) -- treat as confident.
	const lower = trimmed.toLowerCase();
	if (HANDBOOK_ABBREVS.has(lower)) {
		return { fragment: trimmed, family: 'handbook', confident: true };
	}

	return null;
}

/**
 * Find FAA doc references whose code matches the given fragment. Results
 * sorted with numeric prefix awareness so `808` orders 8083-2 → 8083-3 →
 * 8083-9 → 8083-15 → 8083-25 (numeric, not alpha-string).
 */
export function lookupDocsByCode(
	fragment: string,
	options?: { family?: DocCodeFamily; limit?: number },
): readonly {
	id: string;
	displayName: string;
	code: string;
	abbreviation: string | null;
}[] {
	const lower = fragment.toLowerCase();
	const stripped = lower.replace(/[^a-z0-9]/g, '');
	const family = options?.family;
	const limit = options?.limit ?? 12;
	const HANDBOOK_ABBR_BY_CODE: Record<string, string> = {
		'FAA-H-8083-25C': 'PHAK',
		'FAA-H-8083-3C': 'AFH',
		'FAA-H-8083-15B': 'IFH',
		'FAA-H-8083-16B': 'IPH',
		'FAA-H-8083-28B': 'AvWX',
		'FAA-H-8083-2A': 'RMH',
		'FAA-H-8083-9': 'AIH',
	};

	const matches: { id: string; displayName: string; code: string; abbreviation: string | null; sortKey: number[] }[] =
		[];
	for (const ref of listReferences()) {
		if (!ref.id.startsWith('doc-')) continue;
		if (family && family !== 'unknown') {
			if (family === 'handbook' && !ref.id.startsWith('doc-faah') && !ref.id.startsWith('doc-mtn')) continue;
			if (family === 'ac' && !ref.id.startsWith('doc-ac-')) continue;
			if (family === 'cfr' && !ref.id.startsWith('doc-cfr-')) continue;
			if (
				family === 'acs' &&
				!ref.id.startsWith('doc-ppl') &&
				!ref.id.startsWith('doc-cpl') &&
				!ref.id.startsWith('doc-ir') &&
				!ref.id.startsWith('doc-cfi') &&
				!ref.id.startsWith('doc-atp')
			)
				continue;
			if (family === 'aim') continue; // AIM not yet in the registry
		}

		const codeAlias = ref.aliases.find((a) => /^FAA-[HSP]-|^AC\s|^\d+\s?CFR|^Part\s/.test(a)) ?? ref.aliases[0] ?? '';
		const codeStripped = codeAlias.toLowerCase().replace(/[^a-z0-9]/g, '');
		const aliasMatch = ref.aliases.some((a) => {
			const s = a.toLowerCase().replace(/[^a-z0-9]/g, '');
			return s.includes(stripped);
		});
		const keywordMatch = ref.tags.keywords?.some((k) => k.includes(stripped)) ?? false;
		if (!aliasMatch && !keywordMatch && !codeStripped.includes(stripped)) continue;

		// Numeric sort key: split the code by - or space, take numeric parts.
		const numeric = codeAlias
			.split(/[-\s]+/)
			.map((p) => parseInt(p, 10))
			.filter((n) => Number.isFinite(n));

		matches.push({
			id: ref.id,
			displayName: ref.displayName,
			code: codeAlias,
			abbreviation: HANDBOOK_ABBR_BY_CODE[codeAlias] ?? null,
			sortKey: numeric,
		});
	}

	matches.sort((a, b) => {
		for (let i = 0; i < Math.max(a.sortKey.length, b.sortKey.length); i++) {
			const av = a.sortKey[i] ?? -1;
			const bv = b.sortKey[i] ?? -1;
			if (av !== bv) return av - bv;
		}
		return a.code.localeCompare(b.code);
	});

	return matches.slice(0, limit).map(({ sortKey: _sortKey, ...rest }) => rest);
}
