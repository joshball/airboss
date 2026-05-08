#!/usr/bin/env bun
/**
 * Export `hangar.ingest_override` rows to per-source YAML sidecars.
 *
 * Usage:
 *   bun scripts/ingest-review/export-overrides.ts
 *   bun scripts/ingest-review/export-overrides.ts --corpus handbook
 *   bun scripts/ingest-review/export-overrides.ts --corpus handbook --source ifh
 *   bun scripts/ingest-review/export-overrides.ts --dry-run
 *
 * Idempotent. Two consecutive runs produce byte-identical files.
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPlugin, listOverridesWithIssues } from '@ab/bc-ingest-review/server';
import { CORPUS_VALUES, type Corpus, INGEST_REVIEW } from '@ab/constants';
import { serializeSidecar } from './yaml-sidecar';

interface CliOptions {
	corpus?: Corpus;
	source?: string;
	dryRun: boolean;
	repoRoot: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
	const opts: CliOptions = { dryRun: false, repoRoot: process.cwd() };
	for (const arg of argv) {
		if (arg === '--dry-run') {
			opts.dryRun = true;
			continue;
		}
		const eq = arg.indexOf('=');
		if (eq < 0) continue;
		const key = arg.slice(0, eq);
		const value = arg.slice(eq + 1);
		switch (key) {
			case '--corpus':
				if (!(CORPUS_VALUES as readonly string[]).includes(value)) {
					throw new Error(`unknown corpus '${value}'; allowed: ${CORPUS_VALUES.join(', ')}`);
				}
				opts.corpus = value as Corpus;
				break;
			case '--source':
				opts.source = value;
				break;
			case '--repo-root':
				opts.repoRoot = value;
				break;
		}
	}
	return opts;
}

async function main(): Promise<number> {
	const opts = parseArgs(process.argv.slice(2));
	const filter: { corpus?: Corpus; sourceId?: string } = {};
	if (opts.corpus !== undefined) filter.corpus = opts.corpus;
	if (opts.source !== undefined) filter.sourceId = opts.source;
	const rows = await listOverridesWithIssues(filter);

	// Group by (corpus, sourceId, edition). One sidecar per source.
	type Bucket = {
		corpus: Corpus;
		sourceId: string;
		edition: string | null;
		entries: ReturnType<typeof serializeSidecar> extends never
			? never
			: Parameters<typeof serializeSidecar>[0]['overrides'][number][];
	};
	const buckets = new Map<string, Bucket>();
	for (const { issue, override } of rows) {
		const key = `${issue.corpus}::${issue.sourceId}::${issue.edition ?? ''}`;
		let bucket = buckets.get(key);
		if (!bucket) {
			bucket = { corpus: issue.corpus, sourceId: issue.sourceId, edition: issue.edition, entries: [] };
			buckets.set(key, bucket);
		}
		const plugin = getPlugin(issue.kind);
		const yamlEntry = plugin.serializeForYaml(issue, override);
		bucket.entries.push(yamlEntry);
	}

	const writes: Array<{ filePath: string; bytes: string }> = [];
	for (const bucket of buckets.values()) {
		const dir = sidecarDir(opts.repoRoot, bucket.corpus);
		const filename = `${bucket.sourceId}-overrides.yaml`;
		const filePath = path.join(dir, filename);
		const bytes = serializeSidecar({
			slug: bucket.sourceId,
			edition: bucket.edition,
			overrides: bucket.entries,
		});
		writes.push({ filePath, bytes });
	}
	writes.sort((a, b) => a.filePath.localeCompare(b.filePath));

	if (writes.length === 0) {
		console.log('export-overrides: no overrides to export');
		return 0;
	}

	for (const { filePath, bytes } of writes) {
		if (opts.dryRun) {
			console.log(`(dry-run) would write ${path.relative(opts.repoRoot, filePath)} (${bytes.length} bytes)`);
		} else {
			await writeFile(filePath, bytes, 'utf8');
			console.log(`wrote ${path.relative(opts.repoRoot, filePath)} (${bytes.length} bytes)`);
		}
	}
	return 0;
}

function sidecarDir(repoRoot: string, corpus: Corpus): string {
	switch (corpus) {
		case INGEST_REVIEW.CORPUSES.HANDBOOK:
			return path.join(repoRoot, 'scripts', 'sources', 'config', 'handbooks');
		case INGEST_REVIEW.CORPUSES.REGS:
			return path.join(repoRoot, 'scripts', 'sources', 'config', 'regs');
		case INGEST_REVIEW.CORPUSES.KNOWLEDGE:
			return path.join(repoRoot, 'scripts', 'sources', 'config', 'knowledge');
		default: {
			const exhaustive: never = corpus;
			throw new Error(`no sidecar dir mapping for corpus ${exhaustive as string}`);
		}
	}
}

main().then(
	(code) => process.exit(code),
	(err) => {
		console.error(err instanceof Error ? (err.stack ?? err.message) : err);
		process.exit(1);
	},
);

export { main as exportOverridesMain, sidecarDir };
