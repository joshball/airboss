/**
 * Phase 7 -- AIM corpus ingestion orchestration.
 *
 * Source of truth: ADR 019 §2.4 (atomic batch promotion), §2.6 (registry
 * population), and the WP at `docs/work-packages/reference-aim-ingestion/`.
 *
 * Phase 7 walks an existing on-disk manifest and emits one `SourceEntry` per
 * chapter, section, paragraph, glossary entry, and appendix. Live AIM source
 * ingestion (PDF / HTML -> markdown) is a separate operator pipeline outside
 * this WP. Idempotent: re-running with the same `--edition=` is a no-op.
 *
 * Steps:
 *
 *   1. Load the manifest at `<derivativeRoot>/<edition>/manifest.json`.
 *   2. Walk `manifest.entries[]`, building one `SourceEntry` per record.
 *   3. Insert entries into the active `SOURCES` table; insert edition into `EDITIONS`.
 *   4. Record atomic batch promotion `pending -> accepted` under
 *      `PHASE_7_REVIEWER_ID`. Skip when entries are already accepted.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, recordPromotion } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { type ManifestEntry, type ManifestFile, readManifest } from './derivative-reader.ts';

export const PHASE_7_REVIEWER_ID = 'phase-7-aim-ingestion';

const DOC_SHORT = 'AIM';
const DOC_FORMAL = 'Aeronautical Information Manual';

export interface IngestArgs {
	/** AIM edition slug, year-month (e.g. `'2026-09'`). */
	readonly edition: string;
	/** Path to the directory containing per-edition derivative trees (default `<cwd>/aim`). */
	readonly derivativeRoot: string;
}

export interface IngestReport {
	readonly edition: string;
	readonly entriesIngested: number;
	readonly entriesAlreadyAccepted: number;
	readonly promotionBatchId: string | null;
	readonly manifestPath: string;
}

/**
 * Convert a slug like `pilot-in-command` to a Title Case display form like
 * `Pilot In Command`. Used for `canonical_short` on glossary entries when
 * the manifest's `title` is sentence case; we always trust the manifest's
 * title where present, so this is a fallback only.
 */
function slugToTitle(slug: string): string {
	return slug
		.split('-')
		.map((part) => (part.length === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
		.join(' ');
}

/**
 * Build canonical_short / canonical_formal / canonical_title for one
 * manifest entry. Pure function; no registry mutation.
 */
function buildEntry(args: { readonly entry: ManifestEntry; readonly publishedDate: Date }): SourceEntry {
	const { entry, publishedDate } = args;
	const id = idForEntry(entry) as SourceId;

	let canonical_short: string;
	let canonical_formal: string;

	switch (entry.kind) {
		case 'chapter': {
			canonical_short = `${DOC_SHORT} ${entry.code}`;
			canonical_formal = `${DOC_FORMAL}, Chapter ${entry.code}`;
			break;
		}
		case 'section': {
			const parts = entry.code.split('-');
			const chapterN = parts[0];
			const sectionN = parts[1];
			if (chapterN === undefined || sectionN === undefined) {
				throw new Error(`aim ingest: section code "${entry.code}" is malformed (expected "<chapter>-<section>")`);
			}
			canonical_short = `${DOC_SHORT} ${entry.code}`;
			canonical_formal = `${DOC_FORMAL}, Chapter ${chapterN}, Section ${sectionN}`;
			break;
		}
		case 'paragraph': {
			const parts = entry.code.split('-');
			const chapterN = parts[0];
			const sectionN = parts[1];
			const paragraphN = parts[2];
			if (chapterN === undefined || sectionN === undefined || paragraphN === undefined) {
				throw new Error(
					`aim ingest: paragraph code "${entry.code}" is malformed (expected "<chapter>-<section>-<paragraph>")`,
				);
			}
			canonical_short = `${DOC_SHORT} ${entry.code}`;
			canonical_formal = `${DOC_FORMAL}, Chapter ${chapterN}, Section ${sectionN}, Paragraph ${paragraphN}`;
			break;
		}
		case 'glossary': {
			const slug = entry.code.startsWith('glossary/') ? entry.code.slice('glossary/'.length) : entry.code;
			const display = entry.title.length > 0 ? entry.title : slugToTitle(slug);
			canonical_short = `${DOC_SHORT} Glossary - ${display}`;
			canonical_formal = `${DOC_FORMAL}, Pilot/Controller Glossary, ${display}`;
			break;
		}
		case 'appendix': {
			const num = entry.code.startsWith('appendix-') ? entry.code.slice('appendix-'.length) : entry.code;
			canonical_short = `${DOC_SHORT} Appendix ${num}`;
			canonical_formal = `${DOC_FORMAL}, Appendix ${num}`;
			break;
		}
		default: {
			const exhaustive: never = entry.kind;
			throw new Error(`aim ingest: unknown entry kind: ${exhaustive as string}`);
		}
	}

	return {
		id,
		corpus: 'aim',
		canonical_short,
		canonical_formal,
		canonical_title: entry.title,
		last_amended_date: publishedDate,
		lifecycle: 'pending',
	};
}

function idForEntry(entry: ManifestEntry): string {
	return `airboss-ref:aim/${entry.code}`;
}

/**
 * Run a single-edition AIM ingestion. Idempotent: re-running with the same
 * args skips entries already in `accepted` lifecycle and records no promotion
 * batch.
 */
export async function runAimIngest(args: IngestArgs): Promise<IngestReport> {
	const manifestPath = join(args.derivativeRoot, args.edition, 'manifest.json');
	if (!existsSync(manifestPath)) {
		throw new Error(`aim ingest: manifest not found at ${manifestPath}`);
	}

	const manifest: ManifestFile = readManifest(args.edition, args.derivativeRoot);
	if (manifest.edition !== args.edition) {
		throw new Error(`aim ingest: manifest edition "${manifest.edition}" does not match arg "${args.edition}"`);
	}

	const publishedDate = new Date(manifest.fetched_at);
	if (Number.isNaN(publishedDate.getTime())) {
		throw new Error(`aim ingest: manifest fetched_at "${manifest.fetched_at}" is not a valid date`);
	}

	// Build entries
	const entries: SourceEntry[] = manifest.entries.map((entry) => buildEntry({ entry, publishedDate }));

	// Patch into active tables
	let entriesAlreadyAccepted = 0;
	let entriesIngested = 0;
	const sourcesPatch: Record<string, SourceEntry> = { ...__sources_internal__.getActiveTable() };
	const editionsPatch = new Map(__editions_internal__.getActiveTable());

	const editionRecord: Edition = {
		id: args.edition,
		published_date: publishedDate,
		source_url: manifest.source_url,
	};

	for (const entry of entries) {
		const existing = sourcesPatch[entry.id];
		const overlay = getEntryLifecycle(entry.id);
		if (existing !== undefined && overlay === 'accepted') {
			entriesAlreadyAccepted += 1;
		} else {
			sourcesPatch[entry.id] = entry;
			entriesIngested += 1;
		}

		const existingEditions = editionsPatch.get(entry.id) ?? [];
		const hasEdition = existingEditions.some((e) => e.id === args.edition);
		if (!hasEdition) {
			editionsPatch.set(entry.id, [...existingEditions, editionRecord]);
		}
	}

	__sources_internal__.setActiveTable(sourcesPatch as Record<SourceId, SourceEntry>);
	__editions_internal__.setActiveTable(editionsPatch);

	// Atomic batch promotion (skip already-accepted entries)
	const scopeIds: SourceId[] = entries.filter((e) => getEntryLifecycle(e.id) !== 'accepted').map((e) => e.id);

	let promotionBatchId: string | null = null;
	if (scopeIds.length > 0) {
		const result = recordPromotion({
			corpus: 'aim',
			reviewerId: PHASE_7_REVIEWER_ID,
			scope: scopeIds,
			inputSource: manifestPath,
			targetLifecycle: 'accepted',
		});
		if (!result.ok) {
			throw new Error(`aim ingest batch promotion failed: ${result.error}`);
		}
		promotionBatchId = result.batch.id;
	}

	return {
		edition: args.edition,
		entriesIngested,
		entriesAlreadyAccepted,
		promotionBatchId,
		manifestPath,
	};
}

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

const USAGE = `usage:
  bun run aim-corpus-ingest --edition=<YYYY-MM> [--out=<path>]
  bun run aim-corpus-ingest --help
`;

const EDITION_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

export interface CliArgs {
	readonly edition: string | null;
	readonly derivativeRoot: string;
	readonly help: boolean;
}

export function parseCliArgs(argv: readonly string[]): CliArgs | { error: string } {
	let edition: string | null = null;
	let derivativeRoot = join(process.cwd(), 'aim');
	let help = false;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg.startsWith('--edition=')) edition = arg.slice('--edition='.length);
		else if (arg.startsWith('--out=')) derivativeRoot = arg.slice('--out='.length);
		else return { error: `unknown argument: ${arg}` };
	}

	return { edition, derivativeRoot, help };
}

/**
 * CLI entry point. Returns exit code. Never throws on user-facing errors;
 * unexpected exceptions propagate.
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

	if (parsed.edition === null) {
		process.stderr.write(`aim-corpus-ingest: --edition= required\n${USAGE}`);
		return 2;
	}
	if (!EDITION_PATTERN.test(parsed.edition)) {
		process.stderr.write(
			`aim-corpus-ingest: --edition must be in YYYY-MM form (e.g. 2026-09); got "${parsed.edition}"\n`,
		);
		return 2;
	}

	const report = await runAimIngest({
		edition: parsed.edition,
		derivativeRoot: parsed.derivativeRoot,
	});

	process.stdout.write(
		`aim-corpus-ingest: edition=${report.edition}\n` +
			`  entriesIngested=${report.entriesIngested} alreadyAccepted=${report.entriesAlreadyAccepted}\n` +
			`  promotionBatchId=${report.promotionBatchId ?? '(none)'}\n` +
			`  manifest=${report.manifestPath}\n`,
	);
	return 0;
}
