/**
 * `bun run sources verify-urls` -- HEAD-check every URL in the source-corpus
 * YAML config. Reports 404s with structured remediation pointing at the YAML
 * field that needs an operator edit.
 *
 * NOT in CI -- network dependency. Operator runs this before a release or
 * after a suspected FAA URL rotation.
 *
 * Output format:
 *
 *   - One row per URL: `<status> <field-path> <url> [note]`.
 *   - On any 404 / non-2xx, emit a structured remediation block at the end:
 *     "ERROR: <YAML field> -- HEAD HTTP <status> for <url>".
 *   - For AIM, also assert sections_per_chapter[i] entries return 200; a
 *     mismatch yields a copy-pasteable replacement value for the array.
 *
 * Exit code: 0 if every URL returns 2xx + (for AIM) section count matches,
 * 1 otherwise.
 */

import {
	listHandbookSlugs,
	loadAcConfig,
	loadAcsConfig,
	loadAimConfig,
	loadHandbookConfig,
	loadHandbooksExtrasConfig,
} from './config/loader';
import { headRequest } from './download/http';
import { resolveChapterUrls } from './download/scrape';

interface UrlCheck {
	readonly fieldPath: string;
	readonly url: string;
}

interface CheckResult {
	readonly ok: boolean;
	readonly status: number | null;
	readonly note: string;
}

async function checkUrl(url: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<CheckResult> {
	try {
		const head = await headRequest(url, fetchImpl);
		if (head.status >= 200 && head.status < 300) {
			return { ok: true, status: head.status, note: '' };
		}
		return { ok: false, status: head.status, note: `HEAD HTTP ${head.status}` };
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return { ok: false, status: null, note: `HEAD failed: ${msg}` };
	}
}

function collectFlatUrls(): UrlCheck[] {
	const out: UrlCheck[] = [];
	const ac = loadAcConfig();
	for (const e of ac.entries) out.push({ fieldPath: `ac.yaml#${e.doc_id}`, url: e.url });
	const acs = loadAcsConfig();
	for (const e of acs.entries) out.push({ fieldPath: `acs.yaml#${e.doc_id}`, url: e.url });
	const extras = loadHandbooksExtrasConfig();
	for (const e of extras.entries) out.push({ fieldPath: `handbooks-extras.yaml#${e.doc_id}`, url: e.url });
	return out;
}

function collectAimUrls(): UrlCheck[] {
	const out: UrlCheck[] = [];
	const aim = loadAimConfig();
	out.push({ fieldPath: 'aim.yaml#whole_doc', url: aim.whole_doc.url });
	for (let chapter = 0; chapter < aim.chapter_html.chapter_count; chapter += 1) {
		const sectionCount = aim.chapter_html.sections_per_chapter[chapter] ?? 0;
		for (let section = 1; section <= sectionCount; section += 1) {
			const url =
				chapter === 0 && section === 1 && aim.chapter_html.chapter_0_section_url_override !== undefined
					? aim.chapter_html.chapter_0_section_url_override
					: aim.chapter_html.section_url_pattern.replace(/\{C\}/g, String(chapter)).replace(/\{S\}/g, String(section));
			out.push({
				fieldPath: `aim.yaml#chapter_html.sections_per_chapter[${chapter}].section_${section}`,
				url,
			});
		}
	}
	for (let n = 1; n <= aim.appendix_html.appendix_count; n += 1) {
		const url = aim.appendix_html.url_pattern.replace(/\{N\}/g, String(n));
		out.push({ fieldPath: `aim.yaml#appendix_html.appendix_${n}`, url });
	}
	return out;
}

function collectHandbookUrls(): UrlCheck[] {
	const out: UrlCheck[] = [];
	for (const slug of listHandbookSlugs()) {
		const hb = loadHandbookConfig(slug);
		const wholeDocUrl = hb.whole_doc?.url ?? hb.source_url;
		if (wholeDocUrl !== undefined) {
			out.push({ fieldPath: `handbooks/${slug}.yaml#whole_doc`, url: wholeDocUrl });
		}
		if (hb.chapter_pdfs !== undefined) {
			if ('direct_pattern' in hb.chapter_pdfs && hb.chapter_pdfs.direct_pattern !== undefined) {
				const offset = hb.chapter_pdfs.file_ordinal_offset;
				for (let n = 1; n <= hb.chapter_pdfs.chapter_count; n += 1) {
					const fileOrdinal = n + offset;
					const url = hb.chapter_pdfs.direct_pattern
						.replace(/\{NN\}/g, String(fileOrdinal).padStart(2, '0'))
						.replace(/\{N\}/g, String(n));
					out.push({ fieldPath: `handbooks/${slug}.yaml#chapter_pdfs.ch${n}`, url });
				}
			}
			// Two-hop scrape URLs are checked via resolveChapterUrls below; we
			// don't emit per-chapter HEAD here for two-hop because the page-URL
			// + pdf-URL pair only resolves when the index page is fetched.
			for (const a of hb.chapter_pdfs.ancillary) {
				out.push({ fieldPath: `handbooks/${slug}.yaml#chapter_pdfs.ancillary.${a.kind}`, url: a.url });
			}
		}
	}
	return out;
}

async function verifyTwoHopHandbooks(): Promise<{ ok: boolean; errors: string[] }> {
	const errors: string[] = [];
	let ok = true;
	for (const slug of listHandbookSlugs()) {
		const hb = loadHandbookConfig(slug);
		const cfg = hb.chapter_pdfs;
		if (cfg === undefined) continue;
		if (!('index_url' in cfg) || cfg.index_url === undefined) continue;
		try {
			const resolved = await resolveChapterUrls(cfg.index_url, cfg.chapter_page_pattern, cfg.chapter_count);
			if (resolved.length !== cfg.chapter_count) {
				ok = false;
				errors.push(
					`handbooks/${slug}.yaml#chapter_pdfs: scrape returned ${resolved.length} chapters, ` +
						`config says ${cfg.chapter_count}`,
				);
			}
		} catch (error) {
			ok = false;
			const msg = error instanceof Error ? error.message : String(error);
			errors.push(`handbooks/${slug}.yaml#chapter_pdfs: two-hop scrape failed: ${msg}`);
		}
	}
	return { ok, errors };
}

async function verifyAimSectionCount(): Promise<{ ok: boolean; errors: string[] }> {
	// AIM section counts are validated by the per-section URL HEAD checks
	// above (a 404 on chap{C}_section_{S}.html means the publisher dropped
	// that section). For an explicit "count is X but should be Y" check, we
	// HEAD chap{C}_section_{N+1}.html for each chapter and report when it
	// returns 200 (the publisher added a section we don't have configured).
	const errors: string[] = [];
	let ok = true;
	const aim = loadAimConfig();
	for (let chapter = 0; chapter < aim.chapter_html.chapter_count; chapter += 1) {
		const expectedCount = aim.chapter_html.sections_per_chapter[chapter] ?? 0;
		const probeUrl = aim.chapter_html.section_url_pattern
			.replace(/\{C\}/g, String(chapter))
			.replace(/\{S\}/g, String(expectedCount + 1));
		try {
			const head = await headRequest(probeUrl);
			if (head.status >= 200 && head.status < 300) {
				ok = false;
				const newArr = [...aim.chapter_html.sections_per_chapter];
				newArr[chapter] = expectedCount + 1;
				errors.push(
					`AIM chapter ${chapter} section count mismatch:\n` +
						`  YAML: aim.yaml#chapter_html.sections_per_chapter[${chapter}] = ${expectedCount}\n` +
						`  actual: at least ${expectedCount + 1} sections found (${probeUrl} returns 200)\n` +
						`  suggested edit (replace the array literal):\n` +
						`    sections_per_chapter: ${JSON.stringify(newArr)}`,
				);
			}
		} catch {
			// Probe failure is fine -- the section beyond expectedCount didn't load.
		}
	}
	return { ok, errors };
}

export async function runVerifyUrls(): Promise<number> {
	console.log('Verifying source-corpus URLs (HEAD only). NOT in CI -- network dependent.');
	console.log('');

	const checks: UrlCheck[] = [...collectFlatUrls(), ...collectAimUrls(), ...collectHandbookUrls()];
	const errors: string[] = [];
	let okCount = 0;

	for (const check of checks) {
		const result = await checkUrl(check.url);
		if (result.ok) {
			okCount += 1;
			process.stdout.write('.');
			if (okCount % 60 === 0) process.stdout.write('\n');
		} else {
			process.stdout.write('F');
			errors.push(`ERROR: ${check.fieldPath} -- ${result.note} for ${check.url}`);
		}
	}
	process.stdout.write('\n\n');

	const twoHop = await verifyTwoHopHandbooks();
	errors.push(...twoHop.errors);
	const aimCount = await verifyAimSectionCount();
	errors.push(...aimCount.errors);

	if (errors.length === 0) {
		console.log(`OK: ${okCount}/${checks.length} URLs verified.`);
		return 0;
	}

	console.error(`FAILED: ${okCount}/${checks.length} URLs OK; ${errors.length} errors:`);
	console.error('');
	for (const e of errors) {
		console.error(e);
		console.error('');
	}
	return 1;
}
