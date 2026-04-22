#!/usr/bin/env bun
/**
 * Reference extractor.
 *
 * Pipeline step 2 (architecture doc "Step 2: extract per source"). Reads
 * the scanner manifest, joins it against the reference registry, routes
 * each id to the first matching `SourceExtractor`, and writes the
 * `libs/aviation/src/references/<source-type>-generated.ts` files.
 *
 * CLI:
 *   bun scripts/references/extract.ts                    Extract everything in the manifest.
 *   bun scripts/references/extract.ts --id cfr-14-91-155 Extract a single id.
 *   bun scripts/references/extract.ts --source cfr       Extract every id whose registered source is type=cfr.
 *   bun scripts/references/extract.ts --dry-run          Do not write; print what would change.
 *
 * Warn-and-continue (exit 0) when:
 *   - The manifest is empty (nothing to do).
 *   - A registered source binary is not on disk at its `path`.
 *
 * Fail (exit non-zero) when:
 *   - An extractor throws a non-missing-file error.
 *   - Multiple extractors claim `canHandle(sourceId)`.
 *   - An extractor returns a malformed VerbatimBlock.
 *   - One or more per-id extractions failed (partial success still writes the good ones).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
	AVIATION_REFERENCES,
	getSource,
	type Reference,
	SOURCES,
	type SourceCitation,
	type VerbatimBlock,
} from '@ab/aviation';
import { resolveExtractors } from '@ab/aviation/sources';
import { type ScanManifest, scanContent } from './scan';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

export interface ExtractOptions {
	idFilter?: string;
	sourceTypeFilter?: string;
	dryRun?: boolean;
	/** When provided, use this manifest instead of re-scanning. */
	manifest?: ScanManifest;
	/** When provided, use this reference list instead of AVIATION_REFERENCES. */
	references?: readonly Reference[];
}

export interface ExtractResult {
	/** For each source type, the id->VerbatimBlock map that would be written. */
	perSourceType: Record<string, Record<string, VerbatimBlock>>;
	/** Per-id errors collected during the run. */
	errors: { id: string; reason: string }[];
	/** Per-id warnings collected during the run. */
	warnings: { id: string; reason: string }[];
	/** Ids successfully extracted. */
	extracted: string[];
	/** Ids skipped (missing source, no reference, etc.). */
	skipped: { id: string; reason: string }[];
}

function isValidVerbatim(v: unknown): v is VerbatimBlock {
	if (!v || typeof v !== 'object') return false;
	const o = v as Record<string, unknown>;
	return typeof o.text === 'string' && typeof o.sourceVersion === 'string' && typeof o.extractedAt === 'string';
}

export async function runExtract(options: ExtractOptions = {}): Promise<ExtractResult> {
	const manifest = options.manifest ?? scanContent().manifest;
	const references = options.references ?? AVIATION_REFERENCES;
	const referenceById = new Map(references.map((r) => [r.id, r] as const));

	const result: ExtractResult = {
		perSourceType: {},
		errors: [],
		warnings: [],
		extracted: [],
		skipped: [],
	};

	if (manifest.references.length === 0) {
		result.warnings.push({ id: '-', reason: 'manifest is empty; nothing to extract' });
		return result;
	}

	let candidateIds = manifest.references.map((m) => m.id);
	if (options.idFilter) {
		candidateIds = candidateIds.filter((id) => id === options.idFilter);
	}

	for (const id of candidateIds) {
		const ref = referenceById.get(id);
		if (!ref) {
			result.skipped.push({ id, reason: 'no Reference registered with this id' });
			continue;
		}
		if (ref.sources.length === 0) {
			result.skipped.push({ id, reason: 'Reference has no sources[] citation' });
			continue;
		}

		// Use first citation for extraction; additional citations are references
		// to additional regs and are out of scope for the primary verbatim block.
		const citation = ref.sources[0] as SourceCitation;
		const source = getSource(citation.sourceId);
		if (!source) {
			result.errors.push({ id, reason: `sourceId '${citation.sourceId}' not in registry` });
			continue;
		}
		if (options.sourceTypeFilter && source.type !== options.sourceTypeFilter) {
			continue;
		}

		const extractors = resolveExtractors(citation.sourceId);
		if (extractors.length === 0) {
			result.errors.push({ id, reason: `no extractor handles '${citation.sourceId}'` });
			continue;
		}
		if (extractors.length > 1) {
			result.errors.push({
				id,
				reason: `multiple extractors claim '${citation.sourceId}' (${extractors.length})`,
			});
			continue;
		}
		const extractor = extractors[0];
		if (!extractor) continue;

		const sourcePath = resolve(REPO_ROOT, source.path);
		if (!existsSync(sourcePath)) {
			result.warnings.push({
				id,
				reason: `source binary absent at '${source.path}' (skipping ${id})`,
			});
			result.skipped.push({ id, reason: 'source binary absent' });
			continue;
		}

		try {
			const block = await extractor.extract(citation.locator, sourcePath);
			if (!isValidVerbatim(block)) {
				result.errors.push({
					id,
					reason: `extractor returned malformed VerbatimBlock (missing required field)`,
				});
				continue;
			}
			const bucket = result.perSourceType[source.type] ?? {};
			bucket[id] = block;
			result.perSourceType[source.type] = bucket;
			result.extracted.push(id);
		} catch (err) {
			result.errors.push({ id, reason: err instanceof Error ? err.message : String(err) });
		}
	}

	if (!options.dryRun) {
		for (const [sourceType, blocks] of Object.entries(result.perSourceType)) {
			mergeAndWrite(sourceType, blocks, { idFilter: options.idFilter });
		}
	}

	return result;
}

export function generatedFilePath(sourceType: string): string {
	return resolve(REPO_ROOT, 'libs', 'aviation', 'src', 'references', `${sourceType}-generated.ts`);
}

export function readExistingGenerated(sourceType: string): Record<string, VerbatimBlock> {
	const path = generatedFilePath(sourceType);
	if (!existsSync(path)) return {};
	const src = readFileSync(path, 'utf8');
	// Try to parse the exported object literal. We embed JSON in the TS file
	// (see `mergeAndWrite` below) so parsing is a matter of slicing between
	// the marker comments.
	const marker = /\/\/ GENERATED-BLOCKS-BEGIN([\s\S]*?)\/\/ GENERATED-BLOCKS-END/;
	const m = src.match(marker);
	if (!m?.[1]) return {};
	const jsonBody = m[1].trim();
	try {
		const parsed = JSON.parse(jsonBody) as Record<string, VerbatimBlock>;
		return parsed;
	} catch {
		return {};
	}
}

function mergeAndWrite(
	sourceType: string,
	newBlocks: Record<string, VerbatimBlock>,
	options: { idFilter?: string },
): void {
	const path = generatedFilePath(sourceType);
	mkdirSync(dirname(path), { recursive: true });

	// In single-id mode, preserve everything else; otherwise replace wholesale
	// (the manifest is the authoritative list of what should be present).
	let merged: Record<string, VerbatimBlock>;
	if (options.idFilter) {
		merged = { ...readExistingGenerated(sourceType), ...newBlocks };
	} else {
		merged = { ...newBlocks };
	}

	// Sort by id for a stable diff.
	const sortedKeys = Object.keys(merged).sort();
	const sorted: Record<string, VerbatimBlock> = {};
	for (const key of sortedKeys) {
		const v = merged[key];
		if (v !== undefined) sorted[key] = v;
	}

	const sourceTypeIdent = toIdentifier(sourceType);
	const body = JSON.stringify(sorted, null, '\t');
	const contents = `// GENERATED FILE -- do not edit by hand.
// Produced by \`scripts/references/extract.ts\`. See
// \`docs/work-packages/reference-extraction-pipeline/spec.md\`.

import type { VerbatimBlock } from '../schema/reference';

export const ${sourceTypeIdent}Verbatim: Record<string, VerbatimBlock> = // GENERATED-BLOCKS-BEGIN
${body}
// GENERATED-BLOCKS-END
;
`;
	writeFileSync(path, contents, 'utf8');
}

function toIdentifier(sourceType: string): string {
	return sourceType.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

// --------------------------------------------------------------------------
// CLI entry point.

function parseArgs(argv: readonly string[]): ExtractOptions {
	const opts: ExtractOptions = {};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--id') {
			const value = argv[i + 1];
			if (!value) throw new Error('--id requires a value');
			opts.idFilter = value;
			i += 1;
		} else if (arg === '--source') {
			const value = argv[i + 1];
			if (!value) throw new Error('--source requires a value');
			opts.sourceTypeFilter = value;
			i += 1;
		} else if (arg === '--dry-run') {
			opts.dryRun = true;
		} else if (arg === '--help' || arg === '-h') {
			console.log('Usage: bun scripts/references/extract.ts [--id <ref-id>] [--source <source-type>] [--dry-run]');
			process.exit(0);
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return opts;
}

if (import.meta.main) {
	const options = parseArgs(process.argv.slice(2));
	const result = await runExtract(options);

	for (const w of result.warnings) {
		console.log(`warn: ${w.id}: ${w.reason}`);
	}
	for (const s of result.skipped) {
		console.log(`skip: ${s.id}: ${s.reason}`);
	}
	for (const e of result.errors) {
		console.error(`error: ${e.id}: ${e.reason}`);
	}

	const perTypeCounts = Object.entries(result.perSourceType)
		.map(([t, b]) => `${t}=${Object.keys(b).length}`)
		.join(', ');
	console.log(
		`extract: ${result.extracted.length} extracted${perTypeCounts ? ` (${perTypeCounts})` : ''}, ${result.skipped.length} skipped, ${result.errors.length} errors, ${result.warnings.length} warnings${options.dryRun ? ' [dry-run]' : ''}.`,
	);

	// Touch SOURCES to suppress unused-import warnings on CI type-check runs;
	// the registry is imported so the module load warms caches.
	void SOURCES.length;

	if (result.errors.length > 0) {
		process.exit(1);
	}
}
