/**
 * Constants used by the command-palette ranker (Phase 3.5).
 *
 * Source of truth: `design/mockups/search/mockup-04-ranking.md`. Tuning
 * happens here; everywhere else (ranker, tests, fixtures) imports these.
 *
 * The composite scorer in `libs/help/src/search-core.ts` reads `TYPE_TIER`
 * for the type-tier weight, `TITLE_MATCH_TIER` for the title bonus,
 * `BODY_MATCH_TIER` for the body bonus, and `DEPTH_PENALTY_PER_LEVEL` for
 * the depth penalty.
 *
 * Per-intent variations: I-1 (scoped) is filtered by `doc:` chip and does
 * not vary the composite score; I-2 (broad) uses the composite as-is; I-3
 * (phrase-FTS) inverts the type-tier (sections > books), boosts body, and
 * REWARDS depth instead of penalising it.
 */

/**
 * Type-tier weights -- the base score a result earns from its type.
 *
 * Whole-document types (handbook, CFR Part, AC, AIM chapter) live in the
 * 85-100 band. Section-level types (handbook chapter, CFR section, AIM
 * paragraph) sit at ~45-50. User content (cards/reps/plans) at 40. App
 * Help and external tools sit at the bottom (intentionally; they earn
 * placement when title-tier or body-tier boosts them, not by default).
 *
 * The shape is `Record<SearchResultType, number>` but expressed as a
 * literal object so adding a new SearchResultType creates a compile error
 * here (consumers `satisfies` against the union).
 */
export const TYPE_TIER = {
	'faa.handbook': 100,
	'faa.cfr.part': 90,
	'faa.ac': 90,
	'faa.aim': 85,
	'airboss.knode': 80,
	'airboss.course': 80,
	'airboss.glossary': 75,
	'faa.handbook.chapter': 50,
	'faa.cfr.sect': 50,
	'faa.aim.paragraph': 45,
	'mine.card': 40,
	'mine.rep': 40,
	'mine.plan': 40,
	'mine.note': 40,
	'airboss.lesson': 40,
	'cmd.action': 30,
	'cmd.goto': 30,
	'airboss.help': 20,
	'web.tool': 10,
} as const;

export type PaletteTypeTier = keyof typeof TYPE_TIER;

/**
 * Title-match tier bonuses. Stronger title evidence wins; doc-code matches
 * are deliberately top-tier so a pilot typing `FAA-H-8083-28` lands on the
 * handbook immediately.
 */
export const TITLE_MATCH_TIER = {
	/** Title exactly equals needle (case-insensitive). */
	EXACT_TITLE: 100,
	/** Doc code exactly equals needle (e.g. `FAA-H-8083-28`). */
	EXACT_DOC_CODE: 100,
	/** Alias exactly equals needle. */
	EXACT_ALIAS: 95,
	/** Doc code starts with needle (e.g. `8083` matches `FAA-H-8083-28`). */
	DOC_CODE_PREFIX: 80,
	/** Title or alias contains needle as a whole word. */
	WHOLE_WORD: 60,
	/** Title or alias contains needle as a substring (anywhere). */
	SUBSTRING: 30,
	/** No title-tier evidence. */
	NONE: 0,
} as const;

/** Body-match tier bonuses (keyword / body / snippet). */
export const BODY_MATCH_TIER = {
	/** Needle equals one of the row's declared keywords. */
	KEYWORD_EXACT: 25,
	/** Body contains the needle as a whole word. */
	BODY_WHOLE_WORD: 15,
	/** Body contains the needle as a substring. */
	BODY_SUBSTRING: 5,
	/** No body-tier evidence. */
	NONE: 0,
} as const;

/**
 * Depth penalty per nesting level (I-1 / I-2 modes). Chapter depth = 1,
 * section depth = 2, leaf paragraph depth = 3. I-3 mode inverts this into
 * a reward.
 */
export const DEPTH_PENALTY_PER_LEVEL = 3;

/**
 * Maximum number of rows in the top-hits strip. Tuned in the mockup;
 * three is the sweet spot before the strip starts competing visually
 * with the result column.
 */
export const TOP_HITS_MAX = 3;

/**
 * Minimum free-text length below which the title-prefix scan is skipped.
 * Below this length, every published reference appears to "match", which
 * gives every short keystroke a misleading I-2 verdict. Matching the
 * existing convention from `libs/help/src/loaders/_shared.ts`.
 */
export const TITLE_PREFIX_MIN_NEEDLE_LENGTH = 4;

/**
 * Word-count threshold at or above which a free-text query is classified
 * as I-3 (phrase-FTS) regardless of title-prefix matches. The mockup
 * starts at 4 words; tuneable during walk.
 */
export const PHRASE_FTS_WORD_COUNT_THRESHOLD = 4;
