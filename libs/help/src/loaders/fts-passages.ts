// @browser-globals: server-only -- never imported by client .svelte
/**
 * Phrase-FTS loader (I-3, slice 3.5i). Powers the passage-card view when the
 * intent classifier returns `phrase-fts` (long / quoted / no title-prefix
 * match queries).
 *
 * Three sources active. Each source produces normalised `FtsRow` tuples that
 * are merged and globally re-ranked before being returned as `SearchResult`s.
 *
 *   1. `study.reference_section.content_md` (handbook chapters, CFR sections,
 *      AIM paragraphs, AC sections joined to `study.reference.kind`).
 *   2. `study.knowledge_node.content_md` (post-pivot ADR-011 nodes).
 *   3. `study.course_step.body_md` joined to `study.course` (instructor-
 *      authored course tree -- sections, lessons, and steps all carry
 *      markdown bodies). Rows are returned as `airboss.lesson` and link
 *      into the in-app course-step reader via `ROUTES.COURSE_STEP`.
 *
 * Each row is ranked by `ts_rank_cd(tsvector_col, query)` and rows are then
 * merged across the three sources and globally re-ranked so cross-source
 * ordering matches the per-source ordering the user expects.
 *
 * Snippet highlighting uses `ts_headline('english', body, query, options)`
 * with `<mark>` / `</mark>` wrappers; the result lands in
 * `SearchResult.passageHighlight` and is rendered via `{@html}` in
 * `PalettePassageView.svelte`. `ts_headline` HTML-escapes the body before
 * applying the wrappers, so the field is safe to render verbatim.
 *
 * Performance note: this loader does NOT require a `tsvector` index on the
 * source columns -- `to_tsvector(body)` works on raw text. The cost is one
 * full-table scan per source. Adding GIN indexes on
 * `to_tsvector('english', content_md)` is a separate WP (perf-only); the
 * current corpus sizes (hundreds of sections, tens of nodes) are well
 * within in-place-tsvector budgets.
 *
 * Server-only -- imports `@ab/db/connection`.
 */

import { course, courseStep, knowledgeNode, reference, referenceSection } from '@ab/bc-study';
import {
	COURSE_STATUSES,
	COURSE_STEP_LEVELS,
	LIBRARY_REGULATIONS_KIND_LABELS,
	LIBRARY_REGULATIONS_KINDS,
	REFERENCE_KINDS,
	ROUTES,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { createLogger } from '@ab/utils';
import { sql } from 'drizzle-orm';
import type { SearchResult, SearchResultType } from '../schema/result-types';
import type { LoaderDb } from './_shared';

const log = createLogger('palette');

/**
 * Default per-source row limit. The loader merges across three sources and
 * re-ranks globally, so the top-level slice is also capped at this value --
 * the merged set passed back to the facade is `<= DEFAULT_LIMIT` rows.
 */
const DEFAULT_LIMIT = 30;

/**
 * `ts_headline` option string. `StartSel` / `StopSel` wrap matched terms;
 * `MaxFragments=2` lets a long body produce two non-contiguous fragments;
 * `MaxWords` / `MinWords` cap fragment width so one giant paragraph doesn't
 * blow out the passage card. Matches the values in the PR brief.
 */
const HEADLINE_OPTIONS = 'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=25, MinWords=10';

export interface LoadFtsPassagesInput {
	readonly needle: string;
	readonly limit?: number;
	readonly userId?: string | null;
}

/**
 * Internal row shape: each source produces this normalised tuple. The
 * `type` discriminator drives column placement and downstream href
 * resolution; `rank` is the Postgres `ts_rank_cd` value (higher = better).
 */
interface FtsRow {
	readonly id: string;
	readonly type: SearchResultType;
	readonly title: string;
	readonly subtitle: string | null;
	readonly href: string;
	readonly headline: string;
	readonly rank: number;
	readonly depth: number;
	readonly clusterKey: string | null;
}

/**
 * Run the phrase-FTS loader and return passage-shaped rows.
 *
 * Contract:
 *   - Empty needle returns `[]`.
 *   - Each source query is wrapped in its own try/catch; one failing source
 *     degrades to an empty slice rather than blanking the whole loader.
 *   - Total throw paths are caught at the top level and logged; the caller
 *     gets `[]` so a DB blip never blanks the palette.
 *
 * The `userId` field on the input is reserved for future per-user filters
 * (e.g. only-my-domain). Today the FTS sources are all global content; the
 * argument is plumbed through so the contract doesn't churn when scoping
 * arrives.
 */
export async function loadFtsPassages(
	input: LoadFtsPassagesInput,
	db: LoaderDb = defaultDb,
): Promise<readonly SearchResult[]> {
	const needle = input.needle.trim();
	if (needle.length === 0) return [];
	const limit = input.limit ?? DEFAULT_LIMIT;

	try {
		const [sectionRows, knodeRows, courseStepRows] = await Promise.all([
			queryReferenceSections(db, needle, limit).catch((err) => {
				log.error('fts-passages: reference_section query failed', { metadata: { needle } }, asError(err));
				return [] as readonly FtsRow[];
			}),
			queryKnowledgeNodes(db, needle, limit).catch((err) => {
				log.error('fts-passages: knowledge_node query failed', { metadata: { needle } }, asError(err));
				return [] as readonly FtsRow[];
			}),
			queryCourseSteps(db, needle, limit).catch((err) => {
				log.error('fts-passages: course_step query failed', { metadata: { needle } }, asError(err));
				return [] as readonly FtsRow[];
			}),
		]);

		// Merge + global re-rank. ts_rank_cd is comparable across queries
		// against the same tsquery shape, so the ordering across sources is
		// meaningful. Tie-break by title for determinism.
		const merged: FtsRow[] = [...sectionRows, ...knodeRows, ...courseStepRows];
		merged.sort((a, b) => {
			if (a.rank !== b.rank) return b.rank - a.rank;
			return a.title.localeCompare(b.title);
		});

		// Map FTS rows into `SearchResult`. `rankBucket = 5` (body match)
		// matches the existing tier convention; the composite scorer in
		// `search-core.ts` keys off `score` (computed by `searchGrouped`),
		// not `rankBucket`, so the tier value is informational here.
		const limited = merged.slice(0, limit);
		const out: SearchResult[] = limited.map((row) => ({
			id: row.id,
			type: row.type,
			title: row.title,
			subtitle: row.subtitle ?? undefined,
			snippet: stripHighlightMarkup(row.headline),
			passageHighlight: row.headline,
			href: row.href,
			rankBucket: 5,
			depth: row.depth,
			clusterKey: row.clusterKey ?? undefined,
		}));
		return out;
	} catch (err) {
		log.error('fts-passages: loader failed', { metadata: { needle } }, asError(err));
		return [];
	}
}

// -------- source: reference_section --------

interface ReferenceSectionFtsRowRaw extends Record<string, unknown> {
	section_id: string;
	code: string;
	section_title: string;
	headline: string;
	rank: number;
	depth: number;
	document_slug: string;
	reference_title: string;
	reference_kind: string;
}

/**
 * Query `study.reference_section` joined to `study.reference`. The body
 * column is `content_md`; we project both `ts_rank_cd` and `ts_headline`
 * in a single round-trip so the planner can share the parsed tsquery.
 *
 * The result type is derived from `reference.kind` via `mapReferenceKind`;
 * mismatch (an unknown kind future-proofs into a generic glossary row,
 * matching the convention in `aviation-refs.ts`).
 */
async function queryReferenceSections(db: LoaderDb, needle: string, limit: number): Promise<readonly FtsRow[]> {
	// The websearch_to_tsquery interprets user-friendly quoting + AND/OR/NOT.
	// We bind the needle as a parameter; `to_tsvector` on the body column is
	// computed per-row (no index assumed).
	const result = await db.execute<ReferenceSectionFtsRowRaw>(sql`
		SELECT
			rs.id AS section_id,
			rs.code AS code,
			rs.title AS section_title,
			rs.depth AS depth,
			r.document_slug AS document_slug,
			r.title AS reference_title,
			r.kind AS reference_kind,
			ts_rank_cd(to_tsvector('english', rs.content_md), websearch_to_tsquery('english', ${needle})) AS rank,
			ts_headline(
				'english',
				rs.content_md,
				websearch_to_tsquery('english', ${needle}),
				${HEADLINE_OPTIONS}
			) AS headline
		FROM ${referenceSection} rs
		INNER JOIN ${reference} r ON r.id = rs.reference_id
		WHERE to_tsvector('english', rs.content_md) @@ websearch_to_tsquery('english', ${needle})
		ORDER BY rank DESC
		LIMIT ${limit}
	`);

	const rows = result as unknown as readonly ReferenceSectionFtsRowRaw[];
	const out: FtsRow[] = [];
	for (const r of rows) {
		const mapped = mapReferenceKind(r.reference_kind, r.document_slug);
		if (!mapped) continue;
		out.push({
			id: r.section_id,
			type: mapped.type,
			title: mapped.title(r.code, r.section_title),
			subtitle: `${r.document_slug.toUpperCase()} - ${r.reference_title}`,
			href: mapped.href(r.document_slug, r.code),
			headline: r.headline,
			rank: Number(r.rank ?? 0),
			depth: Number(r.depth ?? 0),
			clusterKey: r.document_slug,
		});
	}
	return out;
}

interface ReferenceKindMapping {
	readonly type: SearchResultType;
	title(code: string, sectionTitle: string): string;
	href(documentSlug: string, code: string): string;
}

/**
 * Map `study.reference.kind` to the passage row shape (type + title + href).
 * Returns `null` for kinds that don't have a section reader today (POH,
 * NTSB, SAFO, INFO, OTHER): those rows wouldn't navigate to a meaningful
 * destination via the existing routes, so we drop them rather than emit a
 * broken link.
 */
function mapReferenceKind(kind: string, documentSlug: string): ReferenceKindMapping | null {
	switch (kind) {
		case REFERENCE_KINDS.HANDBOOK:
			return {
				type: 'faa.handbook.chapter',
				title: (code, sectionTitle) => `${code} - ${sectionTitle}`,
				href: (slug, code) => {
					const { chapter, section } = splitHandbookCode(code);
					return section.length === 0
						? ROUTES.LIBRARY_HANDBOOK_CHAPTER(slug, chapter)
						: ROUTES.LIBRARY_HANDBOOK_SECTION(slug, chapter, section);
				},
			};
		case REFERENCE_KINDS.CFR: {
			const cfrKind = documentSlug.startsWith('49')
				? LIBRARY_REGULATIONS_KINDS.CFR_49
				: LIBRARY_REGULATIONS_KINDS.CFR_14;
			const prefix = LIBRARY_REGULATIONS_KIND_LABELS[cfrKind];
			return {
				type: 'faa.cfr.sect',
				title: (code, sectionTitle) => `${prefix} §${code} - ${sectionTitle}`,
				href: (slug, code) => ROUTES.LIBRARY_REGULATIONS_SECTION(cfrKind, slug, code),
			};
		}
		case REFERENCE_KINDS.AIM:
			return {
				type: 'faa.aim',
				title: (code, sectionTitle) => `AIM ${code} - ${sectionTitle}`,
				href: (slug, code) => ROUTES.LIBRARY_REGULATIONS_SECTION(LIBRARY_REGULATIONS_KINDS.AIM, slug, code),
			};
		case REFERENCE_KINDS.AC:
			return {
				type: 'faa.ac',
				title: (code, sectionTitle) => `AC ${code} - ${sectionTitle}`,
				href: (slug, code) => ROUTES.LIBRARY_REGULATIONS_SECTION(LIBRARY_REGULATIONS_KINDS.AC, slug, code),
			};
		default:
			return null;
	}
}

/**
 * Split a handbook section `code` (`"12"` or `"12.3"`) into chapter +
 * section fragments for the in-app reader href. Mirrors the helper in
 * `handbook-sections.ts`.
 */
function splitHandbookCode(code: string): { chapter: string; section: string } {
	const dot = code.indexOf('.');
	if (dot < 0) return { chapter: code, section: '' };
	return { chapter: code.slice(0, dot), section: code.slice(dot + 1) };
}

// -------- source: knowledge_node --------

interface KnowledgeNodeFtsRowRaw extends Record<string, unknown> {
	id: string;
	title: string;
	domain: string;
	headline: string;
	rank: number;
}

async function queryKnowledgeNodes(db: LoaderDb, needle: string, limit: number): Promise<readonly FtsRow[]> {
	const result = await db.execute<KnowledgeNodeFtsRowRaw>(sql`
		SELECT
			kn.id AS id,
			kn.title AS title,
			kn.domain AS domain,
			ts_rank_cd(to_tsvector('english', kn.content_md), websearch_to_tsquery('english', ${needle})) AS rank,
			ts_headline(
				'english',
				kn.content_md,
				websearch_to_tsquery('english', ${needle}),
				${HEADLINE_OPTIONS}
			) AS headline
		FROM ${knowledgeNode} kn
		WHERE to_tsvector('english', kn.content_md) @@ websearch_to_tsquery('english', ${needle})
		ORDER BY rank DESC
		LIMIT ${limit}
	`);

	const rows = result as unknown as readonly KnowledgeNodeFtsRowRaw[];
	const out: FtsRow[] = [];
	for (const r of rows) {
		out.push({
			id: r.id,
			type: 'airboss.knode',
			title: r.title,
			subtitle: `Knowledge - ${r.domain}`,
			href: ROUTES.REFERENCE_KNOWLEDGE_SLUG(r.id),
			headline: r.headline,
			rank: Number(r.rank ?? 0),
			// Knowledge nodes are atomic per ADR 011; depth is always 0
			// (whole-node body). The I-3 ranker rewards depth, so this is
			// the conservative floor for the source.
			depth: 0,
			clusterKey: null,
		});
	}
	return out;
}

// -------- source: course_step --------

interface CourseStepFtsRowRaw extends Record<string, unknown> {
	step_id: string;
	step_code: string;
	step_title: string;
	step_level: string;
	course_id: string;
	course_slug: string;
	course_title: string;
	headline: string;
	rank: number;
}

/**
 * Map `course_step.level` (`section` / `lesson` / `step`) to a depth value
 * used by the I-3 ranker. Roots get 0, leaves get the deepest non-zero
 * floor; the in-between `lesson` rows are typically interior nodes that
 * should rank between root and leaf. This mirrors the depth-reward
 * convention used by `reference_section` (chapter=1, section=2).
 */
function depthForCourseStepLevel(level: string): number {
	switch (level) {
		case COURSE_STEP_LEVELS.SECTION:
			return 0;
		case COURSE_STEP_LEVELS.LESSON:
			return 1;
		case COURSE_STEP_LEVELS.STEP:
			return 2;
		default:
			return 0;
	}
}

/**
 * Query `study.course_step` joined to `study.course`. The body column is
 * `body_md` (defaulted to `''` in schema -- the `length(...) > 0` filter
 * drops rows that carry no authored markdown). Archived courses are
 * excluded so a deprecated course never surfaces as a passage hit.
 *
 * Each match maps to `airboss.lesson` (already in the type taxonomy and
 * placed in the Airboss Content column). The `href` lands on the in-app
 * course-step reader (`ROUTES.COURSE_STEP(courseSlug, stepCode)`); the
 * `clusterKey` shares the parent `course_id` so future cluster-collapse
 * (course root + child steps) bonds correctly.
 */
async function queryCourseSteps(db: LoaderDb, needle: string, limit: number): Promise<readonly FtsRow[]> {
	const result = await db.execute<CourseStepFtsRowRaw>(sql`
		SELECT
			cs.id AS step_id,
			cs.code AS step_code,
			cs.title AS step_title,
			cs.level AS step_level,
			c.id AS course_id,
			c.slug AS course_slug,
			c.title AS course_title,
			ts_rank_cd(to_tsvector('english', cs.body_md), websearch_to_tsquery('english', ${needle})) AS rank,
			ts_headline(
				'english',
				cs.body_md,
				websearch_to_tsquery('english', ${needle}),
				${HEADLINE_OPTIONS}
			) AS headline
		FROM ${courseStep} cs
		INNER JOIN ${course} c ON c.id = cs.course_id
		WHERE length(cs.body_md) > 0
			AND c.status <> ${COURSE_STATUSES.ARCHIVED}
			AND to_tsvector('english', cs.body_md) @@ websearch_to_tsquery('english', ${needle})
		ORDER BY rank DESC
		LIMIT ${limit}
	`);

	const rows = result as unknown as readonly CourseStepFtsRowRaw[];
	const out: FtsRow[] = [];
	for (const r of rows) {
		out.push({
			id: r.step_id,
			type: 'airboss.lesson',
			title: `${r.step_code} - ${r.step_title}`,
			subtitle: `Course - ${r.course_title}`,
			href: ROUTES.COURSE_STEP(r.course_slug, r.step_code),
			headline: r.headline,
			rank: Number(r.rank ?? 0),
			depth: depthForCourseStepLevel(r.step_level),
			clusterKey: r.course_id,
		});
	}
	return out;
}

// -------- helpers --------

/**
 * Strip the `ts_headline` highlight wrappers to produce a plain-text
 * fallback `snippet`. Existing UI consumers that read `snippet` (e.g. the
 * column row template when `passageHighlight` is absent for some reason)
 * still get readable text. The passage view itself reads
 * `passageHighlight` directly.
 */
function stripHighlightMarkup(headline: string): string {
	return headline.replace(/<\/?mark>/g, '');
}

function asError(err: unknown): Error | undefined {
	return err instanceof Error ? err : undefined;
}
