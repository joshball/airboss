// @browser-globals: server-only -- never imported by client .svelte
/**
 * Phase 3 -- CFR ingestion orchestration.
 *
 * Source of truth: ADR 019 §2.4 (atomic batch promotion), §2.6 (registry
 * population), §5 (versioning workflow), and the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`.
 *
 * Steps:
 *
 *   1. Resolve cache or load fixture XML.
 *   2. Walk XML for the requested Title (Title 14 = whole; Title 49 filtered to 830 + 1552).
 *   3. Normalize raw structures into `SourceEntry` + body markdown.
 *   4. Insert entries into the active `SOURCES` table; insert editions into `EDITIONS`.
 *   5. Write derivatives via `derivative-writer`.
 *   6. Record atomic batch promotion `pending -> accepted` under
 *      `PHASE_3_REVIEWER_ID`. Skip when the entries are already accepted
 *      (idempotence).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_CACHE } from '@ab/constants';
import { commitIngestBatch, getEntryLifecycle } from '../registry/lifecycle.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { type CacheLoadResult, loadEcfrXml } from './cache.ts';
import { writeDerivativeTree } from './derivative-writer.ts';
import { writeCfrNavTree } from './nav-tree.ts';
import {
	type NormalizedPart,
	type NormalizedSection,
	type NormalizedSubpart,
	normalizeRawPart,
	normalizeRawSection,
	normalizeRawSubpart,
} from './normalizer.ts';
import { type RawCfrTree, walkRegsXml } from './xml-walker.ts';

export const PHASE_3_REVIEWER_ID = 'phase-3-bulk-ingestion';

/**
 * Title 49 parts in scope (NTSB Part 830 + TSA Part 1552). The eCFR Versioner
 * `?part=` filter only honors a single part per request, so each part is
 * fetched + cached separately, then aggregated into a single Title 49
 * manifest. See `regs.yaml` for the canonical config.
 */
const TITLE_49_PART_FILTER: ReadonlySet<string> = new Set(['830', '1552']);

export interface IngestOneTitleArgs {
	readonly title: '14' | '49';
	readonly editionDate: string; // YYYY-MM-DD
	readonly editionSlug?: string; // defaults to year extracted from editionDate
	readonly outRoot: string; // e.g. `<repo>/regulations`
	readonly fixturePath?: string;
	readonly fetchImpl?: Parameters<typeof loadEcfrXml>[0]['fetchImpl'];
}

export interface IngestReport {
	readonly title: '14' | '49';
	readonly editionSlug: string;
	readonly entriesIngested: number;
	readonly entriesAlreadyAccepted: number;
	readonly filesWritten: number;
	readonly filesUnchanged: number;
	readonly promotionBatchId: string | null;
	readonly editionDir: string;
}

/**
 * Run a single-Title ingestion. Idempotent: re-running with the same edition
 * reuses cache, hash-compares derivatives, skips re-promotion when accepted.
 *
 * For full-title fetches (Title 14) the walker handles the entire title in
 * one pass. For part-filtered titles (Title 49: parts 830 + 1552) each part
 * is fetched separately because the eCFR Versioner ignores all but one
 * `?part=` query value; the per-part walker outputs are concatenated into a
 * single manifest.
 */
export async function runIngest(args: IngestOneTitleArgs): Promise<IngestReport> {
	const editionSlug = args.editionSlug ?? extractYear(args.editionDate);
	const partList = args.title === '49' ? [...TITLE_49_PART_FILTER].sort() : null;

	// 1. Cache or fixture; 2. Walk. For full-title (Title 14) this is one pass.
	// For part-filtered (Title 49) we loop over each scoped part and aggregate.
	let aggregateTree: RawCfrTree;
	let primaryCache: CacheLoadResult;
	let additionalSources: readonly { url: string; sha256: string }[] | undefined;

	if (partList === null) {
		primaryCache = await loadEcfrXml({
			title: args.title,
			editionDate: args.editionDate,
			fixturePath: args.fixturePath,
			fetchImpl: args.fetchImpl,
		});
		aggregateTree = walkRegsXml(primaryCache.xml, { title: args.title });
	} else {
		// Multi-part: fetch each part separately, walk each, then concatenate.
		// `fixturePath`, when supplied, applies to the FIRST fetch only -- tests
		// that exercise multi-part should use the cache (or per-part fixtures
		// via the fetchImpl seam).
		const partsAcc: RawCfrTree['parts'][number][] = [];
		const subpartsAcc: RawCfrTree['subparts'][number][] = [];
		const sectionsAcc: RawCfrTree['sections'][number][] = [];
		const cacheResults: CacheLoadResult[] = [];
		for (const partN of partList) {
			const cacheResult = await loadEcfrXml({
				title: args.title,
				editionDate: args.editionDate,
				partFilter: new Set([partN]),
				fixturePath: cacheResults.length === 0 ? args.fixturePath : undefined,
				fetchImpl: args.fetchImpl,
			});
			cacheResults.push(cacheResult);
			const tree = walkRegsXml(cacheResult.xml, { title: args.title });
			partsAcc.push(...tree.parts);
			subpartsAcc.push(...tree.subparts);
			sectionsAcc.push(...tree.sections);
		}
		aggregateTree = {
			title: args.title,
			parts: partsAcc,
			subparts: subpartsAcc,
			sections: sectionsAcc,
			// Part-filter walks have no chapter/subchapter context (the XML
			// root is `DIV5 TYPE="PART"`, no chapter ancestor in the tree).
			navTree: null,
		};
		const first = cacheResults[0];
		if (first === undefined) {
			throw new Error(`Title ${args.title} configured with empty part list; refusing to ingest`);
		}
		// `sourceUrl` / `sourceSha256` carry the first source; `additionalSources`
		// captures every source so the manifest preserves provenance for all
		// fetched parts.
		primaryCache = first;
		additionalSources = cacheResults.map((r) => ({ url: r.sourceUrl, sha256: r.sourceSha256 }));
	}

	// 3. Normalize
	const publishedDate = new Date(`${args.editionDate}T00:00:00.000Z`);
	const partsNorm: NormalizedPart[] = aggregateTree.parts.map((p) => normalizeRawPart(p, { publishedDate }));
	const subpartsNorm: NormalizedSubpart[] = aggregateTree.subparts.map((s) =>
		normalizeRawSubpart(s, { publishedDate }),
	);
	const sectionsNorm: NormalizedSection[] = aggregateTree.sections.map((s) =>
		normalizeRawSection(s, { publishedDate }),
	);

	// 4. Populate registry tables
	const allEntries: SourceEntry[] = [
		...partsNorm.map((n) => n.entry),
		...subpartsNorm.map((n) => n.entry),
		...sectionsNorm.map((n) => n.entry),
	];

	let entriesAlreadyAccepted = 0;
	let entriesIngested = 0;
	const sourcesAcc: Record<string, SourceEntry> = {};
	const editionsAcc: Map<SourceId, readonly Edition[]> = new Map();

	for (const entry of allEntries) {
		const overlay = getEntryLifecycle(entry.id);
		if (overlay === 'accepted') {
			entriesAlreadyAccepted += 1;
		} else {
			sourcesAcc[entry.id] = entry;
			entriesIngested += 1;
		}

		const existingEditions = editionsAcc.get(entry.id) ?? [];
		const hasEdition = existingEditions.some((e) => e.id === editionSlug);
		if (!hasEdition) {
			const newEdition: Edition = {
				id: editionSlug,
				published_date: publishedDate,
				source_url: primaryCache.sourceUrl,
			};
			editionsAcc.set(entry.id, [...existingEditions, newEdition]);
		}
	}

	// 5a. Write nav-tree sidecar (chapter/subchapter -> part skeleton). Only
	// the full-title walk yields a non-null nav tree; part-filtered titles
	// (Title 49) skip this -- they have no chapter ancestor in the XML.
	if (aggregateTree.navTree !== null) {
		writeCfrNavTree({
			// `args.title` is the string literal `'14' | '49'`; the nav-tree API
			// keys URLs by numeric title id, so coerce up-front rather than
			// repeating the cast at every call site.
			title: args.title === '14' ? 14 : 49,
			editionDate: args.editionDate,
			outRoot: args.outRoot,
			raw: aggregateTree.navTree,
		});
	}

	// 5. Write derivatives
	const writeReport = writeDerivativeTree({
		title: args.title,
		editionDate: args.editionDate,
		editionSlug,
		outRoot: args.outRoot,
		sections: sectionsNorm,
		subparts: subpartsNorm,
		parts: partsNorm,
		manifest: {
			sourceUrl: primaryCache.sourceUrl,
			sourceSha256: primaryCache.sourceSha256,
			fetchedAt: new Date().toISOString(),
			...(additionalSources !== undefined ? { sources: additionalSources } : {}),
		},
	});

	// 6. Atomic batch commit (skip already-accepted entries from the scope).
	const scopeIds: SourceId[] = allEntries.filter((e) => getEntryLifecycle(e.id) !== 'accepted').map((e) => e.id);

	const commit = await commitIngestBatch({
		corpus: 'regs',
		reviewerId: PHASE_3_REVIEWER_ID,
		inputSource: primaryCache.sourceUrl,
		targetLifecycle: 'accepted',
		sources: sourcesAcc as Record<SourceId, SourceEntry>,
		editions: editionsAcc,
		scope: scopeIds,
	});
	if (!commit.ok) {
		throw new Error(`ingestion batch promotion failed: ${commit.error}`);
	}
	const promotionBatchId = commit.batchId;

	return {
		title: args.title,
		editionSlug,
		entriesIngested,
		entriesAlreadyAccepted,
		filesWritten: writeReport.filesWritten,
		filesUnchanged: writeReport.filesUnchanged,
		promotionBatchId,
		editionDir: writeReport.editionDir,
	};
}

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

const USAGE = `usage:
  bun run cfr-ingest --edition=<YYYY-MM-DD> [--title=14|49] [--out=<path>]
  bun run cfr-ingest --fixture=<path> [--title=14|49] [--out=<path>]
  bun run cfr-ingest --help
`;

export interface CliArgs {
	readonly editionDate: string | null;
	readonly fixturePath: string | null;
	readonly title: '14' | '49';
	readonly outRoot: string;
	readonly help: boolean;
}

export function parseCliArgs(argv: readonly string[]): CliArgs | { error: string } {
	let editionDate: string | null = null;
	let fixturePath: string | null = null;
	let title: '14' | '49' = '14';
	let outRoot = join(process.cwd(), SOURCE_CACHE.REGS);
	let help = false;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg.startsWith('--edition=')) editionDate = arg.slice('--edition='.length);
		else if (arg.startsWith('--fixture=')) fixturePath = arg.slice('--fixture='.length);
		else if (arg.startsWith('--title=')) {
			const t = arg.slice('--title='.length);
			if (t !== '14' && t !== '49') return { error: `--title must be 14 or 49; got "${t}"` };
			title = t;
		} else if (arg.startsWith('--out=')) outRoot = arg.slice('--out='.length);
		else return { error: `unknown argument: ${arg}` };
	}

	return { editionDate, fixturePath, title, outRoot, help };
}

/**
 * CLI entry point. Returns exit code. Never throws on user-facing errors;
 * unexpected exceptions propagate so the caller can decide how to surface.
 */
export async function runIngestCli(argv: readonly string[]): Promise<number> {
	const parsed = parseCliArgs(argv);
	if ('error' in parsed) {
		process.stderr.write(`${parsed.error}\n${USAGE}`);
		return 2;
	}

	if (parsed.help) {
		process.stdout.write(USAGE);
		return 0;
	}

	const isCi = process.env.CI === 'true';
	if (isCi && parsed.fixturePath === null) {
		process.stderr.write(
			'cfr-ingest: CI without --fixture is unsupported (live network ingest is an operator action).\n',
		);
		return 2;
	}

	if (parsed.editionDate === null && parsed.fixturePath === null) {
		process.stderr.write(`cfr-ingest: provide --edition=<YYYY-MM-DD> or --fixture=<path>\n${USAGE}`);
		return 2;
	}

	const editionDate = parsed.editionDate ?? readFixtureEditionDate(parsed.fixturePath ?? '') ?? '2026-01-01';
	const report = await runIngest({
		title: parsed.title,
		editionDate,
		outRoot: parsed.outRoot,
		fixturePath: parsed.fixturePath ?? undefined,
	});

	process.stdout.write(
		`cfr-ingest: title=${report.title} edition=${report.editionSlug}\n` +
			`  entriesIngested=${report.entriesIngested} alreadyAccepted=${report.entriesAlreadyAccepted}\n` +
			`  filesWritten=${report.filesWritten} unchanged=${report.filesUnchanged}\n` +
			`  promotionBatchId=${report.promotionBatchId ?? '(none)'}\n` +
			`  editionDir=${report.editionDir}\n`,
	);
	return 0;
}

function extractYear(editionDate: string): string {
	return editionDate.slice(0, 4);
}

function readFixtureEditionDate(fixturePath: string): string | null {
	// When using --fixture without --edition, infer from fixture filename
	// (e.g. `title-14-2026-fixture.xml` -> `2026-01-01`).
	if (fixturePath.length === 0) return null;
	if (!existsSync(fixturePath)) return null;
	const yearMatch = fixturePath.match(/-(\d{4})-/u);
	if (yearMatch === null) return null;
	const year = yearMatch[1];
	return year !== undefined ? `${year}-01-01` : null;
}
