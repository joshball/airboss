/**
 * Phase 5 -- diff job orchestrator.
 *
 * Source of truth: ADR 019 §5 (versioning workflow).
 *
 * Walks edition pairs, hashes normalized bodies, partitions outcomes, writes
 * a JSON report to `data/sources-diff/`, and prints a stdout summary.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { EditionId } from '../types.ts';
import { resolveAliasOutcome } from './alias-resolver.ts';
import { hashEditionBody, readNormalizedBody } from './body-hasher.ts';
import { type EditionPair, latestTwoEditionsForCorpus, walkEditionPairs } from './pair-walker.ts';
import { ALL_OUTCOME_KINDS, type DiffOutcome, type DiffOutcomeKind, type DiffReport } from './types.ts';
import { buildSnippet } from './unified-diff.ts';

export interface DiffJobArgs {
	readonly corpus: string;
	readonly outRoot: string;
	readonly editionPair?: { readonly old: EditionId; readonly new: EditionId };
	/** Override default report path. */
	readonly outPath?: string;
	/** When true, skip writing the JSON report (tests). */
	readonly skipWrite?: boolean;
}

export interface DiffJobResult {
	readonly report: DiffReport;
	readonly reportPath: string | null;
}

export function runDiffJob(args: DiffJobArgs): DiffJobResult {
	const pair = args.editionPair ?? latestTwoEditionsForCorpus(args.corpus);
	if (pair === null) {
		const empty = makeReport(args.corpus, { old: 'unknown', new: 'unknown' }, []);
		return { report: empty, reportPath: null };
	}

	const allPairs = walkEditionPairs(args.corpus).filter((p) => p.oldEdition === pair.old && p.newEdition === pair.new);

	const outcomes: DiffOutcome[] = [];
	for (const editionPair of allPairs) {
		outcomes.push(buildOutcome(editionPair, args.outRoot));
	}

	const report = makeReport(args.corpus, pair, outcomes);

	let reportPath: string | null = null;
	if (args.skipWrite !== true) {
		reportPath = args.outPath ?? defaultReportPath(args.corpus, pair);
		mkdirSync(dirname(reportPath), { recursive: true });
		writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
	}

	return { report, reportPath };
}

function buildOutcome(pair: EditionPair, outRoot: string): DiffOutcome {
	const alias = resolveAliasOutcome(pair);
	if (alias !== null) {
		return {
			pair,
			kind: aliasKindToOutcomeKind(alias.kind),
			oldHash: null,
			newHash: null,
			aliasTo: alias.to,
		};
	}

	const oldHash = hashEditionBody(pair.id, pair.oldEdition, { outRoot });
	const newHash = hashEditionBody(pair.id, pair.newEdition, { outRoot });

	if (oldHash === null) {
		return { pair, kind: 'missing-old', oldHash: null, newHash };
	}
	if (newHash === null) {
		return { pair, kind: 'missing-new', oldHash, newHash: null };
	}

	if (oldHash === newHash) {
		return { pair, kind: 'auto-advance', oldHash, newHash };
	}

	const oldBody = readNormalizedBody(pair.id, pair.oldEdition, { outRoot }) ?? '';
	const newBody = readNormalizedBody(pair.id, pair.newEdition, { outRoot }) ?? '';
	const snippet = buildSnippet(oldBody, newBody);
	return {
		pair,
		kind: 'needs-review',
		oldHash,
		newHash,
		diffSnippet: snippet,
	};
}

function aliasKindToOutcomeKind(
	kind: 'silent' | 'content-change' | 'cross-section' | 'split' | 'merge',
): DiffOutcomeKind {
	switch (kind) {
		case 'silent':
			return 'alias-silent';
		case 'content-change':
			return 'alias-content';
		case 'cross-section':
			return 'alias-cross';
		case 'split':
			return 'alias-split';
		case 'merge':
			return 'alias-merge';
	}
}

function makeReport(
	corpus: string,
	pair: { readonly old: EditionId; readonly new: EditionId },
	outcomes: readonly DiffOutcome[],
): DiffReport {
	const counts = ALL_OUTCOME_KINDS.reduce<Record<DiffOutcomeKind, number>>(
		(acc, kind) => {
			acc[kind] = 0;
			return acc;
		},
		{} as Record<DiffOutcomeKind, number>,
	);
	for (const outcome of outcomes) {
		counts[outcome.kind] += 1;
	}
	return {
		schemaVersion: 1,
		corpus,
		editionPair: pair,
		generatedAt: new Date().toISOString(),
		counts,
		outcomes,
	};
}

function defaultReportPath(corpus: string, pair: { readonly old: EditionId; readonly new: EditionId }): string {
	const ts = new Date().toISOString().replace(/[:]/gu, '').replace(/\..+/u, '');
	return join(process.cwd(), 'data', 'sources-diff', `${corpus}-${pair.old}-vs-${pair.new}-${ts}.json`);
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

export function findAutoAdvanceCandidates(report: DiffReport): readonly DiffOutcome[] {
	return report.outcomes.filter(
		(o) => o.kind === 'auto-advance' || o.kind === 'alias-silent' || o.kind === 'alias-merge',
	);
}

export function findNeedsReviewCandidates(report: DiffReport): readonly DiffOutcome[] {
	return report.outcomes.filter(
		(o) =>
			o.kind === 'needs-review' || o.kind === 'alias-content' || o.kind === 'alias-cross' || o.kind === 'alias-split',
	);
}

// ---------------------------------------------------------------------------
// Stdout summary -- consumed by the CLI
// ---------------------------------------------------------------------------

export function formatDiffSummary(report: DiffReport, reportPath: string | null): string {
	const lines: string[] = [];
	lines.push(`diff: corpus=${report.corpus} ${report.editionPair.old} -> ${report.editionPair.new}`);
	for (const kind of ALL_OUTCOME_KINDS) {
		const n = report.counts[kind];
		if (n > 0) lines.push(`  ${kind}: ${n}`);
	}
	const review = findNeedsReviewCandidates(report);
	if (review.length > 0) {
		lines.push(`  top needs-review:`);
		const top = review.slice(0, 10);
		for (const outcome of top) {
			const firstSnippetLine =
				outcome.diffSnippet?.split('\n').find((l) => l.startsWith('-') || l.startsWith('+')) ?? '';
			lines.push(`    ${outcome.pair.id}  ${truncate(firstSnippetLine, 80)}`);
		}
	}
	if (reportPath !== null) {
		lines.push(`  report: ${reportPath}`);
	}
	return `${lines.join('\n')}\n`;
}

function truncate(input: string, max: number): string {
	if (input.length <= max) return input;
	return `${input.slice(0, max - 1)}…`;
}
