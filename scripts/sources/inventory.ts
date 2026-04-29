/**
 * `bun run sources inventory` -- regenerate `docs/sources/INVENTORY.md`.
 *
 * Walks every YAML config + every cache manifest and emits a per-corpus
 * markdown report. The output is idempotent: same input bytes = same
 * output bytes. One timestamp at the top; no timestamps inside section
 * bodies. Operators can `git diff docs/sources/INVENTORY.md` to see what
 * changed in the source cache.
 *
 * Per ADR 022, SHA-256 prefix is 12 hex chars (matches git's full-prefix
 * convention; sufficient for human disambiguation in a markdown index).
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveCacheRoot } from '../lib/cache';
import {
	listHandbookSlugs,
	loadAcConfig,
	loadAcsConfig,
	loadAimConfig,
	loadHandbookConfig,
	loadHandbooksExtrasConfig,
	loadRegsConfig,
} from './config/loader';
import {
	type ManifestEntry,
	readAimCorpusManifestFile,
	readCorpusManifestFile,
	readHandbookManifestFile,
} from './download/manifest';

export const SHA_PREFIX_LENGTH = 12;

interface RowFields {
	readonly asset: string;
	readonly sourceUrl: string;
	readonly cacheFilename: string;
	readonly sha: string;
	readonly fetched: string;
}

function shortSha(sha: string): string {
	return sha.slice(0, SHA_PREFIX_LENGTH);
}

function shortDate(iso: string): string {
	// ISO `2026-04-29T17:30:00.000Z` -> `2026-04-29`. Idempotent regen wants
	// the timestamp inside section bodies to NOT change every fetch; the
	// downloader writes `fetched_at` per fetch, so we trim to date for the
	// inventory's "Fetched" column.
	return iso.slice(0, 10);
}

function emptyRow(asset: string, sourceUrl: string, cacheFilename: string): RowFields {
	return {
		asset,
		sourceUrl,
		cacheFilename,
		sha: '-',
		fetched: '-',
	};
}

function rowFromManifest(asset: string, entry: ManifestEntry, cacheFilename: string): RowFields {
	return {
		asset,
		sourceUrl: entry.source_url,
		cacheFilename,
		sha: shortSha(entry.source_sha256),
		fetched: shortDate(entry.fetched_at),
	};
}

function renderTable(rows: readonly RowFields[]): string {
	if (rows.length === 0) return '_(no assets configured)_\n';
	const header = '| Asset | Source URL | Cache filename | SHA-256 (12) | Fetched |\n| --- | --- | --- | --- | --- |\n';
	const body = rows
		.map(
			(r) => `| ${r.asset} | [${r.sourceUrl}](${r.sourceUrl}) | \`${r.cacheFilename}\` | \`${r.sha}\` | ${r.fetched} |`,
		)
		.join('\n');
	return `${header}${body}\n`;
}

function renderHandbookSection(slug: string, cacheRoot: string): string {
	const hb = loadHandbookConfig(slug);
	const editionDir = join(cacheRoot, 'handbooks', slug, hb.edition);
	const manifest = readHandbookManifestFile(join(editionDir, 'manifest.json'));
	const wholeDocFilename = hb.whole_doc?.filename ?? `${hb.edition}.pdf`;

	const rows: RowFields[] = [];

	// Whole-doc.
	const wholeDocUrl = hb.whole_doc?.url ?? hb.source_url;
	if (wholeDocUrl !== undefined) {
		if (manifest !== null) {
			rows.push(rowFromManifest('Whole-doc', manifest.primary, wholeDocFilename));
		} else {
			rows.push(emptyRow('Whole-doc', wholeDocUrl, wholeDocFilename));
		}
	}

	// Chapters.
	if (hb.chapter_pdfs !== undefined) {
		const offset = hb.chapter_pdfs.file_ordinal_offset;
		for (let n = 1; n <= hb.chapter_pdfs.chapter_count; n += 1) {
			const padded = String(n).padStart(2, '0');
			const cacheFilename = `${hb.edition}-ch${padded}.pdf`;
			const cached = manifest?.chapters?.find((c) => c.ordinal === n);
			if (cached !== undefined) {
				rows.push(rowFromManifest(`Chapter ${n}`, cached, cacheFilename));
			} else {
				const url =
					'direct_pattern' in hb.chapter_pdfs && hb.chapter_pdfs.direct_pattern !== undefined
						? hb.chapter_pdfs.direct_pattern
								.replace(/\{NN\}/g, String(n + offset).padStart(2, '0'))
								.replace(/\{N\}/g, String(n))
						: 'index_url' in hb.chapter_pdfs && hb.chapter_pdfs.index_url !== undefined
							? `${hb.chapter_pdfs.index_url}#chapter-${n}-`
							: '';
				rows.push(emptyRow(`Chapter ${n}`, url, cacheFilename));
			}
		}
		// Ancillaries.
		for (const a of hb.chapter_pdfs.ancillary) {
			const cacheFilename = `${hb.edition}-${a.kind}.pdf`;
			const cached = manifest?.ancillary?.find((m) => m.ancillary_kind === a.kind);
			const label = `Ancillary: ${a.kind}`;
			if (cached !== undefined) {
				rows.push(rowFromManifest(label, cached, cacheFilename));
			} else {
				rows.push(emptyRow(label, a.url, cacheFilename));
			}
		}
	}

	// Errata.
	if (manifest?.errata !== undefined) {
		for (const e of manifest.errata) {
			rows.push({
				asset: `Errata: ${e.doc}`,
				sourceUrl: e.source_url,
				cacheFilename: e.source_filename,
				sha: shortSha(e.source_sha256),
				fetched: shortDate(e.fetched_at),
			});
		}
	}

	const lines: string[] = [];
	lines.push(`### ${hb.title} (${slug.toUpperCase()})`);
	lines.push('');
	lines.push(`Edition: \`${hb.edition}\``);
	lines.push('');
	lines.push(renderTable(rows));
	return lines.join('\n');
}

function renderHandbooksSection(cacheRoot: string): string {
	const slugs = listHandbookSlugs();
	const sections = slugs.map((s) => renderHandbookSection(s, cacheRoot));
	return ['## Handbooks', '', ...sections].join('\n');
}

function renderHandbooksExtras(cacheRoot: string): string {
	const cfg = loadHandbooksExtrasConfig();
	const rows: RowFields[] = [];
	for (const e of cfg.entries) {
		const cacheDir = join(cacheRoot, 'handbooks', e.doc_id);
		const manifest = readHandbookManifestFile(join(cacheDir, 'manifest.json'));
		const cacheFilename = `${e.doc_id}.pdf`;
		if (manifest !== null) {
			rows.push(rowFromManifest(e.doc_id, manifest.primary, cacheFilename));
		} else {
			rows.push(emptyRow(e.doc_id, e.url, cacheFilename));
		}
	}
	rows.sort((a, b) => a.asset.localeCompare(b.asset));
	return ['### Handbook extras (whole-doc only)', '', renderTable(rows)].join('\n');
}

function renderFlatCorpus(label: string, slug: 'ac' | 'acs', cacheRoot: string): string {
	const cfg = slug === 'ac' ? loadAcConfig() : loadAcsConfig();
	const manifest = readCorpusManifestFile(join(cacheRoot, slug, 'manifest.json'));
	const rows: RowFields[] = [];
	for (const e of cfg.entries) {
		const cached = manifest?.entries.find((m) => m.doc === e.doc_id);
		if (cached !== undefined) {
			rows.push(rowFromManifest(e.doc_id, cached, e.filename));
		} else {
			rows.push(emptyRow(e.doc_id, e.url, e.filename));
		}
	}
	rows.sort((a, b) => a.asset.localeCompare(b.asset));
	return [`## ${label}`, '', renderTable(rows)].join('\n');
}

function renderAim(cacheRoot: string): string {
	const cfg = loadAimConfig();
	const manifest = readAimCorpusManifestFile(join(cacheRoot, 'aim', 'manifest.json'));

	const lines: string[] = ['## AIM -- Aeronautical Information Manual', ''];

	const primaryRows: RowFields[] = [];
	if (manifest !== null) {
		primaryRows.push(rowFromManifest('Bundled PDF', manifest.primary, cfg.whole_doc.filename));
	} else {
		primaryRows.push(emptyRow('Bundled PDF', cfg.whole_doc.url, cfg.whole_doc.filename));
	}
	lines.push('### Bundled PDF');
	lines.push('');
	lines.push(renderTable(primaryRows));

	const sectionRows: RowFields[] = [];
	for (let chapter = 0; chapter < cfg.chapter_html.chapter_count; chapter += 1) {
		const sectionCount = cfg.chapter_html.sections_per_chapter[chapter] ?? 0;
		for (let section = 1; section <= sectionCount; section += 1) {
			const url =
				chapter === 0 && section === 1 && cfg.chapter_html.chapter_0_section_url_override !== undefined
					? cfg.chapter_html.chapter_0_section_url_override
					: cfg.chapter_html.section_url_pattern.replace(/\{C\}/g, String(chapter)).replace(/\{S\}/g, String(section));
			const filename = cfg.chapter_html.section_filename_pattern
				.replace(/\{CC\}/g, String(chapter).padStart(2, '0'))
				.replace(/\{SS\}/g, String(section).padStart(2, '0'));
			const asset = `Ch${String(chapter).padStart(2, '0')} S${String(section).padStart(2, '0')}`;
			const cached = manifest?.sections.find((s) => s.chapter === chapter && s.section === section);
			if (cached !== undefined) {
				sectionRows.push(rowFromManifest(asset, cached, filename));
			} else {
				sectionRows.push(emptyRow(asset, url, filename));
			}
		}
	}
	sectionRows.sort((a, b) => a.asset.localeCompare(b.asset));
	lines.push('### Chapter HTML sections');
	lines.push('');
	lines.push(renderTable(sectionRows));

	const appendixRows: RowFields[] = [];
	for (let n = 1; n <= cfg.appendix_html.appendix_count; n += 1) {
		const url = cfg.appendix_html.url_pattern.replace(/\{N\}/g, String(n));
		const filename = cfg.appendix_html.filename_pattern.replace(/\{NN\}/g, String(n).padStart(2, '0'));
		const cached = manifest?.appendices.find((a) => a.ordinal === n);
		const asset = `Appendix ${n}`;
		if (cached !== undefined) {
			appendixRows.push(rowFromManifest(asset, cached, filename));
		} else {
			appendixRows.push(emptyRow(asset, url, filename));
		}
	}
	lines.push('### Appendices');
	lines.push('');
	lines.push(renderTable(appendixRows));

	return lines.join('\n');
}

function renderRegs(cacheRoot: string): string {
	const cfg = loadRegsConfig();
	const lines: string[] = ['## Regulations (CFR via eCFR)', ''];
	lines.push(`Base: \`${cfg.ecfr_base}\``);
	lines.push('');
	const titleGroups: Map<'14' | '49', string[]> = new Map();
	for (const t of cfg.titles) {
		const list = titleGroups.get(t.title) ?? [];
		const desc = t.parts.length > 0 ? `parts ${t.parts.join(', ')}` : 'full title';
		list.push(desc);
		titleGroups.set(t.title, list);
	}
	for (const [title, descs] of [...titleGroups.entries()].sort()) {
		const titleDir = join(cacheRoot, 'regulations', `cfr-${title}`);
		const manifest = readCorpusManifestFile(join(titleDir, 'manifest.json'));
		const rows: RowFields[] = [];
		for (const desc of descs) {
			const cached = manifest?.entries.find((e) =>
				e.doc.includes(desc.includes('parts') ? `parts-${desc.replace('parts ', '').split(',')[0]?.trim()}` : 'full'),
			);
			if (cached !== undefined) {
				rows.push(rowFromManifest(desc, cached, cached.source_filename));
			} else {
				rows.push(emptyRow(desc, '(eCFR API)', '-'));
			}
		}
		lines.push(`### Title ${title}`);
		lines.push('');
		lines.push(renderTable(rows));
	}
	return lines.join('\n');
}

export function buildInventory(cacheRoot: string, generatedAt: string): string {
	const lines: string[] = [];
	lines.push('# Source inventory');
	lines.push('');
	lines.push('Generated by `bun run sources inventory` from YAML config + cache manifests.');
	lines.push('');
	lines.push(`Last regenerated: ${generatedAt}`);
	lines.push('');
	lines.push(renderHandbooksSection(cacheRoot));
	lines.push('');
	lines.push(renderHandbooksExtras(cacheRoot));
	lines.push('');
	lines.push(renderFlatCorpus('Advisory Circulars', 'ac', cacheRoot));
	lines.push('');
	lines.push(renderFlatCorpus('ACS -- Airman Certification Standards', 'acs', cacheRoot));
	lines.push('');
	lines.push(renderAim(cacheRoot));
	lines.push('');
	lines.push(renderRegs(cacheRoot));
	lines.push('');
	return lines.join('\n');
}

export interface RunInventoryOptions {
	readonly cacheRoot?: string;
	readonly outputPath?: string;
	readonly generatedAt?: string;
}

export async function runInventory(opts: RunInventoryOptions = {}): Promise<number> {
	const cacheRoot = opts.cacheRoot ?? resolveCacheRoot();
	// `generatedAt` defaults to a stable per-day value so re-runs in the same
	// session produce byte-equal output (the test plan's idempotency check).
	// Operators that want a wall-clock timestamp can pass `--now`; default is
	// the date portion only.
	const generatedAt = opts.generatedAt ?? new Date().toISOString().slice(0, 10);
	const outputPath = opts.outputPath ?? join(process.cwd(), 'docs', 'sources', 'INVENTORY.md');
	const content = buildInventory(cacheRoot, generatedAt);
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, content, 'utf-8');
	console.log(`Wrote ${outputPath} (${content.length} bytes).`);
	return 0;
}

// Avoid unused-import warning when manifest existence isn't needed (the
// TS compiler can't tell from the helper functions above that we always
// use these).
void existsSync;
