/**
 * JSON snapshot generator for non-TypeScript consumers.
 *
 * Source of truth: ADR 019 §2.5. Exposes a static + indexed-tier hash-map
 * of every entry the registry knows. Python RAG indexers, Lambda image
 * builders, and other non-TypeScript consumers read the snapshot file
 * instead of importing `@ab/sources` (which they can't).
 *
 * Snapshot is regenerated per environment, NOT committed. Default output
 * path is `data/sources-snapshot.json` (gitignored).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { getEditionsMap } from './registry/editions.ts';
import { getCurrentEdition } from './registry/query.ts';
import { getSources } from './registry/sources.ts';
import type { Edition, SourceEntry, SourceId } from './types.ts';

export const SNAPSHOT_VERSION = 1 as const;
export const DEFAULT_SNAPSHOT_PATH = 'data/sources-snapshot.json';

export interface SnapshotEntry {
	readonly entry: SourceEntry;
	readonly editions: readonly Edition[];
	readonly currentEdition: string | null;
}

export interface SnapshotShape {
	readonly version: typeof SNAPSHOT_VERSION;
	readonly generatedAt: string;
	readonly entries: Record<SourceId, SnapshotEntry>;
}

/**
 * Build an in-memory snapshot of the current registry state. Pure -- no
 * I/O. Used by `writeSnapshotSync` and tests.
 */
export function generateSnapshot(): SnapshotShape {
	const sources = getSources();
	const editionsMap = getEditionsMap();
	const entries: Record<string, SnapshotEntry> = {};
	for (const [id, entry] of Object.entries(sources) as readonly [SourceId, SourceEntry][]) {
		const editions = editionsMap.get(id) ?? [];
		const currentEdition = getCurrentEdition(entry.corpus);
		entries[id] = { entry, editions, currentEdition };
	}
	return {
		version: SNAPSHOT_VERSION,
		generatedAt: new Date().toISOString(),
		entries: entries as Record<SourceId, SnapshotEntry>,
	};
}

/**
 * Write the snapshot to `path` as JSON (2-space indent + trailing newline).
 * Creates intermediate directories if needed. `path` may be relative; if
 * relative, resolved against `cwd` (default: `process.cwd()`).
 */
export function writeSnapshotSync(path: string, cwd: string = process.cwd()): void {
	const abs = isAbsolute(path) ? path : join(cwd, path);
	mkdirSync(dirname(abs), { recursive: true });
	const snapshot = generateSnapshot();
	const json = `${JSON.stringify(snapshot, null, 2)}\n`;
	writeFileSync(abs, json, 'utf-8');
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

export interface SnapshotCliOptions {
	readonly out?: string;
	readonly cwd?: string;
}

interface ParsedCliArgs {
	readonly kind: 'ok';
	readonly out: string;
}

interface CliError {
	readonly kind: 'error';
	readonly message: string;
}

/**
 * Parse `args` for the `snapshot` subcommand. Recognised:
 *
 *   - `--out=<path>` -- output file path.
 *
 * Unknown args produce an error.
 */
export function parseSnapshotArgs(args: readonly string[]): ParsedCliArgs | CliError {
	let out = DEFAULT_SNAPSHOT_PATH;
	for (const arg of args) {
		if (arg.startsWith('--out=')) {
			const value = arg.slice('--out='.length);
			if (value.length === 0) {
				return { kind: 'error', message: '--out= requires a value' };
			}
			out = value;
			continue;
		}
		return { kind: 'error', message: `unknown argument: ${arg}` };
	}
	return { kind: 'ok', out };
}

/**
 * CLI entry: parses args, writes the snapshot, prints a summary line.
 * Exit code 0 on success; 2 on argument error.
 */
export function runSnapshotCli(args: readonly string[], opts: SnapshotCliOptions = {}): number {
	const parsed = parseSnapshotArgs(args);
	if (parsed.kind === 'error') {
		process.stderr.write(`snapshot: ${parsed.message}\n`);
		process.stderr.write('usage: bun scripts/airboss-ref.ts snapshot [--out=<path>]\n');
		return 2;
	}
	const out = opts.out ?? parsed.out;
	const cwd = opts.cwd ?? process.cwd();
	writeSnapshotSync(out, cwd);
	const snapshot = generateSnapshot();
	const entryCount = Object.keys(snapshot.entries).length;
	process.stdout.write(`snapshot: ${entryCount} entry(s) written to ${out}\n`);
	return 0;
}
