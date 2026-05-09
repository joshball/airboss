#!/usr/bin/env bun
/**
 * Import per-source `<slug>-overrides.yaml` sidecars into
 * `hangar.ingest_issue` + `hangar.ingest_override` rows.
 *
 * Used on a fresh clone (no DB rows yet) to rebuild the override state
 * from the YAML sidecars committed to the repo. Idempotent: re-running
 * after import is a no-op (the upsert rewrites the same payload; the
 * override `applyOverride` overwrites the same row).
 *
 * Usage:
 *   bun scripts/ingest-review/import-overrides.ts
 *   bun scripts/ingest-review/import-overrides.ts --corpus handbook
 *   bun scripts/ingest-review/import-overrides.ts --corpus handbook --source ifh
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { IssueInput } from '@ab/bc-ingest-review';
import { applyOverride, getPlugin, listHandbookEditions, upsertIssue } from '@ab/bc-ingest-review/server';
import { CORPUS_VALUES, type Corpus, INGEST_REVIEW } from '@ab/constants';
import { parseSidecar } from './yaml-sidecar';

interface CliOptions {
	corpus?: Corpus;
	source?: string;
	repoRoot: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
	const opts: CliOptions = { repoRoot: process.cwd() };
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

interface SidecarFile {
	corpus: Corpus;
	sourceId: string;
	filePath: string;
}

async function listSidecars(repoRoot: string, corpus: Corpus): Promise<readonly SidecarFile[]> {
	const dir = sidecarDirFor(repoRoot, corpus);
	let entries: string[];
	try {
		entries = await readdir(dir);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw err;
	}
	const out: SidecarFile[] = [];
	for (const entry of entries) {
		if (!entry.endsWith('-overrides.yaml')) continue;
		const sourceId = entry.slice(0, -'-overrides.yaml'.length);
		out.push({ corpus, sourceId, filePath: path.join(dir, entry) });
	}
	return out;
}

function sidecarDirFor(repoRoot: string, corpus: Corpus): string {
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

async function findEditionForHandbook(repoRoot: string, slug: string): Promise<string | null> {
	const editions = await listHandbookEditions(repoRoot, slug);
	const match = editions.find((e) => e.slug === slug);
	return match?.edition ?? null;
}

async function importOne(repoRoot: string, sidecar: SidecarFile): Promise<{ upserted: number; resolved: number }> {
	const text = await readFile(sidecar.filePath, 'utf8');
	const parsed = parseSidecar(text);
	if (parsed.overrides.length === 0) return { upserted: 0, resolved: 0 };
	const edition =
		sidecar.corpus === INGEST_REVIEW.CORPUSES.HANDBOOK
			? await findEditionForHandbook(repoRoot, sidecar.sourceId)
			: null;
	let upserted = 0;
	let resolved = 0;
	for (const entry of parsed.overrides) {
		// Synthesize a minimal issue payload. The producer will overwrite
		// it on the next `run-producers` invocation; we only need a row
		// for `applyOverride` to attach against.
		const issueInput: IssueInput = {
			corpus: sidecar.corpus,
			sourceId: sidecar.sourceId,
			edition,
			pageNum: null,
			kind: entry.kind,
			externalId: entry.external_id,
			payload: { source: 'sidecar-import' },
		};
		const issue = await upsertIssue(issueInput);
		upserted += 1;
		const plugin = getPlugin(issue.kind);
		plugin.validateAction(issue, { action: entry.action, payload: entry.payload });
		await applyOverride({
			issueId: issue.id,
			action: { action: entry.action, payload: entry.payload },
			actorUserId: null,
		});
		resolved += 1;
	}
	return { upserted, resolved };
}

async function main(): Promise<number> {
	const opts = parseArgs(process.argv.slice(2));
	const corpora: readonly Corpus[] = opts.corpus ? [opts.corpus] : (CORPUS_VALUES as readonly Corpus[]);
	let totalUpserted = 0;
	let totalResolved = 0;
	for (const corpus of corpora) {
		let sidecars = await listSidecars(opts.repoRoot, corpus);
		if (opts.source) sidecars = sidecars.filter((s) => s.sourceId === opts.source);
		for (const sidecar of sidecars) {
			const result = await importOne(opts.repoRoot, sidecar);
			totalUpserted += result.upserted;
			totalResolved += result.resolved;
			console.log(
				`imported ${path.relative(opts.repoRoot, sidecar.filePath)}: upserted=${result.upserted} resolved=${result.resolved}`,
			);
		}
	}
	console.log(`import-overrides: total upserted=${totalUpserted} resolved=${totalResolved}`);
	return 0;
}

main().then(
	(code) => process.exit(code),
	(err) => {
		console.error(err instanceof Error ? (err.stack ?? err.message) : err);
		process.exit(1);
	},
);

export { main as importOverridesMain };
