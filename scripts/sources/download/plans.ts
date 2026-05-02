/**
 * URL plans + plan builders for the source downloader.
 *
 * The per-corpus URL inventory lives in YAML at `scripts/sources/config/`:
 *
 *   - `ac.yaml`              -- 12 Advisory Circulars
 *   - `acs.yaml`             -- 5 Airman Certification Standards
 *   - `aim.yaml`             -- bundled PDF + section + appendix HTML
 *   - `regs.yaml`            -- eCFR base URLs + per-title list
 *   - `handbooks-extras.yaml`-- 8 whole-doc-only handbooks
 *   - `handbooks/<slug>.yaml`-- per-handbook configs (whole-doc + chapter PDFs)
 *
 * `buildPlans` reads the YAMLs at runtime and emits one DownloadPlan per
 * asset. For chapter-aware handbooks, that's whole-doc + each chapter PDF +
 * each ancillary PDF. For AIM, it's the bundled PDF + each section HTML + each
 * appendix HTML.
 *
 * Cache layout (per ADR 021 + ADR 022):
 *
 *   handbooks/<slug>/<edition>/<edition>.pdf                # whole-doc (kept)
 *   handbooks/<slug>/<edition>/<edition>-ch<NN>.pdf         # chapter PDFs (zero-padded)
 *   handbooks/<slug>/<edition>/<edition>-front.pdf          # ancillaries
 *   handbooks/<slug>/<edition>/<edition>-glossary.pdf
 *   handbooks/<slug>/<edition>/<edition>-index.pdf
 *   ac/<doc-id>.pdf
 *   acs/<doc-id>.pdf
 *   aim/aim.pdf                                             # bundled
 *   aim/chap<CC>_section_<SS>.html                          # 72 section files
 *   aim/appendix_<NN>.html                                  # 5 appendix files
 *   regulations/cfr-<title>/<edition>.xml                   # full title
 *   regulations/cfr-<title>/<edition>-parts-<filter>.xml    # filtered
 */

import { join } from 'node:path';
import { SOURCE_CACHE } from '@ab/constants';
import {
	listHandbookSlugs,
	loadAcConfig,
	loadAcsConfig,
	loadAimConfig,
	loadHandbookConfig,
	loadHandbooksExtrasConfig,
	loadRegsConfig,
} from '../config/loader';
import type { AimConfig, AncillaryConfig, ChapterPdfsConfig, HandbookConfig } from '../config/schemas';
import type { CliArgs, Corpus } from './args';
import { fetchEcfrTitles, latestAmendedOnFor } from './ecfr';

export { SCHEMA_VERSION, USER_AGENT } from './constants';

export interface RegsTarget {
	readonly title: '14' | '49';
	readonly partFilter?: ReadonlySet<string>;
	readonly editionDate: string;
}

/**
 * Discriminator for the kind of asset a plan represents. Whole-doc and ancillary
 * PDFs both go to the per-edition handbook dir; chapters carry an ordinal; AIM
 * sections/appendices flow to the flat AIM corpus dir. The `extension` is
 * derived from the kind for HTML vs PDF dispatch in `execute.ts`.
 */
export type PlanKind =
	| 'whole-doc'
	| 'chapter-pdf'
	| 'ancillary-pdf'
	| 'aim-section'
	| 'aim-appendix'
	| 'flat-pdf'
	| 'regs-xml';

export interface DownloadPlan {
	readonly corpus: Corpus;
	readonly doc: string;
	readonly edition: string | null;
	readonly url: string;
	readonly destPath: string;
	readonly extension: 'pdf' | 'xml' | 'html';
	readonly kind: PlanKind;
	/** 1-indexed chapter ordinal for chapter-pdf / aim-section plans. */
	readonly ordinal: number | null;
	/** AIM-section: the section number within the chapter. */
	readonly section: number | null;
	/** Ancillary kind for ancillary-pdf plans. */
	readonly ancillaryKind: AncillaryConfig['kind'] | null;
	/** For two-hop chapter PDFs: the intermediate chapter-page HTML URL. */
	readonly chapterPageUrl: string | null;
}

interface BuildPlansOptions {
	readonly fetchImpl?: typeof fetch;
	/**
	 * Test seam: when set, two-hop scrapes use this resolver instead of fetching
	 * the live publisher index page. Returns one entry per chapter ordinal in
	 * 1..chapter_count order, each with the resolved final-PDF URL and (when
	 * known) the intermediate chapter-page URL.
	 */
	readonly resolveChapterUrls?: (
		indexUrl: string,
		pagePattern: string,
		chapterCount: number,
	) => Promise<readonly { ordinal: number; pageUrl: string; pdfUrl: string }[]>;
}

export async function buildPlans(args: CliArgs, root: string, opts: BuildPlansOptions = {}): Promise<DownloadPlan[]> {
	const plans: DownloadPlan[] = [];

	if (args.corpora.has('regs')) {
		const editionFor: Record<'14' | '49', string> = await resolveRegsEditions(args, opts.fetchImpl);
		const regsConfig = loadRegsConfig();
		for (const title of regsConfig.titles) {
			const partFilter = title.parts.length > 0 ? new Set(title.parts) : undefined;
			const target: RegsTarget = {
				title: title.title,
				editionDate: editionFor[title.title],
				...(partFilter !== undefined ? { partFilter } : {}),
			};
			plans.push(buildRegsPlan(target, regsConfig.ecfr_base, root));
		}
	}

	if (args.corpora.has('aim')) {
		const aim = loadAimConfig();
		plans.push(...buildAimPlans(aim, root));
	}

	if (args.corpora.has('ac')) {
		const ac = loadAcConfig();
		for (const entry of ac.entries) {
			plans.push(flatPlan('ac', entry.doc_id, entry.edition, entry.url, entry.filename, root));
		}
	}

	if (args.corpora.has('acs')) {
		const acs = loadAcsConfig();
		for (const entry of acs.entries) {
			plans.push(flatPlan('acs', entry.doc_id, entry.edition, entry.url, entry.filename, root));
		}
	}

	if (args.corpora.has('handbooks')) {
		// Per-handbook configs (Class A1/A2 + Class C handbooks with their own
		// per-edition cache dir) always run. Whole-doc + chapter PDFs + ancillary
		// PDFs all flow through one path.
		for (const slug of listHandbookSlugs()) {
			const hb = loadHandbookConfig(slug);
			plans.push(...(await buildHandbookPlans(hb, root, opts)));
		}
		// Legacy whole-doc-only handbooks (gated by --include-handbooks-extras
		// since they're a long tail and we don't want to fetch them on every
		// `bun run sources download` by default).
		if (args.includeHandbooksExtras) {
			const extras = loadHandbooksExtrasConfig();
			for (const entry of extras.entries) {
				plans.push(flatPlan('handbooks', entry.doc_id, entry.edition, entry.url, entry.filename, root));
			}
		}
	}

	return plans;
}

async function resolveRegsEditions(
	args: CliArgs,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Record<'14' | '49', string>> {
	if (args.editionDate !== null) {
		return { '14': args.editionDate, '49': args.editionDate };
	}
	const titles = await fetchEcfrTitles(fetchImpl);
	return {
		'14': latestAmendedOnFor(titles, '14'),
		'49': latestAmendedOnFor(titles, '49'),
	};
}

function buildRegsPlan(target: RegsTarget, ecfrBase: string, root: string): DownloadPlan {
	const partSlug =
		target.partFilter !== undefined && target.partFilter.size > 0
			? `parts-${[...target.partFilter].sort().join('-')}`
			: 'full';
	const url = buildEcfrUrl(target, ecfrBase);
	const filename = partSlug === 'full' ? `${target.editionDate}.xml` : `${target.editionDate}-${partSlug}.xml`;
	return {
		corpus: 'regs',
		doc: `cfr-${target.title}-${partSlug}`,
		edition: target.editionDate,
		url,
		destPath: join(root, SOURCE_CACHE.REGS, `cfr-${target.title}`, filename),
		extension: 'xml',
		kind: 'regs-xml',
		ordinal: null,
		section: null,
		ancillaryKind: null,
		chapterPageUrl: null,
	};
}

export function buildEcfrUrl(target: RegsTarget, ecfrBase = 'https://www.ecfr.gov/api/versioner/v1/full'): string {
	const base = `${ecfrBase}/${target.editionDate}/title-${target.title}.xml`;
	if (target.partFilter === undefined || target.partFilter.size === 0) return base;
	const params = new URLSearchParams();
	for (const part of target.partFilter) params.append('part', part);
	return `${base}?${params.toString()}`;
}

function flatPlan(
	corpus: 'ac' | 'acs' | 'handbooks',
	docId: string,
	edition: string | null,
	url: string,
	_filename: string,
	root: string,
): DownloadPlan {
	let destPath: string;
	if (corpus === 'handbooks') {
		// Slug already encodes the edition for these whole-doc-only handbooks
		// (handbooks-extras); re-use it as the dir.
		destPath = join(root, SOURCE_CACHE.HANDBOOKS, docId, `${docId}.pdf`);
	} else {
		destPath = join(root, corpus, `${docId}.pdf`);
	}
	return {
		corpus,
		doc: docId,
		edition,
		url,
		destPath,
		extension: 'pdf',
		kind: 'flat-pdf',
		ordinal: null,
		section: null,
		ancillaryKind: null,
		chapterPageUrl: null,
	};
}

// ---------------------------------------------------------------------------
// Per-handbook plan generation
// ---------------------------------------------------------------------------

async function buildHandbookPlans(hb: HandbookConfig, root: string, opts: BuildPlansOptions): Promise<DownloadPlan[]> {
	const plans: DownloadPlan[] = [];
	const slug = hb.document_slug;
	const edition = hb.edition;
	const editionRoot = join(root, SOURCE_CACHE.HANDBOOKS, slug, edition);

	// Whole-doc PDF.
	const wholeDocUrl = hb.whole_doc?.url ?? hb.source_url;
	if (wholeDocUrl === undefined) {
		throw new Error(`handbook ${slug}: no whole_doc.url or source_url in config`);
	}
	const wholeDocFilename = hb.whole_doc?.filename ?? `${edition}.pdf`;
	plans.push({
		corpus: 'handbooks',
		doc: slug,
		edition,
		url: wholeDocUrl,
		destPath: join(editionRoot, wholeDocFilename),
		extension: 'pdf',
		kind: 'whole-doc',
		ordinal: null,
		section: null,
		ancillaryKind: null,
		chapterPageUrl: null,
	});

	if (hb.chapter_pdfs !== undefined) {
		plans.push(...(await buildChapterPdfPlans(hb, hb.chapter_pdfs, editionRoot, opts)));
		for (const ancillary of hb.chapter_pdfs.ancillary) {
			plans.push(buildAncillaryPlan(slug, edition, editionRoot, ancillary));
		}
	}

	// Apply excluded_assets filter: drop any plan whose URL contains a configured
	// substring. This is the operator-controlled "skip even if the publisher
	// serves it" gate (stale errata duplicates, addenda, etc.).
	const excluded = hb.excluded_assets ?? [];
	if (excluded.length === 0) return plans;
	return plans.filter((p) => !excluded.some((pattern) => p.url.includes(pattern)));
}

async function buildChapterPdfPlans(
	hb: HandbookConfig,
	chapterPdfs: ChapterPdfsConfig,
	editionRoot: string,
	opts: BuildPlansOptions,
): Promise<DownloadPlan[]> {
	const plans: DownloadPlan[] = [];
	const offset = chapterPdfs.file_ordinal_offset;

	const resolved: { ordinal: number; pdfUrl: string; pageUrl: string | null }[] = [];

	if ('direct_pattern' in chapterPdfs && chapterPdfs.direct_pattern !== undefined) {
		// Direct URL pattern: substitute {N} (1-indexed chapter ordinal) and {NN}
		// (zero-padded, with file_ordinal_offset applied to allow AFH-style
		// "front=01, ch1=02" sequencing).
		for (let n = 1; n <= chapterPdfs.chapter_count; n += 1) {
			const fileOrdinal = n + offset;
			const url = chapterPdfs.direct_pattern
				.replace(/\{NN\}/g, String(fileOrdinal).padStart(2, '0'))
				.replace(/\{N\}/g, String(n));
			resolved.push({ ordinal: n, pdfUrl: url, pageUrl: null });
		}
	} else if ('index_url' in chapterPdfs && chapterPdfs.index_url !== undefined) {
		// Two-hop scrape. Network resolution happens inside the scraper; tests
		// inject `opts.resolveChapterUrls` to avoid hitting the live FAA.
		const resolver =
			opts.resolveChapterUrls ??
			(async (indexUrl: string, pagePattern: string, chapterCount: number) => {
				const { resolveChapterUrls } = await import('./scrape');
				return resolveChapterUrls(indexUrl, pagePattern, chapterCount, opts.fetchImpl);
			});
		const list = await resolver(chapterPdfs.index_url, chapterPdfs.chapter_page_pattern, chapterPdfs.chapter_count);
		for (const r of list) {
			resolved.push({ ordinal: r.ordinal, pdfUrl: r.pdfUrl, pageUrl: r.pageUrl });
		}
	}

	for (const r of resolved) {
		const padded = String(r.ordinal).padStart(2, '0');
		const filename = `${hb.edition}-ch${padded}.pdf`;
		plans.push({
			corpus: 'handbooks',
			doc: hb.document_slug,
			edition: hb.edition,
			url: r.pdfUrl,
			destPath: join(editionRoot, filename),
			extension: 'pdf',
			kind: 'chapter-pdf',
			ordinal: r.ordinal,
			section: null,
			ancillaryKind: null,
			chapterPageUrl: r.pageUrl,
		});
	}

	return plans;
}

function buildAncillaryPlan(
	slug: string,
	edition: string,
	editionRoot: string,
	ancillary: AncillaryConfig,
): DownloadPlan {
	const filenamePart =
		ancillary.kind === 'appendix' ? `appendix-${ancillary.appendix_id ?? 'unknown'}` : ancillary.kind;
	const filename = `${edition}-${filenamePart}.pdf`;
	return {
		corpus: 'handbooks',
		doc: slug,
		edition,
		url: ancillary.url,
		destPath: join(editionRoot, filename),
		extension: 'pdf',
		kind: 'ancillary-pdf',
		ordinal: null,
		section: null,
		ancillaryKind: ancillary.kind,
		chapterPageUrl: null,
	};
}

// ---------------------------------------------------------------------------
// AIM plans (bundled PDF + section HTML + appendix HTML)
// ---------------------------------------------------------------------------

function buildAimPlans(aim: AimConfig, root: string): DownloadPlan[] {
	const plans: DownloadPlan[] = [];
	const aimRoot = join(root, SOURCE_CACHE.AIM);

	// Bundled PDF (kept alongside HTML, archival).
	plans.push({
		corpus: 'aim',
		doc: 'aim',
		edition: null,
		url: aim.whole_doc.url,
		destPath: join(aimRoot, aim.whole_doc.filename),
		extension: 'pdf',
		kind: 'whole-doc',
		ordinal: null,
		section: null,
		ancillaryKind: null,
		chapterPageUrl: null,
	});

	// Section HTML files. Indexed 0..chapter_count-1; index 0 = ch0.
	for (let chapter = 0; chapter < aim.chapter_html.chapter_count; chapter += 1) {
		const sectionCount = aim.chapter_html.sections_per_chapter[chapter] ?? 0;
		for (let section = 1; section <= sectionCount; section += 1) {
			const sourceUrl =
				chapter === 0 && section === 1 && aim.chapter_html.chapter_0_section_url_override !== undefined
					? aim.chapter_html.chapter_0_section_url_override
					: aim.chapter_html.section_url_pattern.replace(/\{C\}/g, String(chapter)).replace(/\{S\}/g, String(section));
			const filename = aim.chapter_html.section_filename_pattern
				.replace(/\{CC\}/g, String(chapter).padStart(2, '0'))
				.replace(/\{SS\}/g, String(section).padStart(2, '0'));
			if (aim.excluded_assets.some((pattern) => sourceUrl.includes(pattern))) continue;
			plans.push({
				corpus: 'aim',
				doc: `aim-chap${String(chapter).padStart(2, '0')}-section${String(section).padStart(2, '0')}`,
				edition: null,
				url: sourceUrl,
				destPath: join(aimRoot, filename),
				extension: 'html',
				kind: 'aim-section',
				ordinal: chapter,
				section,
				ancillaryKind: null,
				chapterPageUrl: null,
			});
		}
	}

	// Appendix HTML files. Ordinals 1..appendix_count.
	for (let n = 1; n <= aim.appendix_html.appendix_count; n += 1) {
		const sourceUrl = aim.appendix_html.url_pattern.replace(/\{N\}/g, String(n));
		const filename = aim.appendix_html.filename_pattern.replace(/\{NN\}/g, String(n).padStart(2, '0'));
		if (aim.excluded_assets.some((pattern) => sourceUrl.includes(pattern))) continue;
		plans.push({
			corpus: 'aim',
			doc: `aim-appendix${String(n).padStart(2, '0')}`,
			edition: null,
			url: sourceUrl,
			destPath: join(aimRoot, filename),
			extension: 'html',
			kind: 'aim-appendix',
			ordinal: n,
			section: null,
			ancillaryKind: null,
			chapterPageUrl: null,
		});
	}

	return plans;
}

export function currentMonthEdition(): string {
	const d = new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	return `${yyyy}-${mm}`;
}
