/**
 * Phase 6 -- handbook corpus ingestion orchestration.
 *
 * Source of truth: ADR 019 §2.4 (atomic batch promotion), §2.6 (registry
 * population), and the WP at `docs/work-packages/reference-handbook-ingestion/`.
 *
 * Unlike Phase 3 (`regs`), this phase does NOT fetch source bytes or extract
 * derivatives -- ADR 016 phase 0 (PR #242) already did that. Phase 6 walks the
 * existing on-disk manifest and emits one `SourceEntry` per chapter, section,
 * and subsection. Idempotent: re-running with the same `--doc=` + `--edition=`
 * is a no-op.
 *
 * Steps:
 *
 *   1. Load the manifest at `<derivativeRoot>/<doc>/<faaDir>/manifest.json`.
 *   2. Walk `manifest.sections[]`, building one `SourceEntry` per record.
 *   3. Insert entries into the active `SOURCES` table; insert edition into `EDITIONS`.
 *   4. Record atomic batch promotion `pending -> accepted` under
 *      `PHASE_6_REVIEWER_ID`. Skip when entries are already accepted.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, recordPromotion } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { type ManifestFile, type ManifestSection, readManifest } from './derivative-reader.ts';
import { HANDBOOK_DOC_SLUGS } from './locator.ts';
import { HANDBOOK_DOC_EDITIONS } from './resolver.ts';

export const PHASE_6_REVIEWER_ID = 'phase-6-handbook-ingestion';

/**
 * Per-doc display titles for canonical_short / canonical_formal. Adding a new
 * handbook means adding here AND extending `HANDBOOK_DOC_SLUGS`,
 * `HANDBOOK_DOC_EDITIONS`, and `HANDBOOK_LIVE_URLS`.
 */
const DOC_DISPLAY: Record<string, { readonly short: string; readonly formal: string }> = {
	phak: {
		short: 'PHAK',
		formal: "Pilot's Handbook of Aeronautical Knowledge",
	},
	afh: {
		short: 'AFH',
		formal: 'Airplane Flying Handbook',
	},
	avwx: {
		short: 'AvWX',
		formal: 'Aviation Weather Handbook',
	},
};

export interface IngestOneHandbookArgs {
	readonly doc: string;
	/** Short edition slug, e.g. `'8083-25C'`. */
	readonly edition: string;
	/** Path to the directory containing per-doc derivative trees (default `<cwd>/handbooks`). */
	readonly derivativeRoot: string;
}

export interface IngestReport {
	readonly doc: string;
	readonly edition: string;
	readonly entriesIngested: number;
	readonly entriesAlreadyAccepted: number;
	readonly promotionBatchId: string | null;
	readonly manifestPath: string;
}

function faaDirFor(doc: string, edition: string): string | null {
	const docMap = HANDBOOK_DOC_EDITIONS[doc];
	if (docMap === undefined) return null;
	return docMap[edition] ?? null;
}

/**
 * Build canonical_short / canonical_formal / canonical_title for one
 * manifest section. Pure function; no registry mutation.
 */
function buildEntry(args: {
	readonly doc: string;
	readonly edition: string;
	readonly faaDir: string;
	readonly section: ManifestSection;
	readonly publishedDate: Date;
}): SourceEntry {
	const { doc, edition, faaDir, section, publishedDate } = args;
	const display = DOC_DISPLAY[doc];
	if (display === undefined) {
		throw new Error(`unknown handbook doc slug: ${doc}`);
	}

	const id = idForSection(doc, edition, section) as SourceId;

	// Build the citation strings. The dotted code maps directly to "Ch.X" /
	// "Ch.X.Y" / "Ch.X.Y.Z".
	const codeShort = `Ch.${section.code}`;
	const canonical_short = `${display.short} ${codeShort}`;

	// Formal: "Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C), Chapter 12, Section 3"
	const canonical_formal = buildFormalCitation(display.formal, faaDir, section);

	const canonical_title = section.title;

	return {
		id,
		corpus: 'handbooks',
		canonical_short,
		canonical_formal,
		canonical_title,
		last_amended_date: publishedDate,
		lifecycle: 'pending',
	};
}

function buildFormalCitation(docFormal: string, faaDir: string, section: ManifestSection): string {
	const parts = section.code.split('.');
	const chapterN = parts[0];
	const sectionN = parts[1];
	const subsectionN = parts[2];
	const suffix: string[] = [];
	if (chapterN !== undefined) suffix.push(`Chapter ${chapterN}`);
	if (sectionN !== undefined) suffix.push(`Section ${sectionN}`);
	if (subsectionN !== undefined) suffix.push(`Subsection ${subsectionN}`);
	return `${docFormal} (${faaDir}), ${suffix.join(', ')}`;
}

function idForSection(doc: string, edition: string, section: ManifestSection): string {
	// Manifest code is dotted: '12' / '12.3' / '12.3.2'. Locator uses slashes.
	const path = section.code.replace(/\./g, '/');
	return `airboss-ref:handbooks/${doc}/${edition}/${path}`;
}

/**
 * Run a single-handbook ingestion. Idempotent: re-running with the same args
 * skips entries already in `accepted` lifecycle and records no promotion
 * batch.
 */
export async function runHandbookIngest(args: IngestOneHandbookArgs): Promise<IngestReport> {
	const faaDir = faaDirFor(args.doc, args.edition);
	if (faaDir === null) {
		throw new Error(
			`handbook ingest: unknown doc/edition combination ${args.doc}/${args.edition}; ` +
				'extend HANDBOOK_DOC_EDITIONS in libs/sources/src/handbooks/resolver.ts',
		);
	}

	const manifestPath = join(args.derivativeRoot, args.doc, faaDir, 'manifest.json');
	if (!existsSync(manifestPath)) {
		throw new Error(`handbook ingest: manifest not found at ${manifestPath}`);
	}

	const manifest: ManifestFile = readManifest(faaDir, args.derivativeRoot, args.doc);
	if (manifest.document_slug !== args.doc) {
		throw new Error(
			`handbook ingest: manifest document_slug "${manifest.document_slug}" does not match arg "${args.doc}"`,
		);
	}

	const publishedDate = new Date(manifest.fetched_at);
	if (Number.isNaN(publishedDate.getTime())) {
		throw new Error(`handbook ingest: manifest fetched_at "${manifest.fetched_at}" is not a valid date`);
	}

	// Build entries
	const entries: SourceEntry[] = manifest.sections.map((section) =>
		buildEntry({ doc: args.doc, edition: args.edition, faaDir, section, publishedDate }),
	);

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
			corpus: 'handbooks',
			reviewerId: PHASE_6_REVIEWER_ID,
			scope: scopeIds,
			inputSource: manifestPath,
			targetLifecycle: 'accepted',
		});
		if (!result.ok) {
			throw new Error(`handbook ingest batch promotion failed: ${result.error}`);
		}
		promotionBatchId = result.batch.id;
	}

	return {
		doc: args.doc,
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
  bun run handbook-corpus-ingest --doc=<phak|afh|avwx> --edition=<8083-25C|...> [--out=<path>]
  bun run handbook-corpus-ingest --help
`;

export interface CliArgs {
	readonly doc: string | null;
	readonly edition: string | null;
	readonly derivativeRoot: string;
	readonly help: boolean;
}

export function parseCliArgs(argv: readonly string[]): CliArgs | { error: string } {
	let doc: string | null = null;
	let edition: string | null = null;
	let derivativeRoot = join(process.cwd(), 'handbooks');
	let help = false;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg.startsWith('--doc=')) doc = arg.slice('--doc='.length);
		else if (arg.startsWith('--edition=')) edition = arg.slice('--edition='.length);
		else if (arg.startsWith('--out=')) derivativeRoot = arg.slice('--out='.length);
		else return { error: `unknown argument: ${arg}` };
	}

	return { doc, edition, derivativeRoot, help };
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

	if (parsed.doc === null) {
		process.stderr.write(`handbook-corpus-ingest: --doc= required\n${USAGE}`);
		return 2;
	}
	if (!HANDBOOK_DOC_SLUGS.includes(parsed.doc)) {
		process.stderr.write(
			`handbook-corpus-ingest: --doc must be one of ${HANDBOOK_DOC_SLUGS.join(', ')}; got "${parsed.doc}"\n`,
		);
		return 2;
	}
	if (parsed.edition === null) {
		process.stderr.write(`handbook-corpus-ingest: --edition= required\n${USAGE}`);
		return 2;
	}

	const report = await runHandbookIngest({
		doc: parsed.doc,
		edition: parsed.edition,
		derivativeRoot: parsed.derivativeRoot,
	});

	process.stdout.write(
		`handbook-corpus-ingest: doc=${report.doc} edition=${report.edition}\n` +
			`  entriesIngested=${report.entriesIngested} alreadyAccepted=${report.entriesAlreadyAccepted}\n` +
			`  promotionBatchId=${report.promotionBatchId ?? '(none)'}\n` +
			`  manifest=${report.manifestPath}\n`,
	);
	return 0;
}
