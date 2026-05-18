/**
 * Flightbag coverage sweep (integration tier).
 *
 * Walks every public reader URL the flightbag exposes and asserts the page
 * responds with a non-error status, renders a non-empty body, and (for
 * structural / content tiers) carries an H1 and the right section code or
 * title. Three tiers feed into one run:
 *
 *   sanity      every leaf reader URL we know how to build -> status < 400.
 *               This is the noise filter: a 4xx/5xx here is a routing bug or
 *               a missing seed row.
 *
 *   structural  one URL per reference plus one URL per chapter inside that
 *               reference -> 2xx, body > 500 chars, non-empty H1. The H1
 *               gate catches blank-shell regressions where a route renders
 *               but the loader returned empty.
 *
 *   content     for each chapter, pick the late-index + ~60%-index sections
 *               -> assert the body contains either the section's code or its
 *               title. This catches "the right row didn't render" without
 *               coupling to per-corpus prose formatting.
 *
 * URLs come from `sectionUrlFor` (apps/flightbag/src/lib/section-url.ts) so
 * the test exercises the routes the catalog actually links to. Rows whose
 * `sectionUrlFor` is `covered-by-parent` collapse into the parent URL set
 * (deduped). Rows whose result is `no-route` are recorded in the run
 * report's skipped section but not asserted on.
 *
 * Runtime: 32 workers, request fixture only (no browser). The vite SSR is
 * the bottleneck; the request fixture lets every worker pipeline GETs
 * without paying for chromium per worker.
 *
 * After the run, `tests/integration/reporter.ts` writes
 * `tests/integration/.out/coverage-report.md` aggregating per-tier counts
 * + every failure URL + the skip reasons.
 */

import { asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
	DEV_DB_URL_INTEGRATION,
	type ReferenceKind,
	REFERENCE_KIND_LABELS,
	type ReferenceSectionLevel,
	REFERENCE_SECTION_LEVEL_VALUES,
} from '../../libs/constants/src';
import { notSupersededInRegistry } from '../../libs/bc/study/src/edition-predicates.ts';
import { reference, referenceSection } from '../../libs/bc/study/src/schema';
import { expect, test } from '@playwright/test';
import { sectionUrlFor } from '../../apps/flightbag/src/lib/section-url';

interface DbSectionRow {
	readonly id: string;
	readonly referenceId: string;
	readonly parentId: string | null;
	readonly code: string;
	readonly title: string;
	readonly level: string;
	readonly depth: number;
	readonly ordinal: number;
}

interface DbReferenceRow {
	readonly id: string;
	readonly kind: ReferenceKind;
	readonly documentSlug: string;
	readonly edition: string;
}

/** Carries the URL + classifiers + optional content tokens for one parameterised test. */
export interface CoverageTarget {
	readonly tier: 'sanity' | 'structural' | 'content';
	readonly url: string;
	readonly kind: ReferenceKind;
	readonly documentSlug: string;
	readonly code: string;
	/**
	 * Token expected to appear in the rendered body for `content` tier
	 * (matching either the FAA section code or the section title). `null`
	 * for sanity/structural tiers.
	 */
	readonly codeToken: string | null;
	readonly titleToken: string | null;
}

/** Captures one skipped row (not asserted on). Surfaces in the run report. */
interface SkipRecord {
	readonly kind: ReferenceKind;
	readonly documentSlug: string;
	readonly code: string;
	readonly reason: string;
	readonly classification: 'covered-by-parent' | 'no-route';
}

interface PickedTargets {
	readonly sanity: readonly CoverageTarget[];
	readonly structural: readonly CoverageTarget[];
	readonly content: readonly CoverageTarget[];
	readonly skipped: readonly SkipRecord[];
}

function isReferenceSectionLevel(value: string): value is ReferenceSectionLevel {
	return (REFERENCE_SECTION_LEVEL_VALUES as readonly string[]).includes(value);
}

function isReferenceKind(value: string): value is ReferenceKind {
	return Object.hasOwn(REFERENCE_KIND_LABELS, value);
}

/**
 * Returns a stable display title token for the body match -- normalises
 * whitespace, drops trailing punctuation. Empty strings (or single-character
 * titles) are returned as null so the body match falls back to the code.
 */
function titleSearchToken(raw: string): string | null {
	const trimmed = raw.trim().replace(/\s+/g, ' ');
	if (trimmed.length < 3) return null;
	return trimmed;
}

async function collectTargets(): Promise<PickedTargets> {
	// Hard-pin to the integration DB. Bun auto-loads `.env` based on cwd,
	// which would otherwise route this query at the developer's dev DB.
	// `max=64` is well above the single-connection draw we need, but lets
	// Postgres queue rapid subqueries without blocking when the seed grows.
	const client = postgres(DEV_DB_URL_INTEGRATION, { max: 64 });
	const db = drizzle(client);
	try {
		const refs = (await db
			.select({
				id: reference.id,
				kind: reference.kind,
				documentSlug: reference.documentSlug,
				edition: reference.edition,
			})
			.from(reference)
			.where(notSupersededInRegistry())) as readonly DbReferenceRow[];

		const sanity: CoverageTarget[] = [];
		const structural: CoverageTarget[] = [];
		const content: CoverageTarget[] = [];
		const skipped: SkipRecord[] = [];
		const seenSanityUrls = new Set<string>();
		const seenStructuralUrls = new Set<string>();
		const seenContentUrls = new Set<string>();

		for (const ref of refs) {
			if (!isReferenceKind(ref.kind)) continue;

			// Pull every section row for this reference, deterministically sorted.
			// Sorting by (depth, ordinal, code) mirrors what
			// `representative-pages.spec.ts` does -- crucial for stable test
			// names across workers.
			const sections = (await db
				.select({
					id: referenceSection.id,
					referenceId: referenceSection.referenceId,
					parentId: referenceSection.parentId,
					code: referenceSection.code,
					title: referenceSection.title,
					level: referenceSection.level,
					depth: referenceSection.depth,
					ordinal: referenceSection.ordinal,
				})
				.from(referenceSection)
				.where(eq(referenceSection.referenceId, ref.id))
				.orderBy(
					asc(referenceSection.depth),
					asc(referenceSection.ordinal),
					asc(referenceSection.code),
				)) as readonly DbSectionRow[];

			// --- Sanity tier: every leaf URL we know how to build. ---
			for (const row of sections) {
				const level = isReferenceSectionLevel(row.level) ? row.level : null;
				const result = sectionUrlFor({
					kind: ref.kind,
					documentSlug: ref.documentSlug,
					edition: ref.edition,
					code: row.code,
					parentId: row.parentId,
					level,
				});
				if (result.kind === 'no-route') {
					skipped.push({
						kind: ref.kind,
						documentSlug: ref.documentSlug,
						code: row.code,
						reason: result.reason,
						classification: 'no-route',
					});
					continue;
				}
				if (result.kind === 'covered-by-parent') {
					skipped.push({
						kind: ref.kind,
						documentSlug: ref.documentSlug,
						code: row.code,
						reason: result.reason,
						classification: 'covered-by-parent',
					});
					// Fold the parent URL into the sanity set so we still hit it.
					if (!seenSanityUrls.has(result.parentUrl)) {
						seenSanityUrls.add(result.parentUrl);
						sanity.push({
							tier: 'sanity',
							url: result.parentUrl,
							kind: ref.kind,
							documentSlug: ref.documentSlug,
							code: row.code,
							codeToken: null,
							titleToken: null,
						});
					}
					continue;
				}
				if (!seenSanityUrls.has(result.url)) {
					seenSanityUrls.add(result.url);
					sanity.push({
						tier: 'sanity',
						url: result.url,
						kind: ref.kind,
						documentSlug: ref.documentSlug,
						code: row.code,
						codeToken: null,
						titleToken: null,
					});
				}
			}

			// --- Structural tier: chapter rows + the reference's natural
			// landing. Walking the depth-0 / "chapter" / "part" / "publication"
			// rows is enough to validate the per-corpus landing chain. ---
			const topLevelRows = sections.filter((s) => s.depth === 0);
			for (const row of topLevelRows) {
				const level = isReferenceSectionLevel(row.level) ? row.level : null;
				const result = sectionUrlFor({
					kind: ref.kind,
					documentSlug: ref.documentSlug,
					edition: ref.edition,
					code: row.code,
					parentId: row.parentId,
					level,
				});
				const candidateUrl = result.kind === 'url' ? result.url : result.kind === 'covered-by-parent' ? result.parentUrl : null;
				if (!candidateUrl) continue;
				if (seenStructuralUrls.has(candidateUrl)) continue;
				seenStructuralUrls.add(candidateUrl);
				structural.push({
					tier: 'structural',
					url: candidateUrl,
					kind: ref.kind,
					documentSlug: ref.documentSlug,
					code: row.code,
					codeToken: null,
					titleToken: titleSearchToken(row.title),
				});
			}

			// --- Content tier: per chapter, pick the last-index and ~60%-index
			// section so SSR-rendered body actually carries the row's code or
			// title. We exclude depth=0 rows (those are structural already);
			// the chapter's content tier comes from its child sections. ---
			const sectionsByParent = new Map<string, DbSectionRow[]>();
			for (const row of sections) {
				if (row.parentId === null) continue;
				const list = sectionsByParent.get(row.parentId) ?? [];
				list.push(row);
				sectionsByParent.set(row.parentId, list);
			}
			for (const [, children] of sectionsByParent.entries()) {
				if (children.length === 0) continue;
				children.sort((a, b) => a.ordinal - b.ordinal || a.code.localeCompare(b.code));
				const picks = new Set<DbSectionRow>();
				picks.add(children[children.length - 1] as DbSectionRow);
				const midIndex = Math.floor(children.length * 0.6);
				const mid = children[Math.min(midIndex, children.length - 1)];
				if (mid) picks.add(mid);
				for (const row of picks) {
					const level = isReferenceSectionLevel(row.level) ? row.level : null;
					const result = sectionUrlFor({
						kind: ref.kind,
						documentSlug: ref.documentSlug,
						edition: ref.edition,
						code: row.code,
						parentId: row.parentId,
						level,
					});
					if (result.kind !== 'url') continue;
					if (seenContentUrls.has(result.url)) continue;
					seenContentUrls.add(result.url);
					content.push({
						tier: 'content',
						url: result.url,
						kind: ref.kind,
						documentSlug: ref.documentSlug,
						code: row.code,
						codeToken: row.code.length >= 2 ? row.code : null,
						titleToken: titleSearchToken(row.title),
					});
				}
			}
		}

		// Stable ordering so the report and any rerun produce identical test
		// names. Sort by (tier, kind, slug, url) -- url breaks ties without
		// rearranging the natural reading order.
		const tierRank: Record<CoverageTarget['tier'], number> = { sanity: 0, structural: 1, content: 2 };
		const sortFn = (a: CoverageTarget, b: CoverageTarget): number => {
			if (a.tier !== b.tier) return tierRank[a.tier] - tierRank[b.tier];
			if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
			if (a.documentSlug !== b.documentSlug) return a.documentSlug < b.documentSlug ? -1 : 1;
			return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
		};

		return {
			sanity: [...sanity].sort(sortFn),
			structural: [...structural].sort(sortFn),
			content: [...content].sort(sortFn),
			skipped,
		};
	} finally {
		await client.end({ timeout: 1 });
	}
}

/**
 * `list` mode: print the URL plan, run no URL tests. The spec emits one
 * trivial passing sentinel test (see the `LIST_MODE` branch in the
 * `test.describe` below) so Playwright has a real test to run and exits 0
 * -- no `--grep $^` / `--pass-with-no-tests` workaround.
 *
 * Crucially, list mode renders the plan from the cached `manifest.json`
 * written by the last real sweep, so it needs NO database: `collectTargets`
 * (which queries the reference registry) is skipped entirely. Without this,
 * `bun run test integration list` crashes at module-load with
 * "DATABASE_URL is not set".
 */
const LIST_MODE = process.env.SWEEP_LIST === '1';

// An empty `collected` in list mode keeps the manifest write below a no-op,
// so the cached plan the reporter reads is preserved untouched.
const EMPTY_COLLECTED: PickedTargets = { sanity: [], structural: [], content: [], skipped: [] };
const collected = LIST_MODE ? EMPTY_COLLECTED : await collectTargets();

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Sweep mode contract -------------------------------------------------
// The dispatcher (scripts/test.ts) sets these env vars; the spec consumes
// them at module-load so the emitted `test(...)` set matches the requested
// scope. The reporter parses the persisted manifest, not these vars.

type SweepTier = CoverageTarget['tier'];
const ALL_TIERS: readonly SweepTier[] = ['sanity', 'structural', 'content'];

/** Default URLs-per-book ceiling in sample mode. */
const DEFAULT_SAMPLE_PER_BOOK = 12;

/** sample (default) hits only sanity; full hits every tier. */
const SAMPLE_MODE_TIERS: readonly SweepTier[] = ['sanity'];

type SweepMode = 'sample' | 'full';

function readSweepMode(): SweepMode {
	return process.env.SWEEP_MODE === 'full' ? 'full' : 'sample';
}

function readSamplePerBook(): number {
	const raw = process.env.SWEEP_SAMPLE_PER_BOOK;
	if (raw === undefined || raw.trim() === '') return DEFAULT_SAMPLE_PER_BOOK;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SAMPLE_PER_BOOK;
}

/**
 * Parses `SWEEP_TIERS` (comma list) into a tier set, dropping unknown
 * entries. Returns `null` when the var is absent/empty -> "no restriction".
 */
function readTierFilter(): ReadonlySet<SweepTier> | null {
	const raw = process.env.SWEEP_TIERS;
	if (raw === undefined || raw.trim() === '') return null;
	const tiers = raw
		.split(',')
		.map((t) => t.trim())
		.filter((t): t is SweepTier => (ALL_TIERS as readonly string[]).includes(t));
	return new Set(tiers);
}

/** The book key the manifest groups by: `${kind}/${documentSlug}`. */
function bookKey(target: CoverageTarget): string {
	return `${target.kind}/${target.documentSlug}`;
}

/**
 * Deterministic per-book sample. The input is already stably sorted by
 * `collectTargets`; this picks the first URL, the last URL, and the rest
 * evenly spaced by index, so the same registry always yields the same
 * sample. `count >= list.length` returns the list untouched.
 */
function sampleBook(list: readonly CoverageTarget[], count: number): readonly CoverageTarget[] {
	if (list.length <= count) return list;
	if (count <= 1) return [list[0] as CoverageTarget];
	const picked: CoverageTarget[] = [];
	const lastIndex = list.length - 1;
	for (let i = 0; i < count; i++) {
		const index = Math.round((i * lastIndex) / (count - 1));
		picked.push(list[index] as CoverageTarget);
	}
	// `Math.round` can collapse adjacent slots onto the same index near the
	// ends; dedupe by index while preserving order.
	const seen = new Set<string>();
	return picked.filter((t) => {
		if (seen.has(t.url)) return false;
		seen.add(t.url);
		return true;
	});
}

/** Applies the per-book sample ceiling across one tier's targets. */
function sampleTier(list: readonly CoverageTarget[], count: number): readonly CoverageTarget[] {
	const byBook = new Map<string, CoverageTarget[]>();
	for (const target of list) {
		const key = bookKey(target);
		const bucket = byBook.get(key) ?? [];
		bucket.push(target);
		byBook.set(key, bucket);
	}
	const result: CoverageTarget[] = [];
	for (const bucket of byBook.values()) {
		result.push(...sampleBook(bucket, count));
	}
	return result;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = resolvePath(__dirname, '.out');
mkdirSync(REPORT_DIR, { recursive: true });

/**
 * In resume mode, filters a target list down to URLs that failed (or never
 * ran) on the prior recorded run. A missing `last-run.json` makes resume a
 * no-op. A non-resume run never reads the file.
 */
function applyResumeFilter(list: readonly CoverageTarget[]): readonly CoverageTarget[] {
	if (process.env.SWEEP_RESUME !== '1') return list;
	const lastRunPath = resolvePath(REPORT_DIR, 'last-run.json');
	if (!existsSync(lastRunPath)) return list;
	let results: Record<string, string> = {};
	try {
		const parsed = JSON.parse(readFileSync(lastRunPath, 'utf8')) as { results?: Record<string, string> };
		results = parsed.results ?? {};
	} catch {
		// A corrupt last-run.json degrades to "run everything" rather than
		// silently dropping all targets.
		return list;
	}
	return list.filter((t) => results[t.url] !== 'passed');
}

const sweepMode = readSweepMode();
const samplePerBook = readSamplePerBook();
const tierFilter = readTierFilter();

// Tier set selection:
//  - no `SWEEP_TIERS` -> the mode's baseline (full = all three tiers,
//    sample = sanity only).
//  - `SWEEP_TIERS` set -> exactly those tiers, intersected with what the
//    mode is even capable of running. Full mode can run all three, so the
//    intersection is the filter itself; sample mode is likewise allowed to
//    run any single tier the caller names (e.g. `SWEEP_TIERS=structural` in
//    sample mode -> structural tier, sampled). The mode still governs
//    sampling; it does not silently veto an explicitly named tier.
const modeBaselineTiers = sweepMode === 'full' ? ALL_TIERS : SAMPLE_MODE_TIERS;
const requestedTiers = tierFilter === null ? modeBaselineTiers : ALL_TIERS.filter((t) => tierFilter.has(t));
const activeTiers = new Set(requestedTiers);

/** One tier's targets after mode/sample/tier-filter/resume narrowing. */
function narrowTier(tier: SweepTier, list: readonly CoverageTarget[]): readonly CoverageTarget[] {
	if (!activeTiers.has(tier)) return [];
	const sampled = sweepMode === 'sample' ? sampleTier(list, samplePerBook) : list;
	return applyResumeFilter(sampled);
}

const targets: PickedTargets = {
	sanity: narrowTier('sanity', collected.sanity),
	structural: narrowTier('structural', collected.structural),
	content: narrowTier('content', collected.content),
	skipped: collected.skipped,
};

// Persist the skip log onto disk for the reporter to pick up at run end.
// Skips live with the run artefact so the report can list every row that
// fell through to "covered-by-parent" or "no-route" along with the reason --
// the reporter has no DB connection of its own. The writer below is
// intentionally append-fragile (one writer, one run) to avoid coordinating
// across 32 workers.
//
// Skipped entirely in list mode: list mode collected nothing and must NOT
// clobber the cached `skipped.json` / `manifest.json` the reporter renders.
if (!LIST_MODE) {
	writeFileSync(
		resolvePath(REPORT_DIR, 'skipped.json'),
		JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				counts: {
					sanity: targets.sanity.length,
					structural: targets.structural.length,
					content: targets.content.length,
					skipped: targets.skipped.length,
				},
				skipped: targets.skipped,
			},
			null,
			2,
		),
	);
}

// Persist the run manifest: what will ACTUALLY run this invocation, after
// sampling + tier filter + resume. Written at module-load so it exists even
// in list mode (`--grep "$^"` runs zero tests). The reporter reads this.
interface ManifestBook {
	readonly book: string;
	readonly kind: ReferenceKind;
	readonly documentSlug: string;
	readonly sanity: number;
	readonly structural: number;
	readonly content: number;
	readonly total: number;
}

/** Tally a tier's targets into the supplied per-book map. */
function tallyInto(map: Map<string, ManifestBook>, tier: SweepTier, list: readonly CoverageTarget[]): void {
	for (const target of list) {
		const key = bookKey(target);
		const existing = map.get(key) ?? {
			book: key,
			kind: target.kind,
			documentSlug: target.documentSlug,
			sanity: 0,
			structural: 0,
			content: 0,
			total: 0,
		};
		map.set(key, { ...existing, [tier]: existing[tier] + 1, total: existing.total + 1 });
	}
}

// `manifestBooks` -- what this invocation will ACTUALLY run (post sample /
// tier filter / resume). `coverageBooks` -- the FULL coverage territory the
// sweep is derived from, before any narrowing. `list` mode shows the full
// territory so the plan is meaningful instead of 46 identical sampled rows;
// a real run shows the executed set.
const manifestBooks = new Map<string, ManifestBook>();
tallyInto(manifestBooks, 'sanity', targets.sanity);
tallyInto(manifestBooks, 'structural', targets.structural);
tallyInto(manifestBooks, 'content', targets.content);

const coverageBooks = new Map<string, ManifestBook>();
tallyInto(coverageBooks, 'sanity', collected.sanity);
tallyInto(coverageBooks, 'structural', collected.structural);
tallyInto(coverageBooks, 'content', collected.content);

const byBookKey = (a: ManifestBook, b: ManifestBook): number => (a.book < b.book ? -1 : a.book > b.book ? 1 : 0);
const sortedManifestBooks = [...manifestBooks.values()].sort(byBookKey);
const sortedCoverageBooks = [...coverageBooks.values()].sort(byBookKey);
const sumTier = (books: readonly ManifestBook[], tier: SweepTier): number =>
	books.reduce((acc, b) => acc + b[tier], 0);
const totalSanity = targets.sanity.length;
const totalStructural = targets.structural.length;
const totalContent = targets.content.length;

const coverageSanity = sumTier(sortedCoverageBooks, 'sanity');
const coverageStructural = sumTier(sortedCoverageBooks, 'structural');
const coverageContent = sumTier(sortedCoverageBooks, 'content');

// Persist the run manifest -- skipped in list mode so the cached plan from
// the last real sweep survives (list mode collected nothing).
if (!LIST_MODE) {
	writeFileSync(
		resolvePath(REPORT_DIR, 'manifest.json'),
		JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				mode: sweepMode,
				sampledPerBook: samplePerBook,
				// `totals` + `books` -- what this invocation runs (post-narrowing).
				totals: {
					sanity: totalSanity,
					structural: totalStructural,
					content: totalContent,
					total: totalSanity + totalStructural + totalContent,
					books: sortedManifestBooks.length,
				},
				books: sortedManifestBooks,
				// `coverage` -- the full territory before sample/tier/resume
				// narrowing. `list` mode renders this so the plan is meaningful.
				coverage: {
					totals: {
						sanity: coverageSanity,
						structural: coverageStructural,
						content: coverageContent,
						total: coverageSanity + coverageStructural + coverageContent,
						books: sortedCoverageBooks.length,
					},
					books: sortedCoverageBooks,
				},
			},
			null,
			2,
		),
	);
}

test.describe('flightbag coverage', () => {
	if (LIST_MODE) {
		// List mode prints the plan via the reporter and runs nothing else.
		// This single passing test gives Playwright a test to execute, so it
		// exits 0 without the `--grep $^` / `--pass-with-no-tests` workaround.
		test('list mode -- plan printed, no URLs swept', () => {
			expect(LIST_MODE).toBe(true);
		});
		return;
	}

	test('sample size is non-trivial -- catches a fully-empty registry', () => {
		// Floor pinned at 50; the dev seed today produces several hundred
		// sanity URLs (handbook sections, AIM paragraphs, CFR sections,
		// AC chapters, ACS landings). A drop to <50 means the seed
		// pipeline blanked the registry -- fail loudly.
		//
		// Checks the full COLLECTED set, not the post-sample/resume narrowed
		// set: sampling and resume legitimately shrink the emitted target
		// list (a clean resume run emits zero), so asserting on `targets`
		// would fire false positives. The registry-health signal lives in
		// `collected`.
		expect(collected.sanity.length, 'sanity targets fell off a cliff').toBeGreaterThan(50);
	});

	test.describe.configure({ mode: 'parallel' });

	test.describe('sanity -- every URL responds < 400', () => {
		for (const target of targets.sanity) {
			test(`[sanity] ${target.kind}/${target.documentSlug} ${target.url}`, async ({ request }) => {
				const res = await request.get(target.url);
				expect(res.status(), `${target.url} returned ${res.status()}`).toBeLessThan(400);
			});
		}
	});

	test.describe('structural -- landings and chapter pages render', () => {
		for (const target of targets.structural) {
			test(`[structural] ${target.kind}/${target.documentSlug} ${target.url}`, async ({ request }) => {
				const res = await request.get(target.url);
				expect(res.status(), `${target.url} returned ${res.status()}`).toBeLessThan(400);
				const body = await res.text();
				expect(body.length, `${target.url} body too small (${body.length} chars)`).toBeGreaterThan(500);
				const h1 = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
				const h1Text = h1?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';
				expect(h1Text.length, `${target.url} H1 empty`).toBeGreaterThan(0);
			});
		}
	});

	test.describe('content -- chapter samples render the right row', () => {
		for (const target of targets.content) {
			test(`[content] ${target.kind}/${target.documentSlug} ${target.url}`, async ({ request }) => {
				const res = await request.get(target.url);
				expect(res.status(), `${target.url} returned ${res.status()}`).toBeLessThan(400);
				const body = await res.text();
				expect(body.length, `${target.url} body too small (${body.length} chars)`).toBeGreaterThan(500);

				const codeMatches = target.codeToken !== null && body.includes(target.codeToken);
				const titleMatches =
					target.titleToken !== null && body.toLowerCase().includes(target.titleToken.toLowerCase());

				expect(
					codeMatches || titleMatches,
					`${target.url} body matches neither code "${target.codeToken ?? '-'}" nor title "${target.titleToken ?? '-'}"`,
				).toBe(true);
			});
		}
	});
});
