#!/usr/bin/env bun

/**
 * Run ingest-review producers against the in-tree handbook artifacts.
 *
 * Walks every plugin scoped to the requested corpus, calls
 * `produceIssues`, upserts issues into `hangar.ingest_issue`, then flips
 * disappeared issues to `stale`. One plugin's failure is captured and
 * logged; remaining plugins still run.
 *
 * Usage:
 *   bun scripts/ingest-review/run-producers.ts --corpus handbook
 *   bun scripts/ingest-review/run-producers.ts --corpus handbook --source ifh
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

import { runProducers } from '@ab/bc-ingest-review/server';
import { CORPUS_VALUES, type Corpus, INGEST_ISSUE_KIND_VALUES, type IngestIssueKind } from '@ab/constants';

interface CliOptions {
	corpus: Corpus;
	source?: string;
	kind?: IngestIssueKind;
	repoRoot: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
	let corpus: Corpus | undefined;
	let source: string | undefined;
	let kind: IngestIssueKind | undefined;
	let repoRoot = process.cwd();
	for (const arg of argv) {
		const eq = arg.indexOf('=');
		if (eq < 0) continue;
		const key = arg.slice(0, eq);
		const value = arg.slice(eq + 1);
		switch (key) {
			case '--corpus':
				if (!(CORPUS_VALUES as readonly string[]).includes(value)) {
					throw new Error(`unknown corpus '${value}'; allowed: ${CORPUS_VALUES.join(', ')}`);
				}
				corpus = value as Corpus;
				break;
			case '--source':
				source = value;
				break;
			case '--kind':
				if (!(INGEST_ISSUE_KIND_VALUES as readonly string[]).includes(value)) {
					throw new Error(`unknown kind '${value}'; allowed: ${INGEST_ISSUE_KIND_VALUES.join(', ')}`);
				}
				kind = value as IngestIssueKind;
				break;
			case '--repo-root':
				repoRoot = value;
				break;
		}
	}
	if (!corpus) throw new Error('--corpus=<handbook|regs|knowledge> is required');
	const opts: CliOptions = { corpus, repoRoot };
	if (source !== undefined) opts.source = source;
	if (kind !== undefined) opts.kind = kind;
	return opts;
}

async function main(): Promise<number> {
	const opts = parseArgs(process.argv.slice(2));
	const result = await runProducers({
		corpus: opts.corpus,
		repoRoot: opts.repoRoot,
		...(opts.source !== undefined ? { sourceId: opts.source } : {}),
		...(opts.kind !== undefined ? { kind: opts.kind } : {}),
	});
	console.log(
		`run-producers: plugins=${result.totalPlugins} upserted=${result.totalUpserted} staled=${result.totalStaled} errors=${result.totalErrors}`,
	);
	for (const summary of result.perPlugin) {
		const errStr = summary.error ? ` ERROR ${summary.error.name}: ${summary.error.message}` : '';
		console.log(`  ${summary.kind}: upserted=${summary.upserted} staled=${summary.staled}${errStr}`);
	}
	return result.totalErrors > 0 ? 1 : 0;
}

main().then(
	(code) => process.exit(code),
	(err) => {
		console.error(err instanceof Error ? (err.stack ?? err.message) : err);
		process.exit(1);
	},
);

export { main as runProducersMain };
