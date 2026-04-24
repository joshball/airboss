#!/usr/bin/env bun
/**
 * Wiki-link scanner.
 *
 * Walks every content location that might embed `[[display::id]]`
 * wiki-links, extracts them via the @ab/aviation parser, and returns:
 *
 *   - The list of ContentScan buckets for the validator to consume.
 *   - A manifest payload (architecture doc "Step 1: scan" shape) for
 *     downstream tooling (the extraction pipeline reads this).
 *
 * Paths walked:
 *
 *   course/knowledge/<domain>/<slug>/node.md   (markdown)
 *   apps/*\/src/lib/help/content/**\/*.ts     (TS string literals)
 *   Reference.paraphrase                       (via the registry; empty in
 *                                              Phase 1)
 *
 * The scanner is intentionally regex-tolerant for TS: it concatenates the
 * file source and hands it to the parser. The parser skips markdown code
 * fences and inline code spans. For TS-family files (`.ts`, `.tsx`,
 * `.svelte.ts`, `.svelte`) we also blank out template-literal contents
 * before parsing, so backticks inside TS source do not confuse the
 * markdown-oriented skip logic (a nested backtick inside `${...}` used to
 * produce phantom matches). Single-quoted and double-quoted string
 * literals are left intact: authors legitimately embed `[[...::...]]` in
 * those (see help content), and those should still be scanned.
 *
 * Per architecture decision #3: this is fast (sub-second). No caching, no
 * incremental scan. Full re-scan every invocation.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { type ContentScan, extractWikilinks, listReferences } from '@ab/aviation';
import { stripTsTemplateLiterals } from './strip-ts-templates';

const REPO_ROOT = resolve(import.meta.dirname ?? import.meta.dir, '..', '..');

/**
 * File extensions whose source contains TypeScript template literals that
 * the scanner must blank out before running the markdown wiki-link parser.
 * Ordered longest-first so `.svelte.ts` is matched before `.ts`.
 */
const TS_TEMPLATE_EXTENSIONS = ['.svelte.ts', '.tsx', '.svelte', '.ts'] as const;

export interface ManifestEntry {
	id: string;
	firstSeenIn: string;
	useCount: number;
}

export interface UnresolvedEntry {
	display: string;
	firstSeenIn: string;
}

export interface ScanManifest {
	generatedAt: string;
	references: ManifestEntry[];
	unresolvedText: UnresolvedEntry[];
}

export interface ScanResult {
	scans: readonly ContentScan[];
	manifest: ScanManifest;
}

function walk(root: string, predicate: (path: string) => boolean): string[] {
	const out: string[] = [];
	if (!safeStat(root)) return out;
	const stack: string[] = [root];
	while (stack.length > 0) {
		const dir = stack.pop();
		if (!dir) continue;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.startsWith('.')) continue;
			if (entry === 'node_modules') continue;
			const full = join(dir, entry);
			const s = safeStat(full);
			if (!s) continue;
			if (s.isDirectory()) {
				stack.push(full);
			} else if (predicate(full)) {
				out.push(full);
			}
		}
	}
	return out;
}

function safeStat(path: string): ReturnType<typeof statSync> | null {
	try {
		return statSync(path);
	} catch {
		return null;
	}
}

function collectKnowledgeNodes(): string[] {
	const root = join(REPO_ROOT, 'course', 'knowledge');
	return walk(root, (p) => p.endsWith('/node.md'));
}

function collectHelpContent(): string[] {
	const appsRoot = join(REPO_ROOT, 'apps');
	const out: string[] = [];
	const apps = safeStat(appsRoot)?.isDirectory() ? readdirSync(appsRoot) : [];
	for (const app of apps) {
		const contentRoot = join(appsRoot, app, 'src', 'lib', 'help', 'content');
		if (!safeStat(contentRoot)?.isDirectory()) continue;
		out.push(...walk(contentRoot, (p) => p.endsWith('.ts')));
	}
	return out;
}

function hasTsTemplateExtension(path: string): boolean {
	for (const ext of TS_TEMPLATE_EXTENSIONS) {
		if (path.endsWith(ext)) return true;
	}
	return false;
}

function readAsScan(path: string): ContentScan {
	const raw = readFileSync(path, 'utf8');
	const source = hasTsTemplateExtension(path) ? stripTsTemplateLiterals(raw) : raw;
	return { path: relative(REPO_ROOT, path), source };
}

export function scanContent(): ScanResult {
	const scans: ContentScan[] = [];
	for (const path of collectKnowledgeNodes()) {
		scans.push(readAsScan(path));
	}
	for (const path of collectHelpContent()) {
		scans.push(readAsScan(path));
	}
	for (const ref of listReferences()) {
		scans.push({ path: `@ab/aviation:${ref.id}`, source: ref.paraphrase });
	}

	const references = new Map<string, ManifestEntry>();
	const unresolvedText: UnresolvedEntry[] = [];

	for (const scan of scans) {
		const { wikilinks } = extractWikilinks(scan.source);
		for (const link of wikilinks) {
			if (link.id) {
				const existing = references.get(link.id);
				if (existing) {
					existing.useCount += 1;
				} else {
					references.set(link.id, {
						id: link.id,
						firstSeenIn: scan.path,
						useCount: 1,
					});
				}
			} else if (link.display) {
				unresolvedText.push({ display: link.display, firstSeenIn: scan.path });
			}
		}
	}

	return {
		scans,
		manifest: {
			generatedAt: new Date().toISOString(),
			references: Array.from(references.values()),
			unresolvedText,
		},
	};
}

// CLI entry point: print the manifest JSON to stdout.
if (import.meta.main) {
	const result = scanContent();
	process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`);
}
