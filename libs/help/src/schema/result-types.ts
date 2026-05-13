/**
 * Result-type taxonomy for the global command palette.
 *
 * Every result carries a `type` that drives column placement, detail-pane
 * affordances, and cross-column priority. Adding a new content domain is
 * "define type, register loader, assign column" -- not a ranker rewrite.
 *
 * Source of truth: `docs/work-packages/command-palette/spec.md` ("Result type
 * taxonomy") and `design.md` ("Contracts"). The shape here is what crosses
 * the library boundary; loaders in `libs/help/src/loaders/*` produce these
 * rows and `libs/help/src/search.ts` composes them into the `GroupedResults`
 * facade the UI consumes.
 *
 * The mode contract (`PaletteMode` -> eligible types) lives in
 * `libs/help/src/schema/palette-mode.ts` and is consumed by Phase 4/5 work.
 */

import type { AppSurface } from '@ab/constants';
import type { SearchIntent } from '../intent-classifier';
import type { ParsedFilter } from './help-registry';

/**
 * Discriminator for a search result. Each value names a loader + a column.
 * `mine.note` and `airboss.lesson` are scaffolded ahead of their upstream
 * surfaces; loaders for them return [] in Phase 2 (no upstream content yet).
 */
export type SearchResultType =
	| 'faa.handbook'
	| 'faa.handbook.chapter'
	| 'faa.cfr.part'
	| 'faa.cfr.sect'
	| 'faa.aim'
	| 'faa.ac'
	| 'faa.acs'
	| 'airboss.course'
	| 'airboss.knode'
	| 'airboss.glossary'
	| 'airboss.lesson'
	| 'airboss.help'
	| 'mine.card'
	| 'mine.rep'
	| 'mine.plan'
	| 'mine.note'
	| 'web.tool'
	| 'cmd.action'
	| 'cmd.goto';

/** Column id used by the multi-column palette layout. */
export type ResultColumn =
	| 'faa-resources'
	| 'airboss-content'
	| 'app-help'
	| 'my-stuff'
	| 'external-tools'
	| 'commands';

/**
 * Locked mapping `type -> column`. Exhaustive (TypeScript enforces). When a
 * new `SearchResultType` is added, the compile error here is the contract
 * reminder to assign a column.
 */
export const COLUMN_BY_TYPE: Record<SearchResultType, ResultColumn> = {
	'faa.handbook': 'faa-resources',
	'faa.handbook.chapter': 'faa-resources',
	'faa.cfr.part': 'faa-resources',
	'faa.cfr.sect': 'faa-resources',
	'faa.aim': 'faa-resources',
	'faa.ac': 'faa-resources',
	'faa.acs': 'faa-resources',
	'airboss.course': 'airboss-content',
	'airboss.knode': 'airboss-content',
	'airboss.glossary': 'airboss-content',
	'airboss.lesson': 'airboss-content',
	'airboss.help': 'app-help',
	'mine.card': 'my-stuff',
	'mine.rep': 'my-stuff',
	'mine.plan': 'my-stuff',
	'mine.note': 'my-stuff',
	'web.tool': 'external-tools',
	'cmd.action': 'commands',
	'cmd.goto': 'commands',
};

/**
 * Display labels for column headers.
 *
 * Phase 3.5 (WP decision R12) renames "FAA Resources" -> "Library" --
 * not every entry in that bucket is FAA-authored (NTSB, sectionals,
 * industry references). The column key (`faa-resources`) stays stable
 * so existing call sites + type IDs don't churn; only the user-facing
 * label changes.
 */
export const COLUMN_LABELS: Record<ResultColumn, string> = {
	'faa-resources': 'Library',
	'airboss-content': 'Airboss Content',
	'app-help': 'App Help',
	'my-stuff': 'My Stuff',
	'external-tools': 'External Tools',
	commands: 'Commands',
};

/**
 * Ordered list of columns; drives left-to-right rendering and Tab cycling.
 * Commands sits at the end of the visible layout (reserved-empty in Phase 2
 * until the registry lands in Phase 4).
 */
export const COLUMN_ORDER: readonly ResultColumn[] = [
	'faa-resources',
	'airboss-content',
	'app-help',
	'my-stuff',
	'external-tools',
	'commands',
];

/**
 * Rank tier within a column. Tier 1 is exact (doc-code / alias / title);
 * tier 5 is a body / FTS match. Lower wins. `bannerHit` requires exactly one
 * tier-1 result across all groups; otherwise no banner.
 *
 * The existing aviation registry's word-boundary tiers map onto this scale:
 * displayName-exact / alias-exact -> 1; word-boundary prefix on title or
 * alias -> 2; substring -> 3; keyword -> 4; body / paraphrase -> 5.
 */
export type RankBucket = 1 | 2 | 3 | 4 | 5;

/**
 * Validated-vs-community tier for external tools. Validated tools are the
 * hand-curated FAA / industry list; community is broader and additions are
 * cheaper. See `libs/aviation/src/external-tools.ts` and the design note
 * "External Tools tiering" section.
 */
export type WebToolTier = 'validated' | 'community';

/**
 * Provenance for a `mine.*` result -- did it come from recents storage or
 * from the live index? Used in Phase 5 quick-open to label "recent" rows.
 */
export type ResultSource = 'recents' | 'index';

export interface SearchResult {
	/** Stable id used for dedup + recents tracking. */
	readonly id: string;
	readonly type: SearchResultType;
	readonly title: string;
	/** Secondary line (e.g. "Chapter 12 / PHAK / FAA-H-8083-25C"). */
	readonly subtitle?: string;
	/**
	 * Body / FTS snippet. Empty for tier 1 / 2 results. Plain text -- the UI
	 * is free to highlight match ranges but never renders markdown here.
	 */
	readonly snippet?: string;
	/**
	 * Pre-resolved navigation target. Always a path (no origin); callers
	 * prefix the cross-app origin when navigating across surfaces.
	 */
	readonly href: string;
	/**
	 * Phase 2 5-bucket rank verdict. Phase 3.5 derives this from the
	 * composite score via `bucketFromScore` so existing call sites
	 * (loaders, registry hot path) keep populating it without churn.
	 * Removed in the UI PR once consumers move to `score` directly.
	 */
	readonly rankBucket: RankBucket;
	/**
	 * Phase 3.5 composite score (`type_tier + title + body - depth`).
	 * Loaders are not required to populate this; the search facade
	 * computes it as part of `searchGrouped()` before sorting / top-hits
	 * / book-level collapse. UI consumers should treat the field as
	 * authoritative for ranking once the facade has run.
	 */
	readonly score?: number;
	/**
	 * Canonical doc code (`FAA-H-8083-28`, `14 CFR 91`, `AC 00-6B`)
	 * surfaced on every published reference row. Drives the EXACT_DOC_CODE
	 * and DOC_CODE_PREFIX title-tier bonuses in the ranker (WP decisions
	 * R8 + R14: doc IDs always visible + autocomplete bidirectional).
	 */
	readonly docCode?: string;
	/**
	 * Nesting depth used by the depth penalty (I-1 / I-2) or depth reward
	 * (I-3). 0 for whole-document rows (handbook root, CFR Part). 1 for
	 * chapter. 2 for section. 3 for leaf paragraph. Loaders that don't
	 * carry this leave it undefined; the scorer defaults to 0.
	 */
	readonly depth?: number;
	/**
	 * Book-level collapse children (WP decision R11). When a handbook or
	 * CFR Part row matches a query AND its chapters / sections also match,
	 * the facade rolls the children up here and removes them from the
	 * top-level column. Only set in I-1 / I-2; phrase-FTS preserves the
	 * leaf rows (the user wants passages, not books).
	 */
	readonly children?: readonly SearchResult[];
	/**
	 * I-3 phrase-FTS highlighted snippet. Populated by the `fts-passages`
	 * loader (slice 3.5i, PR C) with Postgres `ts_headline` output --
	 * HTML-escaped text plus highlight markup (`<mark>...</mark>` by
	 * convention). The UI renders this verbatim inside the passage card
	 * via `{@html}`; consumers MUST NOT reflect arbitrary user input
	 * into this field.
	 *
	 * Empty / undefined in I-1 / I-2 modes.
	 */
	readonly passageHighlight?: string;
	/**
	 * Cluster bond key. Handbook root + chapter rows share the canonical
	 * doc slug (`phak`, `ifh`, `avwx`, ...); CFR Part + section rows share
	 * the slug (`14cfr91`, `49cfr175`). The cluster builder bonds children
	 * to roots by exact equality, so both producers must agree on the
	 * shape -- see `aviation-refs.ts` (root rows) and
	 * `handbook-sections.ts` / `cfr-sections.ts` (child rows).
	 */
	readonly clusterKey?: string;
	/** `web.tool` rows carry their tier; absent on every other type. */
	readonly tier?: WebToolTier;
	/** `mine.*` rows produced from recents storage carry `source: 'recents'`. */
	readonly source?: ResultSource;
}

/**
 * Parent/children pair used to render handbook-chapter or CFR-part-section
 * clusters inside the FAA Resources column. Children sort by ordinal.
 */
export interface DocCluster {
	readonly parent: SearchResult;
	readonly children: readonly SearchResult[];
}

/**
 * Synonym rewrites applied to the input query. Surfaced as chips above the
 * input so the user can see what the ranker actually searched for. Source:
 * `libs/aviation/src/synonyms.ts`.
 */
export interface SynonymRewrite {
	readonly from: string;
	readonly to: string;
}

/** Top-level grouped result set returned by `search()`. */
export interface GroupedResults {
	/**
	 * Single tier-1 match across all groups -- hoisted as a banner above the
	 * columns. `null` when 0 or >1 tier-1 matches.
	 */
	readonly bannerHit: SearchResult | null;
	/**
	 * Top-hits strip (Phase 3.5 / R8). Mixed types, sorted by composite
	 * score descending, capped at `TOP_HITS_MAX` rows. Hidden (empty) when
	 * `intent === 'phrase-fts'` -- the user typed a phrase, not a query,
	 * and wants passages, not docs.
	 */
	readonly topHits: readonly SearchResult[];
	/**
	 * Classified search intent for this result set. Drives result-panel
	 * shape choice + per-intent ranker variation. See `SearchIntent`.
	 */
	readonly intent: SearchIntent;
	/** Per-column buckets. Always present (empty arrays for empty columns). */
	readonly columns: Record<ResultColumn, readonly SearchResult[]>;
	/**
	 * Library cluster pairs (handbook + chapters, CFR part + sections).
	 * Renderers walk this BEFORE walking `columns['faa-resources']` flat. The
	 * flat column still carries every row so callers that don't render
	 * clusters still see everything.
	 *
	 * Phase 3.5 also rolls collapsed children onto each parent row directly
	 * via `SearchResult.children` -- the `clusters` field is the legacy
	 * shape and the `children` field is the canonical one. The UI PR drops
	 * `clusters` once consumers migrate.
	 */
	readonly clusters: readonly DocCluster[];
	/** Synonym rewrites applied; rendered as removable chips. */
	readonly synonymsApplied: readonly SynonymRewrite[];
	/** Filter chips above the input (parsed `tag:`, `kind:`, `doc:`, `mine`). */
	readonly filters: readonly ParsedFilter[];
	/** Total result count across every column (excluding banner hoist). */
	readonly totalCount: number;
}

/**
 * Host context provided by every palette mount point. Drives per-app boost,
 * `mine.*` scoping by user, and the eventual command registry. Loaders that
 * read DB tables (cards, reps, plans, knowledge nodes, reference sections)
 * receive this and bail out when `userId` is absent.
 */
export interface PaletteHost {
	/** Current app surface (`study`, `sim`, `hangar`, `flightbag`, `avionics`). */
	readonly surface: AppSurface;
	/** Current user id, or `undefined` when unauthenticated. */
	readonly userId?: string;
}

/**
 * Empty `GroupedResults` literal used by callers (UI default state, tests,
 * loaders that bail out under a filter that empties their column).
 */
export const EMPTY_GROUPED_RESULTS: GroupedResults = {
	bannerHit: null,
	topHits: [],
	intent: 'broad',
	columns: {
		'faa-resources': [],
		'airboss-content': [],
		'app-help': [],
		'my-stuff': [],
		'external-tools': [],
		commands: [],
	},
	clusters: [],
	synonymsApplied: [],
	filters: [],
	totalCount: 0,
};
