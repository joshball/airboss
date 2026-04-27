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
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, recordPromotion } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { loadEcfrXml } from './cache.ts';
import { writeDerivativeTree } from './derivative-writer.ts';
import {
	type NormalizedPart,
	type NormalizedSection,
	type NormalizedSubpart,
	normalizeRawPart,
	normalizeRawSection,
	normalizeRawSubpart,
} from './normalizer.ts';
import { walkRegsXml } from './xml-walker.ts';

export const PHASE_3_REVIEWER_ID = 'phase-3-bulk-ingestion';

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
 */
export async function runIngest(args: IngestOneTitleArgs): Promise<IngestReport> {
	const editionSlug = args.editionSlug ?? extractYear(args.editionDate);
	const partFilter = args.title === '49' ? TITLE_49_PART_FILTER : undefined;

	// 1. Cache or fixture
	const cacheResult = await loadEcfrXml({
		title: args.title,
		editionDate: args.editionDate,
		partFilter,
		fixturePath: args.fixturePath,
		fetchImpl: args.fetchImpl,
	});

	// 2. Walk
	const tree = walkRegsXml(cacheResult.xml, { title: args.title, partFilter });

	// 3. Normalize
	const publishedDate = new Date(`${args.editionDate}T00:00:00.000Z`);
	const partsNorm: NormalizedPart[] = tree.parts.map((p) => normalizeRawPart(p, { publishedDate }));
	const subpartsNorm: NormalizedSubpart[] = tree.subparts.map((s) => normalizeRawSubpart(s, { publishedDate }));
	const sectionsNorm: NormalizedSection[] = tree.sections.map((s) => normalizeRawSection(s, { publishedDate }));

	// 4. Populate registry tables
	const allEntries: SourceEntry[] = [
		...partsNorm.map((n) => n.entry),
		...subpartsNorm.map((n) => n.entry),
		...sectionsNorm.map((n) => n.entry),
	];

	let entriesAlreadyAccepted = 0;
	let entriesIngested = 0;
	const sourcesPatch: Record<string, SourceEntry> = { ...__sources_internal__.getActiveTable() };
	const editionsPatch = new Map(__editions_internal__.getActiveTable());

	for (const entry of allEntries) {
		const existing = sourcesPatch[entry.id];
		const overlay = getEntryLifecycle(entry.id);
		if (existing !== undefined && overlay === 'accepted') {
			entriesAlreadyAccepted += 1;
		} else {
			sourcesPatch[entry.id] = entry;
			entriesIngested += 1;
		}

		const existingEditions = editionsPatch.get(entry.id) ?? [];
		const hasEdition = existingEditions.some((e) => e.id === editionSlug);
		if (!hasEdition) {
			const newEdition: Edition = {
				id: editionSlug,
				published_date: publishedDate,
				source_url: cacheResult.sourceUrl,
			};
			editionsPatch.set(entry.id, [...existingEditions, newEdition]);
		}
	}

	__sources_internal__.setActiveTable(sourcesPatch as Record<SourceId, SourceEntry>);
	__editions_internal__.setActiveTable(editionsPatch);

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
			sourceUrl: cacheResult.sourceUrl,
			sourceSha256: cacheResult.sourceSha256,
			fetchedAt: new Date().toISOString(),
		},
	});

	// 6. Atomic batch promotion (skip already-accepted entries)
	const scopeIds: SourceId[] = allEntries.filter((e) => getEntryLifecycle(e.id) !== 'accepted').map((e) => e.id);

	let promotionBatchId: string | null = null;
	if (scopeIds.length > 0) {
		const result = recordPromotion({
			corpus: 'regs',
			reviewerId: PHASE_3_REVIEWER_ID,
			scope: scopeIds,
			inputSource: cacheResult.sourceUrl,
			targetLifecycle: 'accepted',
		});
		if (!result.ok) {
			// Surface the error; do NOT silently roll forward to a half-promoted state.
			throw new Error(`ingestion batch promotion failed: ${result.error}`);
		}
		promotionBatchId = result.batch.id;
	}

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
	let outRoot = join(process.cwd(), 'regulations');
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
