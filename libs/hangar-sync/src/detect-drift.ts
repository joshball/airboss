/**
 * Drift detection: compare DB-derived domain objects to the on-disk TOML
 * (decoded back into domain objects) and surface which rows / files have
 * changed.
 *
 * The DB is authoritative during an edit session (optimistic lock on `rev`,
 * transactional writes). The TOML is authoritative on disk between syncs.
 * Drift is the intersection: rows flagged `dirty` by the UI or rows where
 * DB state happens to differ from the TOML for any other reason.
 *
 * Comparison is **semantic**, not textual. We decode the on-disk TOML into
 * `Reference` / `Source` objects and deep-equal against the in-memory
 * domain objects. A whitespace-only diff (extra blank line, trailing
 * spaces, BOM, CRLF vs LF) decodes to the same shape and is correctly
 * reported as "no drift". The previous string-compare on serialised
 * output flagged benign codec drift as conflict, which produced spurious
 * sync runs.
 *
 * Soft-deleted rows surface here too: `deletedIds` lists ids that exist
 * in the DB with `deleted_at` set, so the on-disk file can be flagged
 * for rewrite (the row gets removed). Without this the deletion stays
 * invisible -- `loadState` filters soft-deleted rows out, so their ids
 * never reach the per-row drift loop and the file stays orphaned.
 */

import { readFile } from 'node:fs/promises';
import type { Reference, Source } from '@ab/aviation';
import { decodeReferences, decodeSources } from '@ab/aviation';
import { GLOSSARY_TOML_PATH, SOURCES_TOML_PATH } from './paths';
import type { DriftEntry, DriftReport } from './types';

/**
 * Per-entity flags so `detectDrift` can tag each row.
 *
 * `dirty` comes straight from the DB column; `differsOnDisk` is computed
 * by deep-equalling the in-memory domain object against the on-disk
 * decoded object. A row can be dirty without differing (an edit that was
 * reverted before sync) or differ without being dirty (rare -- indicates
 * an out-of-band write).
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
	/**
	 * Ids of rows present in the DB but soft-deleted (`deleted_at` is non-null).
	 * Surfaced separately because `loadState` filters them out of `references` /
	 * `sources` -- without this the on-disk file would keep the orphan id and
	 * the sync would noop. Optional for back-compat with callers that don't
	 * track soft-deletes.
	 */
	deletedIds?: {
		references?: readonly string[];
		sources?: readonly string[];
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
 * Recursive deep-equal over JSON-shaped values. Object keys are
 * canonicalised (sorted) so field-order drift in on-disk TOML cannot be
 * read as a "real" diff. Arrays are order-sensitive (the TOML decoder
 * preserves source order, so a reordered citation list is genuine drift
 * worth surfacing).
 */
function deepEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;
	if (typeof a !== 'object') return false;

	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return false;
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEqual(a[i], b[i])) return false;
		}
		return true;
	}

	const ar = a as Record<string, unknown>;
	const br = b as Record<string, unknown>;
	const ak = Object.keys(ar).sort();
	const bk = Object.keys(br).sort();
	if (ak.length !== bk.length) return false;
	for (let i = 0; i < ak.length; i++) {
		if (ak[i] !== bk[i]) return false;
	}
	for (const k of ak) {
		if (!deepEqual(ar[k], br[k])) return false;
	}
	return true;
}

/**
 * Decode a TOML body into an id-keyed map of `Reference` objects. Returns
 * an empty map when the body is empty or unparseable; an unparseable
 * on-disk body is itself drift (the file needs to be rewritten by the
 * sync), so the loss-of-fidelity here is intentional.
 */
function parseReferencesById(body: string | null): Map<string, Reference> {
	const out = new Map<string, Reference>();
	if (!body?.trim()) return out;
	try {
		for (const ref of decodeReferences(body)) {
			out.set(ref.id, ref);
		}
	} catch {
		// Malformed on-disk TOML: treat every id as drifted by returning
		// an empty map (so every in-memory row reports `differsOnDisk`
		// and the file is queued for rewrite).
	}
	return out;
}

function parseSourcesById(body: string | null): Map<string, Source> {
	const out = new Map<string, Source>();
	if (!body?.trim()) return out;
	try {
		for (const src of decodeSources(body)) {
			out.set(src.id, src);
		}
	} catch {
		// See parseReferencesById -- malformed TOML degrades to "all drift".
	}
	return out;
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
 * Compare DB-derived domain objects against on-disk decoded domain
 * objects. Returns one entry per row marked `dirty` or whose decoded
 * shape differs from disk, plus the set of files whose whole body needs
 * rewriting.
 *
 * The `files` set also picks up:
 *   - on-disk ids missing from the live DB and not tracked as soft-deletes
 *     (out-of-band write or hard-deleted DB row);
 *   - on-disk ids whose tombstone exists in `deletedIds` (the sync needs
 *     to rewrite the file without that row).
 */
export async function detectDrift(inputs: DriftInputs, options: DriftOptions = {}): Promise<DriftReport> {
	const glossaryPath = options.glossaryPath ?? GLOSSARY_TOML_PATH;
	const sourcesPath = options.sourcesPath ?? SOURCES_TOML_PATH;
	const read = options.readFile ?? defaultReadFile;

	const [currentGlossary, currentSources] = await Promise.all([read(glossaryPath), read(sourcesPath)]);
	const glossaryOnDisk = parseReferencesById(currentGlossary);
	const sourcesOnDisk = parseSourcesById(currentSources);

	const entries: DriftEntry[] = [];
	const changedFiles = new Set<string>();

	const refsById = new Map(inputs.references.map((r) => [r.id, r]));
	const srcsById = new Map(inputs.sources.map((s) => [s.id, s]));
	const deletedRefIds = new Set(inputs.deletedIds?.references ?? []);
	const deletedSourceIds = new Set(inputs.deletedIds?.sources ?? []);

	for (const row of inputs.rows.references) {
		const ref = refsById.get(row.id);
		if (!ref) continue;
		const onDisk = glossaryOnDisk.get(row.id);
		const differs = onDisk === undefined || !deepEqual(ref, onDisk);
		if (row.dirty || differs) {
			entries.push({ kind: 'reference', id: row.id, dirty: row.dirty, differsOnDisk: differs });
			if (differs) changedFiles.add(glossaryPath);
		}
	}

	for (const row of inputs.rows.sources) {
		const src = srcsById.get(row.id);
		if (!src) continue;
		const onDisk = sourcesOnDisk.get(row.id);
		const differs = onDisk === undefined || !deepEqual(src, onDisk);
		if (row.dirty || differs) {
			entries.push({ kind: 'source', id: row.id, dirty: row.dirty, differsOnDisk: differs });
			if (differs) changedFiles.add(sourcesPath);
		}
	}

	// File-level drift: ids present on disk but missing from the live DB.
	// A soft-deleted id is expected to disappear, so its presence on disk
	// also forces a file rewrite. An id that's neither live nor soft-deleted
	// is an out-of-band insert (DB was reset, manual SQL, etc.) -- still
	// flag the file as drifted so the next sync rewrites it from DB truth.
	for (const id of glossaryOnDisk.keys()) {
		if (!refsById.has(id)) changedFiles.add(glossaryPath);
	}
	for (const id of sourcesOnDisk.keys()) {
		if (!srcsById.has(id)) changedFiles.add(sourcesPath);
	}
	// Surface soft-deletes as drift entries too, so callers (and the audit
	// metadata) see exactly which ids the sync is removing -- not just "the
	// file changed". Skip ids that aren't actually on disk (deletion already
	// happened).
	for (const id of deletedRefIds) {
		if (glossaryOnDisk.has(id)) {
			entries.push({ kind: 'reference', id, dirty: true, differsOnDisk: true });
			changedFiles.add(glossaryPath);
		}
	}
	for (const id of deletedSourceIds) {
		if (sourcesOnDisk.has(id)) {
			entries.push({ kind: 'source', id, dirty: true, differsOnDisk: true });
			changedFiles.add(sourcesPath);
		}
	}

	return { entries, files: [...changedFiles].sort() };
}
