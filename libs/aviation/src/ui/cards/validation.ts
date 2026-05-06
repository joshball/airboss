/**
 * Card-completeness validation. One predicate, three call sites:
 *
 *   1. Wrappers (LibraryReferenceCard variants) call `assertCardComplete` at
 *      render. In dev: throws so the missing field is immediately visible.
 *      In prod: returns a list of missing fields the wrapper renders inline
 *      as `[!] missing description` chips so the page still works.
 *
 *   2. Route loaders call `validateCardData` to surface gaps in their
 *      server-side console (and bail in dev).
 *
 *   3. The /dev/cards audit page calls `validateCardData` per fixture and
 *      per real DB row, collects results into a punch-list table.
 *
 * Treat empty string as missing. The DB column for `metadata` defaults to
 * `{}` so a reference that's been seeded but never authored returns `""`
 * for the four card-copy fields, not `null`.
 */

/**
 * Card variants we validate. Matches the wrappers in this directory.
 * `UmbrellaCard` is the fallback for un-wrapped corpora; we keep the
 * required-field set narrow so it doesn't crash for unauthored data.
 */
export type CardVariant =
	| 'CfrTitleCard'
	| 'CfrPartCard'
	| 'CfrSectionCard'
	| 'AimCorpusCard'
	| 'AcCard'
	| 'AcsCard'
	| 'PtsCard'
	| 'SafoCard'
	| 'InfoCard'
	| 'PohCard'
	| 'NtsbCard'
	| 'HandbookCard'
	| 'UmbrellaCard';

/**
 * Minimum field set per variant. A field is "required" when omitting it
 * leaves the card visibly incomplete to a learner -- i.e. the card no
 * longer fulfils its purpose. Optional fields enrich; required fields
 * must exist for the card to ship.
 */
export const REQUIRED_FIELDS_BY_VARIANT: Record<CardVariant, readonly string[]> = {
	// CFR variants demand a canonical eCFR `external` URL -- learners must be
	// able to jump from any CFR card to its publisher source. The URL builder
	// (libs/sources/src/regs/nav-tree.ts) guarantees a non-null URL for every
	// title/part/section, so a missing `external` is always an authoring or
	// plumbing bug, not an irreducible data gap.
	CfrTitleCard: ['shortLabel', 'topic', 'description', 'whyItMatters', 'external'],
	CfrPartCard: ['titleNumber', 'partNumber', 'partTitle', 'external'],
	CfrSectionCard: ['partNumber', 'sectionCode', 'sectionTitle', 'external'],
	AimCorpusCard: ['title', 'description', 'whyItMatters'],
	AcCard: ['acNumber', 'acTitle', 'edition'],
	AcsCard: ['slug', 'title', 'edition'],
	PtsCard: ['slug', 'title', 'edition'],
	SafoCard: ['safoNumber', 'title'],
	InfoCard: ['infoNumber', 'title'],
	PohCard: ['aircraftModel', 'title', 'revision'],
	NtsbCard: ['reportNumber', 'reportTitle'],
	HandbookCard: ['shortSlug', 'fullTitle', 'edition', 'publisher'],
	UmbrellaCard: ['title'],
};

/**
 * Recommended-but-not-required fields. Surfaced by the audit page so
 * authoring has a punch-list, but missing them does NOT throw.
 */
export const RECOMMENDED_FIELDS_BY_VARIANT: Record<CardVariant, readonly string[]> = {
	CfrTitleCard: [],
	CfrPartCard: ['description', 'whyItMatters'],
	CfrSectionCard: [],
	AimCorpusCard: [],
	AcCard: ['description'],
	AcsCard: ['description', 'whyItMatters'],
	PtsCard: ['description'],
	SafoCard: ['summary', 'date', 'audience'],
	InfoCard: ['summary', 'date', 'audience'],
	PohCard: ['description'],
	NtsbCard: ['summary', 'date'],
	HandbookCard: ['description', 'whyItMatters'],
	UmbrellaCard: ['description', 'whyItMatters'],
};

/** A field counts as missing when null, undefined, or empty/whitespace string. */
function isMissing(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === 'string' && value.trim() === '') return true;
	// `external` is an `{ url, label }` object on the CFR variants. Treat
	// the object as missing when either side is empty -- a half-populated
	// link doesn't render on the card.
	if (typeof value === 'object' && !Array.isArray(value)) {
		const obj = value as Record<string, unknown>;
		if ('url' in obj || 'label' in obj) {
			const u = obj.url;
			const l = obj.label;
			if (typeof u !== 'string' || u.trim() === '') return true;
			if (typeof l !== 'string' || l.trim() === '') return true;
			return false;
		}
	}
	return false;
}

export interface CardValidationResult {
	readonly variant: CardVariant;
	readonly subject: string;
	readonly missingRequired: readonly string[];
	readonly missingRecommended: readonly string[];
}

/**
 * Pure validator. Pass the variant, a subject string for diagnostics
 * (e.g. "14 CFR Part 91"), and the data object the wrapper would render.
 * Returns the lists of missing fields. Never throws.
 */
export function validateCardData(
	variant: CardVariant,
	subject: string,
	data: Record<string, unknown>,
): CardValidationResult {
	const required = REQUIRED_FIELDS_BY_VARIANT[variant];
	const recommended = RECOMMENDED_FIELDS_BY_VARIANT[variant];
	const missingRequired = required.filter((f) => isMissing(data[f]));
	const missingRecommended = recommended.filter((f) => isMissing(data[f]));
	return { variant, subject, missingRequired, missingRecommended };
}

/**
 * Throws if any required field is missing. Use from wrappers and from
 * server loaders that want to bail early. The error message names every
 * missing field so the fix is obvious.
 */
export function assertCardComplete(variant: CardVariant, subject: string, data: Record<string, unknown>): void {
	const result = validateCardData(variant, subject, data);
	if (result.missingRequired.length === 0) return;
	throw new CardDataMissingError(result);
}

export class CardDataMissingError extends Error {
	readonly result: CardValidationResult;

	constructor(result: CardValidationResult) {
		super(
			`${result.variant} for "${result.subject}" missing required field(s): ` +
				`${result.missingRequired.join(', ')}. ` +
				`Author the field(s) on the matching reference.metadata or in the static kind-copy registry ` +
				`(libs/constants/src/study.ts :: LIBRARY_REGULATIONS_KIND_COPY).`,
		);
		this.name = 'CardDataMissingError';
		this.result = result;
	}
}

/**
 * Dev-mode aware wrapper. In dev, throws (loud). In prod, swallows the
 * error and returns the result so the caller can render a degraded view.
 *
 * SvelteKit's `import.meta.env.DEV` is the runtime signal. The helper
 * accepts an explicit override so tests can pin behaviour without
 * monkey-patching the global.
 */
export function enforceCardComplete(
	variant: CardVariant,
	subject: string,
	data: Record<string, unknown>,
	options: { throwOnMissing?: boolean } = {},
): CardValidationResult {
	const result = validateCardData(variant, subject, data);
	const shouldThrow = options.throwOnMissing ?? defaultShouldThrow();
	if (shouldThrow && result.missingRequired.length > 0) {
		throw new CardDataMissingError(result);
	}
	return result;
}

function defaultShouldThrow(): boolean {
	// import.meta.env.DEV is set by Vite/SvelteKit. Node scripts (seeders,
	// tests) don't have it but they're not bundled to the browser, so the
	// `process` fallback below is gated to keep the browser scanner happy.
	try {
		// biome-ignore lint/suspicious/noExplicitAny: defensive runtime probe -- import.meta shape varies
		const meta = import.meta as any;
		if (typeof meta?.env?.DEV === 'boolean') return meta.env.DEV === true;
	} catch {
		/* import.meta unavailable */
	}
	// biome-ignore lint/suspicious/noExplicitAny: probe global via globalThis to avoid bare `process` reference
	const proc = (typeof process !== 'undefined' ? process : undefined) as any;
	const nodeEnv = proc?.env?.NODE_ENV;
	if (typeof nodeEnv === 'string') return nodeEnv !== 'production';
	return true;
}
