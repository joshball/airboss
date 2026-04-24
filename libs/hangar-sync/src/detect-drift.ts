/**
 * Drift detection: compare DB-derived TOML to the on-disk TOML bodies and
 * surface which rows / files have changed.
 *
 * The DB is authoritative during an edit session (optimistic lock on `rev`,
 * transactional writes). The TOML is authoritative on disk between syncs.
 * Drift is the intersection: rows flagged `dirty` by the UI or rows where
 * DB state happens to differ from the TOML for any other reason.
 */

import { readFile } from 'node:fs/promises';
import type { Reference, Source } from '@ab/aviation';
import { encodeReferences, encodeSources } from '@ab/aviation';
import { GLOSSARY_TOML_PATH, SOURCES_TOML_PATH } from './paths';
import type { DriftEntry, DriftReport } from './types';

/**
 * Per-entity flags so `detectDrift` can tag each row.
 *
 * `dirty` comes straight from the DB column; `differsOnDisk` is computed
 * by re-emitting and diffing against the saved TOML. A row can be dirty
 * without differing (an edit that was reverted before sync) or differ
 * without being dirty (rare -- indicates an out-of-band write).
 */
export interface DriftInputRow<K extends 'reference' | 'source'> {
	kind: K;
	id: string;
	dirty: boolean;
}

export interface DriftInputs {
	references: readonly Reference[];
	sources: readonly Source[];
	/** Dirty flags + ids keyed by kind. Usually 1:1 with `references` / `sources`. */
	rows: {
		references: readonly DriftInputRow<'reference'>[];
		sources: readonly DriftInputRow<'source'>[];
	};
}

export interface DriftOptions {
	/** Absolute path to glossary.toml. Overridable for tests. */
	glossaryPath?: string;
	/** Absolute path to sources.toml. Overridable for tests. */
	sourcesPath?: string;
	/**
	 * Pluggable reader so tests can bypass the filesystem. Returns the file
	 * body, or `null` if missing.
	 */
	readFile?: (path: string) => Promise<string | null>;
}

/**
 * Per-reference TOML body -- used to tell which individual row drifted. We
 * encode each reference alone so the comparison is row-scoped, not
 * file-scoped (otherwise a single drift would flag every row as changed
 * due to the file-level separator).
 */
function perReferenceBody(reference: Reference): string {
	return encodeReferences([reference]);
}

function perSourceBody(source: Source): string {
	return encodeSources([source]);
}

function parseReferencesFromToml(body: string): Map<string, string> {
	// Split on `[[reference]]` array-of-tables markers. Each block is
	// self-contained; `encodeReferences` emits a blank line between them.
	const map = new Map<string, string>();
	const blocks = splitBlocks(body, '[[reference]]');
	for (const block of blocks) {
		const id = extractId(block);
		if (id !== null) map.set(id, `${block}\n`);
	}
	return map;
}

function parseSourcesFromToml(body: string): Map<string, string> {
	const map = new Map<string, string>();
	const blocks = splitBlocks(body, '[[source]]');
	for (const block of blocks) {
		const id = extractId(block);
		if (id !== null) map.set(id, `${block}\n`);
	}
	return map;
}

function splitBlocks(body: string, header: string): string[] {
	const lines = body.split('\n');
	const out: string[] = [];
	let current: string[] | null = null;
	for (const line of lines) {
		if (line === header) {
			if (current !== null) out.push(current.join('\n').replace(/\n+$/, ''));
			current = [line];
		} else if (current !== null) {
			current.push(line);
		}
	}
	if (current !== null) out.push(current.join('\n').replace(/\n+$/, ''));
	return out;
}

function extractId(block: string): string | null {
	const match = block.match(/^id = "([^"]+)"/m);
	return match ? (match[1] ?? null) : null;
}

async function defaultReadFile(path: string): Promise<string | null> {
	try {
		return await readFile(path, 'utf8');
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw err;
	}
}

/**
 * Compare DB-derived emissions against on-disk TOML. Returns one entry per
 * row marked `dirty` or whose per-row emission differs from disk, plus the
 * set of files whose whole body needs rewriting.
 */
export async function detectDrift(inputs: DriftInputs, options: DriftOptions = {}): Promise<DriftReport> {
	const glossaryPath = options.glossaryPath ?? GLOSSARY_TOML_PATH;
	const sourcesPath = options.sourcesPath ?? SOURCES_TOML_PATH;
	const read = options.readFile ?? defaultReadFile;

	const [currentGlossary, currentSources] = await Promise.all([read(glossaryPath), read(sourcesPath)]);
	const glossaryOnDisk = currentGlossary ? parseReferencesFromToml(currentGlossary) : new Map<string, string>();
	const sourcesOnDisk = currentSources ? parseSourcesFromToml(currentSources) : new Map<string, string>();

	const entries: DriftEntry[] = [];
	const changedFiles = new Set<string>();

	// Build id -> domain object lookups for fast access.
	const refsById = new Map(inputs.references.map((r) => [r.id, r]));
	const srcsById = new Map(inputs.sources.map((s) => [s.id, s]));

	for (const row of inputs.rows.references) {
		const ref = refsById.get(row.id);
		if (!ref) continue;
		const nextBody = perReferenceBody(ref);
		const onDisk = glossaryOnDisk.get(row.id);
		const differs = onDisk !== nextBody;
		if (row.dirty || differs) {
			entries.push({ kind: 'reference', id: row.id, dirty: row.dirty, differsOnDisk: differs });
			if (differs) changedFiles.add(glossaryPath);
		}
	}

	for (const row of inputs.rows.sources) {
		const src = srcsById.get(row.id);
		if (!src) continue;
		const nextBody = perSourceBody(src);
		const onDisk = sourcesOnDisk.get(row.id);
		const differs = onDisk !== nextBody;
		if (row.dirty || differs) {
			entries.push({ kind: 'source', id: row.id, dirty: row.dirty, differsOnDisk: differs });
			if (differs) changedFiles.add(sourcesPath);
		}
	}

	// Also catch id-level drift: ids present on disk but missing from inputs
	// (rare -- indicates the DB was reset or an id was soft-deleted). File-
	// level write is still required if we want the on-disk id gone.
	for (const id of glossaryOnDisk.keys()) {
		if (!refsById.has(id)) changedFiles.add(glossaryPath);
	}
	for (const id of sourcesOnDisk.keys()) {
		if (!srcsById.has(id)) changedFiles.add(sourcesPath);
	}

	return { entries, files: [...changedFiles].sort() };
}
