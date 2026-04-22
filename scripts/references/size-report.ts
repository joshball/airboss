#!/usr/bin/env bun
/**
 * Source-file size report.
 *
 * Walks `data/sources/**`, tallies sizes by source type, and classifies
 * every file as commit / LFS / external-storage per reference-system
 * architecture decision #2 thresholds:
 *
 *   < 1 MB         commit directly
 *   1 - 5 MB       commit directly (borderline)
 *   5 - 100 MB     use LFS
 *   > 100 MB       external storage (S3 / artifact bucket)
 *
 * Prints a table to stdout and writes a markdown report to
 * `docs/work/todos/20260422-source-sizes-report.md` for follow-up.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { isSourceMeta } from '@ab/aviation';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SOURCES_ROOT = resolve(REPO_ROOT, 'data', 'sources');
const REPORT_PATH = resolve(REPO_ROOT, 'docs', 'work', 'todos', '20260422-source-sizes-report.md');

type Category = 'commit' | 'commit-borderline' | 'lfs' | 'external';

interface FileEntry {
	path: string;
	sourceType: string;
	sizeBytes: number;
	category: Category;
	isMeta: boolean;
}

function classify(sizeBytes: number): Category {
	const mb = sizeBytes / (1024 * 1024);
	if (mb < 1) return 'commit';
	if (mb < 5) return 'commit-borderline';
	if (mb < 100) return 'lfs';
	return 'external';
}

function categoryLabel(c: Category): string {
	switch (c) {
		case 'commit':
			return 'commit directly';
		case 'commit-borderline':
			return 'commit directly (borderline)';
		case 'lfs':
			return 'use LFS';
		case 'external':
			return 'external storage (S3 / artifact bucket)';
	}
}

function humanSize(bytes: number): string {
	const mb = bytes / (1024 * 1024);
	if (mb >= 1) return `${mb.toFixed(2)} MB`;
	const kb = bytes / 1024;
	if (kb >= 1) return `${kb.toFixed(2)} KB`;
	return `${bytes} B`;
}

function collectFiles(): FileEntry[] {
	const entries: FileEntry[] = [];
	try {
		const types = readdirSync(SOURCES_ROOT);
		for (const sourceType of types) {
			const typeDir = join(SOURCES_ROOT, sourceType);
			const typeStat = statSync(typeDir);
			if (!typeStat.isDirectory()) continue;
			const walk = (dir: string): void => {
				for (const entry of readdirSync(dir)) {
					if (entry.startsWith('.')) continue;
					const full = join(dir, entry);
					const s = statSync(full);
					if (s.isDirectory()) {
						walk(full);
					} else {
						const isMeta = entry.endsWith('.meta.json');
						entries.push({
							path: relative(REPO_ROOT, full),
							sourceType,
							sizeBytes: s.size,
							category: classify(s.size),
							isMeta,
						});
					}
				}
			};
			walk(typeDir);
		}
	} catch {
		// data/sources does not exist yet.
	}
	return entries;
}

function validateMetaJsons(entries: readonly FileEntry[]): string[] {
	const problems: string[] = [];
	for (const entry of entries) {
		if (!entry.isMeta) continue;
		try {
			const src = readFileSync(resolve(REPO_ROOT, entry.path), 'utf8');
			const json = JSON.parse(src);
			if (!isSourceMeta(json)) {
				problems.push(`${entry.path}: does not match SourceMeta schema`);
			}
		} catch (err) {
			problems.push(`${entry.path}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	return problems;
}

function printTable(entries: readonly FileEntry[]): void {
	// Tally by source type.
	const byType = new Map<string, { count: number; total: number; categories: Record<Category, number> }>();
	for (const e of entries) {
		if (e.isMeta) continue;
		const bucket = byType.get(e.sourceType) ?? {
			count: 0,
			total: 0,
			categories: { commit: 0, 'commit-borderline': 0, lfs: 0, external: 0 },
		};
		bucket.count += 1;
		bucket.total += e.sizeBytes;
		bucket.categories[e.category] += 1;
		byType.set(e.sourceType, bucket);
	}

	if (byType.size === 0) {
		console.log('size-report: no source binaries on disk yet; come back after the first downloads.');
		return;
	}

	console.log('Source-type totals:');
	for (const [type, bucket] of byType) {
		console.log(`  ${type.padEnd(14)} ${bucket.count} file(s), ${humanSize(bucket.total)}`);
	}

	console.log('');
	console.log('Per-file classification:');
	for (const e of entries) {
		if (e.isMeta) continue;
		console.log(`  ${e.path.padEnd(50)} ${humanSize(e.sizeBytes).padStart(10)}  ${categoryLabel(e.category)}`);
	}
}

function writeReport(entries: readonly FileEntry[], metaProblems: readonly string[]): void {
	const lines: string[] = [];
	lines.push('# Source sizes report');
	lines.push('');
	lines.push(`Generated: ${new Date().toISOString()}`);
	lines.push('');
	lines.push(
		'Per reference-system architecture decision #2, this report flags each source binary as commit / LFS / external-storage. Drive the per-source-type storage decision from this table.',
	);
	lines.push('');
	const binaries = entries.filter((e) => !e.isMeta);
	if (binaries.length === 0) {
		lines.push('## Status');
		lines.push('');
		lines.push('No source binaries on disk. Come back after the first downloads.');
	} else {
		lines.push('## Files');
		lines.push('');
		lines.push('| Path | Size | Recommendation |');
		lines.push('| ---- | ---- | -------------- |');
		for (const e of binaries) {
			lines.push(`| ${e.path} | ${humanSize(e.sizeBytes)} | ${categoryLabel(e.category)} |`);
		}
	}
	if (metaProblems.length > 0) {
		lines.push('');
		lines.push('## Meta.json problems');
		lines.push('');
		for (const p of metaProblems) {
			lines.push(`- ${p}`);
		}
	}
	lines.push('');
	mkdirSync(resolve(REPO_ROOT, 'docs', 'work', 'todos'), { recursive: true });
	writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
}

if (import.meta.main) {
	const entries = collectFiles();
	printTable(entries);
	const metaProblems = validateMetaJsons(entries);
	if (metaProblems.length > 0) {
		console.log('');
		console.log('Meta.json problems:');
		for (const p of metaProblems) {
			console.log(`  ${p}`);
		}
	}
	writeReport(entries, metaProblems);
	console.log('');
	console.log(`size-report: wrote ${relative(REPO_ROOT, REPORT_PATH)}`);
}
