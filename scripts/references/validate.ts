#!/usr/bin/env bun
/**
 * Reference + content validator.
 *
 * Combines the two validation layers from @ab/aviation:
 *
 *   1) validateReferences(AVIATION_REFERENCES) -- schema + tag + related
 *      symmetry + verbatim/sources coherence gates.
 *   2) validateContentWikilinks(scan, registry) -- every
 *      `[[display::id]]` id in content resolves; broken links error,
 *      TBD-id links warn.
 *
 * Plus the extraction-pipeline gates added here:
 *
 *   3) Registry coherence -- every `Reference.sources[].sourceId` exists
 *      in SOURCES with a type matching the id prefix.
 *   4) Meta.json integrity -- for every source, if the binary is on disk,
 *      its sha256 matches Source.checksum; if the meta.json is present, it
 *      validates against SourceMeta and its checksum also matches.
 *   5) Generated-file freshness -- for every manifest id with a source
 *      citation, warn if no VerbatimBlock lives in the generated file.
 *
 * Exit code 1 on any error; exit 0 on clean or warnings-only. Output goes
 * to stdout + stderr.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	AVIATION_REFERENCES,
	getSource,
	hasReference,
	isSourceDownloaded,
	isSourceMeta,
	listReferences,
	metaPathFor,
	PENDING_DOWNLOAD,
	SOURCES,
	type Source,
	type VerbatimBlock,
	validateContentWikilinks,
	validateReferences,
} from '@ab/aviation';
import { readExistingGenerated } from './extract';
import { scanContent } from './scan';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

interface Issue {
	level: 'error' | 'warn';
	message: string;
	referenceId?: string;
	location?: string;
}

function print(issue: Issue): void {
	const pieces = [`${issue.level}:`, issue.message];
	if (issue.referenceId) pieces.push(`[ref:${issue.referenceId}]`);
	if (issue.location) pieces.push(`[${issue.location}]`);
	const line = pieces.join(' ');
	if (issue.level === 'error') console.error(line);
	else console.log(line);
}

// -------- layer 1/2: from @ab/aviation --------

const refResult = validateReferences(AVIATION_REFERENCES);

const { scans, manifest } = scanContent();
const contentResult = validateContentWikilinks(scans, {
	hasReference,
	knownIds: listReferences().map((r) => r.id),
});

const errors: Issue[] = [];
const warnings: Issue[] = [];

for (const e of refResult.errors) {
	errors.push({ level: 'error', message: e.message, referenceId: e.referenceId, location: e.location });
}
for (const w of refResult.warnings) {
	warnings.push({ level: 'warn', message: w.message, referenceId: w.referenceId, location: w.location });
}
for (const e of contentResult.errors) {
	errors.push({ level: 'error', message: e.message, referenceId: e.referenceId, location: e.location });
}
for (const w of contentResult.warnings) {
	warnings.push({ level: 'warn', message: w.message, referenceId: w.referenceId, location: w.location });
}

// -------- layer 3: registry coherence --------

// Every Source.id must be unique; every Source.path must be under data/sources/.
const seenSourceIds = new Set<string>();
for (const source of SOURCES) {
	if (seenSourceIds.has(source.id)) {
		errors.push({ level: 'error', message: `Duplicate Source.id '${source.id}' in registry` });
	}
	seenSourceIds.add(source.id);
	if (!source.path.startsWith('data/sources/')) {
		errors.push({
			level: 'error',
			message: `Source '${source.id}' path '${source.path}' must start with 'data/sources/'`,
		});
	}
	if (source.path.includes('..')) {
		errors.push({ level: 'error', message: `Source '${source.id}' path '${source.path}' contains '..'` });
	}
}

// Every Reference.sources[].sourceId must resolve in the registry and the
// type must match the id's source-type prefix convention.
for (const ref of AVIATION_REFERENCES) {
	for (const citation of ref.sources) {
		const source = getSource(citation.sourceId);
		if (!source) {
			errors.push({
				level: 'error',
				message: `'${citation.sourceId}' not in source registry`,
				referenceId: ref.id,
			});
			continue;
		}
		// id-prefix convention: id begins with source-type, e.g. 'cfr-14-91-155' -> cfr.
		const prefix = ref.id.split('-')[0];
		if (prefix && source.type !== prefix) {
			errors.push({
				level: 'error',
				message: `Reference id prefix '${prefix}' does not match source type '${source.type}' for sourceId '${citation.sourceId}'`,
				referenceId: ref.id,
			});
		}
	}
}

// -------- layer 4: meta.json integrity --------

const STALE_DOWNLOAD_MS = 13 * 30 * 24 * 60 * 60 * 1000;

for (const source of SOURCES) {
	const binaryPath = resolve(REPO_ROOT, source.path);
	const metaPath = resolve(REPO_ROOT, metaPathFor(source));
	const binaryPresent = existsSync(binaryPath);
	const metaPresent = existsSync(metaPath);

	if (!isSourceDownloaded(source)) {
		if (binaryPresent) {
			warnings.push({
				level: 'warn',
				message: `Source '${source.id}' is marked ${PENDING_DOWNLOAD} but binary is on disk at '${source.path}'; update registry`,
			});
		}
		// Nothing else to verify for pending sources.
		continue;
	}

	if (!binaryPresent) {
		warnings.push({
			level: 'warn',
			message: `source binary absent for ${source.id} at '${source.path}'`,
		});
	} else {
		const actualChecksum = sha256OfFile(binaryPath);
		if (actualChecksum !== source.checksum) {
			errors.push({
				level: 'error',
				message: `checksum mismatch for ${source.id}: expected ${source.checksum}, got ${actualChecksum}`,
			});
		}
	}

	if (!metaPresent) {
		warnings.push({
			level: 'warn',
			message: `meta.json absent for ${source.id} at '${metaPathFor(source)}'`,
		});
	} else {
		validateMetaFile(metaPath, source, binaryPresent ? binaryPath : null);
	}

	// Staleness warning.
	const downloadedAt = Date.parse(source.downloadedAt);
	if (!Number.isNaN(downloadedAt) && Date.now() - downloadedAt > STALE_DOWNLOAD_MS) {
		warnings.push({
			level: 'warn',
			message: `Source '${source.id}' downloadedAt ${source.downloadedAt} is > 13 months old; refresh due`,
		});
	}
}

function sha256OfFile(path: string): string {
	const buf = readFileSync(path);
	return createHash('sha256').update(buf).digest('hex');
}

function validateMetaFile(metaPath: string, source: Source, binaryPath: string | null): void {
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(metaPath, 'utf8'));
	} catch (err) {
		errors.push({
			level: 'error',
			message: `meta.json unparseable for ${source.id}: ${err instanceof Error ? err.message : String(err)}`,
		});
		return;
	}
	if (!isSourceMeta(parsed)) {
		errors.push({
			level: 'error',
			message: `meta.json for ${source.id} does not match SourceMeta schema`,
		});
		return;
	}
	if (parsed.sourceId !== source.id) {
		errors.push({
			level: 'error',
			message: `meta.json sourceId '${parsed.sourceId}' does not match registry id '${source.id}'`,
		});
	}
	if (parsed.checksum !== source.checksum) {
		errors.push({
			level: 'error',
			message: `meta.json checksum for ${source.id} does not match registry checksum`,
		});
	}
	if (binaryPath) {
		const actual = sha256OfFile(binaryPath);
		if (actual !== parsed.checksum) {
			errors.push({
				level: 'error',
				message: `meta.json checksum for ${source.id} does not match binary sha256 (meta=${parsed.checksum}, actual=${actual})`,
			});
		}
	}
}

// -------- layer 5: generated-file freshness --------

const manifestIds = new Set(manifest.references.map((m) => m.id));
const generatedByType = new Map<string, Record<string, VerbatimBlock>>();

for (const source of SOURCES) {
	if (!generatedByType.has(source.type)) {
		generatedByType.set(source.type, readExistingGenerated(source.type));
	}
}

for (const ref of AVIATION_REFERENCES) {
	if (!manifestIds.has(ref.id)) continue;
	const citation = ref.sources[0];
	if (!citation) continue;
	const source = getSource(citation.sourceId);
	if (!source) continue;
	const generated = generatedByType.get(source.type) ?? {};
	if (!generated[ref.id]) {
		warnings.push({
			level: 'warn',
			message: `verbatim pending extraction for ${ref.id} (no entry in ${source.type}-generated.ts)`,
			referenceId: ref.id,
		});
	}
}

// -------- output --------

for (const w of warnings) print(w);
if (errors.length > 0) {
	for (const e of errors) print(e);
	console.error(`\nreferences: ${errors.length} error(s), ${warnings.length} warning(s).`);
	process.exit(1);
}

console.log(
	`references: 0 errors, ${warnings.length} warning(s); scanned ${scans.length} content location(s), ${contentResult.summary.linkCount} wiki-link(s); ${SOURCES.length} source(s) registered.`,
);
