#!/usr/bin/env bun

/**
 * Static validator: a weather-product reference page promoted to
 * `status: done` must carry only verified citations.
 *
 * Why this exists:
 *   - The 25 product reference pages at
 *     `course/weather/references/products/<slug>/page.md` each carry an
 *     `authoritative_sources:` block -- a list of FAA document citations
 *     (AC 00-45H, AIM, FAA-H-8083-28, ...). Many `section:` values were
 *     authored by agents that could not open the source PDFs, so the
 *     numbers are inferred. Each entry now carries a `verified:` boolean:
 *     `true` once the citation is corroborated against a source already in
 *     the repo (or carries no specific number to be wrong about), `false`
 *     until a PDF check pins it.
 *   - Without a gate, a guessed citation looks identical to a verified one.
 *     This script makes the distinction machine-checkable: a `draft` page
 *     may carry `verified: false` entries, but a `done` page may not.
 *
 * Wiring:
 *   - Invoked as the `wx-citations` step of `bun run check`
 *     (see `scripts/check.ts`).
 *   - Exit code 0 on clean, 1 on any `done` page with an unverified (or
 *     `verified`-missing) citation.
 *
 * Output format on failure (one line per finding, grep-able):
 *
 *   unverified citation: metar -> AC 00-45H (status: done)
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
	WX_REFERENCE_PAGE_BASENAME,
	WX_REFERENCE_PRODUCTS_DIR_SEGMENTS,
	WX_REFERENCE_STATUS_DONE,
} from '@ab/constants';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = resolve(import.meta.dir, '..');
const PRODUCTS_ROOT = join(REPO_ROOT, ...WX_REFERENCE_PRODUCTS_DIR_SEGMENTS);

interface CitationFinding {
	slug: string;
	source: string;
	reason: string;
}

interface PageReport {
	slug: string;
	status: string;
	citationCount: number;
	findings: CitationFinding[];
	parseError: string | null;
}

/**
 * Split the leading `---` fenced YAML frontmatter from a markdown string.
 * Returns null when the file carries no closed frontmatter block.
 */
function splitFrontmatter(text: string): string | null {
	if (!text.startsWith('---\n')) return null;
	const end = text.indexOf('\n---\n', 4);
	if (end === -1) return null;
	return text.slice(4, end);
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	return value as Record<string, unknown>;
}

function checkPage(slug: string, raw: string): PageReport {
	const report: PageReport = { slug, status: '', citationCount: 0, findings: [], parseError: null };
	const yaml = splitFrontmatter(raw);
	if (yaml === null) {
		report.parseError = 'no closed frontmatter block';
		return report;
	}
	let fm: Record<string, unknown> | null;
	try {
		fm = asRecord(parseYaml(yaml));
	} catch (err) {
		report.parseError = `yaml parse: ${(err as Error).message}`;
		return report;
	}
	if (fm === null) {
		report.parseError = 'frontmatter is not a mapping';
		return report;
	}

	report.status = typeof fm.status === 'string' ? fm.status : '';

	const sources = fm.authoritative_sources;
	if (!Array.isArray(sources)) {
		report.parseError = 'authoritative_sources is missing or not a list';
		return report;
	}
	report.citationCount = sources.length;

	// Only `done` pages are gated. A `draft` page may carry unverified
	// citations -- the gate is on promotion to `done`.
	if (report.status !== WX_REFERENCE_STATUS_DONE) return report;

	for (const entry of sources) {
		const item = asRecord(entry);
		const source = item !== null && typeof item.source === 'string' ? item.source : '(unnamed source)';
		if (item === null) {
			report.findings.push({ slug, source, reason: 'citation entry is not a mapping' });
			continue;
		}
		const verified = item.verified;
		if (typeof verified !== 'boolean') {
			report.findings.push({ slug, source, reason: 'missing `verified:` boolean' });
			continue;
		}
		if (verified === false) {
			report.findings.push({ slug, source, reason: '`verified: false` -- needs a source-PDF check' });
		}
	}
	return report;
}

async function main(): Promise<void> {
	let productsExist = false;
	try {
		productsExist = (await stat(PRODUCTS_ROOT)).isDirectory();
	} catch {
		productsExist = false;
	}
	if (!productsExist) {
		console.error(`wx-citation validator: products directory not found at ${PRODUCTS_ROOT}`);
		process.exit(1);
	}

	const dirEntries = await readdir(PRODUCTS_ROOT, { withFileTypes: true });
	const slugs = dirEntries
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort();

	const reports: PageReport[] = [];
	for (const slug of slugs) {
		const pagePath = join(PRODUCTS_ROOT, slug, WX_REFERENCE_PAGE_BASENAME);
		let raw: string;
		try {
			raw = await readFile(pagePath, 'utf8');
		} catch {
			// Subdirectory without a `page.md` (e.g. a future asset dir) -- skip.
			continue;
		}
		reports.push(checkPage(slug, raw));
	}

	const parseErrors = reports.filter((r) => r.parseError !== null);
	for (const r of parseErrors) {
		console.error(`parse error: ${r.slug} -- ${r.parseError}`);
	}

	const gated = reports.filter((r) => r.status === WX_REFERENCE_STATUS_DONE);
	const findings = reports.flatMap((r) => r.findings);
	for (const f of findings) {
		console.error(`unverified citation: ${f.slug} -> ${f.source} (${f.reason})`);
	}

	const draftCount = reports.length - gated.length;
	console.log(
		`wx-citation validator: ${reports.length} product page(s) checked ` +
			`(${gated.length} done, ${draftCount} draft).`,
	);

	if (parseErrors.length > 0) {
		console.error(`wx-citation validator: ${parseErrors.length} page(s) failed to parse.`);
		process.exit(1);
	}
	if (findings.length > 0) {
		console.error(
			`wx-citation validator: ${findings.length} unverified citation(s) on done page(s). ` +
				'Verify the citations against the source documents or revert the page to draft.',
		);
		process.exit(1);
	}

	console.log('wx-citation validator: OK');
}

await main();
