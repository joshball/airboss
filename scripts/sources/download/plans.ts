/**
 * URL plans + plan builders for the source downloader.
 *
 * The per-corpus targets (`AC_TARGETS`, `ACS_TARGETS`, `HANDBOOKS_EXTRAS_TARGETS`,
 * `AIM_PDF_URL`) are the verified URL list. When the FAA rotates a PDF URL,
 * edit the entry here and re-run `bun run sources download --verify`.
 *
 * Cache layout (per ADR 021, supersedes ADR 018's filename layout):
 *
 *   handbooks/<slug>/<edition>/<edition>.pdf
 *   ac/<doc-id>.pdf
 *   acs/<doc-id>.pdf
 *   aim/<edition>.pdf
 *   regulations/cfr-<title>/<edition>.xml                     (full)
 *   regulations/cfr-<title>/<edition>-parts-<filter>.xml      (filtered)
 */

import { join } from 'node:path';
import type { CliArgs, Corpus } from './args';
import { fetchEcfrTitles, latestAmendedOnFor } from './ecfr';

export { SCHEMA_VERSION, USER_AGENT } from './constants';

export const ECFR_BASE = 'https://www.ecfr.gov/api/versioner/v1/full';
export const ECFR_TITLES_URL = 'https://www.ecfr.gov/api/versioner/v1/titles.json';

/**
 * AIM is a single verified URL. The earlier candidate list (sites/, atpubs/)
 * 404s today; only the canonical /publications/media/ path serves the file.
 */
export const AIM_PDF_URL = 'https://www.faa.gov/air_traffic/publications/media/aim.pdf';

export interface RegsTarget {
	readonly title: '14' | '49';
	readonly partFilter?: ReadonlySet<string>;
	readonly editionDate: string;
}

export interface PdfTarget {
	readonly corpus: 'aim' | 'ac' | 'acs' | 'handbooks';
	readonly doc: string;
	readonly edition: string | null;
	readonly url: string;
	readonly filename: string;
}

export interface DownloadPlan {
	readonly corpus: Corpus;
	readonly doc: string;
	readonly edition: string | null;
	readonly url: string;
	readonly destPath: string;
	readonly extension: 'pdf' | 'xml';
}

const AC_BASE = 'https://www.faa.gov/documentLibrary/media/Advisory_Circular';

export const AC_TARGETS: readonly PdfTarget[] = [
	mkAc('00-6', 'B', 'AC_00-6B.pdf'),
	mkAc('60-22', '', 'AC_60-22.pdf'),
	mkAc('61-65', 'J', 'AC_61-65J.pdf'),
	mkAc('61-83', 'J', 'AC_61-83J.pdf'),
	mkAc('61-98', 'D', 'AC_61-98D.pdf'),
	mkAc('90-66', 'C', 'AC_90-66C.pdf'),
	mkAc('91-79', 'A', 'AC_91-79A.pdf'),
	mkAc('91-92', '', 'AC_91-92.pdf'),
	mkAc('120-71', 'B', 'AC_120-71B.pdf'),
	// AC 91-21-1D uses a dot between 91 and 21 in the filename, not a dash.
	mkAc('91-21', '1D', 'AC_91.21-1D.pdf'),
	mkAc('25-7', 'D', 'AC_25-7D.pdf'),
	mkAc('150-5210', '7D', 'AC_150_5210-7D.pdf'),
];

const ACS_BASE = 'https://www.faa.gov/training_testing/testing/acs';

export const ACS_TARGETS: readonly PdfTarget[] = [
	mkAcs('faa-s-acs-6', 'private_airplane_acs_6.pdf'),
	mkAcs('faa-s-acs-8', 'instrument_rating_airplane_acs_8.pdf'),
	mkAcs('faa-s-acs-7', 'commercial_airplane_acs_7.pdf'),
	mkAcs('faa-s-acs-11', 'atp_airplane_acs_11.pdf'),
	mkAcs('faa-s-acs-25', 'cfi_airplane_acs_25.pdf'),
];

const HANDBOOKS_BASE = 'https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation';

export const HANDBOOKS_EXTRAS_TARGETS: readonly PdfTarget[] = [
	mkHbk('faa-h-8083-2', 'risk_management_handbook.pdf'),
	mkHbk('faa-h-8083-9', 'aviation_instructors_handbook.pdf'),
	mkHbk('faa-h-8083-15', 'instrument_flying_handbook.pdf'),
	mkHbk('faa-h-8083-16', 'instrument_procedures_handbook.pdf'),
	mkHbk('faa-h-8083-27', 'sport_pilot_handbook.pdf'),
	mkHbk('faa-h-8083-30', 'amt_general_handbook.pdf'),
	mkHbk('faa-h-8083-32', 'amt_powerplant_handbook.pdf'),
	mkHbk('faa-h-8083-34', 'risk_management_handbook_for_ga_pilots.pdf'),
];

function mkAc(number: string, revision: string, filename: string): PdfTarget {
	const docId = revision.length > 0 ? `ac-${number}-${revision}`.toLowerCase() : `ac-${number}`.toLowerCase();
	const edition = revision.length > 0 ? revision : null;
	return {
		corpus: 'ac',
		doc: docId,
		edition,
		url: `${AC_BASE}/${filename}`,
		filename,
	};
}

function mkAcs(docId: string, filename: string): PdfTarget {
	return {
		corpus: 'acs',
		doc: docId,
		edition: null,
		url: `${ACS_BASE}/${filename}`,
		filename,
	};
}

function mkHbk(docId: string, filename: string): PdfTarget {
	return {
		corpus: 'handbooks',
		doc: docId,
		edition: null,
		url: `${HANDBOOKS_BASE}/${filename}`,
		filename,
	};
}

interface BuildPlansOptions {
	readonly fetchImpl?: typeof fetch;
}

export async function buildPlans(args: CliArgs, root: string, opts: BuildPlansOptions = {}): Promise<DownloadPlan[]> {
	const plans: DownloadPlan[] = [];

	if (args.corpora.has('regs')) {
		const editionFor: Record<'14' | '49', string> = await resolveRegsEditions(args, opts.fetchImpl);
		const regsTargets: readonly RegsTarget[] = [
			{ title: '14', editionDate: editionFor['14'] },
			{ title: '49', editionDate: editionFor['49'], partFilter: new Set(['830']) },
			{ title: '49', editionDate: editionFor['49'], partFilter: new Set(['1552']) },
		];
		for (const t of regsTargets) plans.push(buildRegsPlan(t, root));
	}

	if (args.corpora.has('aim')) {
		const edition = currentMonthEdition();
		plans.push({
			corpus: 'aim',
			doc: 'aim',
			edition,
			url: AIM_PDF_URL,
			destPath: join(root, 'aim', `${edition}.pdf`),
			extension: 'pdf',
		});
	}

	if (args.corpora.has('ac')) {
		for (const t of AC_TARGETS) plans.push(pdfTargetToPlan(t, root));
	}

	if (args.corpora.has('acs')) {
		for (const t of ACS_TARGETS) plans.push(pdfTargetToPlan(t, root));
	}

	if (args.corpora.has('handbooks') && args.includeHandbooksExtras) {
		for (const t of HANDBOOKS_EXTRAS_TARGETS) plans.push(pdfTargetToPlan(t, root));
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

function buildRegsPlan(target: RegsTarget, root: string): DownloadPlan {
	const partSlug =
		target.partFilter !== undefined && target.partFilter.size > 0
			? `parts-${[...target.partFilter].sort().join('-')}`
			: 'full';
	const url = buildEcfrUrl(target);
	const filename = partSlug === 'full' ? `${target.editionDate}.xml` : `${target.editionDate}-${partSlug}.xml`;
	return {
		corpus: 'regs',
		doc: `cfr-${target.title}-${partSlug}`,
		edition: target.editionDate,
		url,
		destPath: join(root, 'regulations', `cfr-${target.title}`, filename),
		extension: 'xml',
	};
}

export function buildEcfrUrl(target: RegsTarget): string {
	const base = `${ECFR_BASE}/${target.editionDate}/title-${target.title}.xml`;
	if (target.partFilter === undefined || target.partFilter.size === 0) return base;
	const params = new URLSearchParams();
	for (const part of target.partFilter) params.append('part', part);
	return `${base}?${params.toString()}`;
}

/**
 * Build a download plan for a flat-corpus PDF target (AC, ACS, AIM, handbooks
 * extras). Per ADR 021:
 *
 *   - AC, ACS: flat at `<corpus>/<doc-id>.pdf` (no edition dir).
 *   - Handbooks: per-edition dir at `handbooks/<slug>/<slug>.pdf` (slug already
 *     encodes the edition; the dir exists so errata can co-locate).
 *
 * AIM is built inline in `buildPlans` (single-document corpus, slightly
 * different path).
 */
function pdfTargetToPlan(t: PdfTarget, root: string): DownloadPlan {
	let destPath: string;
	if (t.corpus === 'handbooks') {
		// Slug already encodes the edition for this URL; re-use it as the dir.
		destPath = join(root, 'handbooks', t.doc, `${t.doc}.pdf`);
	} else {
		// AC, ACS: flat at `<corpus>/<doc-id>.pdf`.
		destPath = join(root, t.corpus, `${t.doc}.pdf`);
	}
	return {
		corpus: t.corpus,
		doc: t.doc,
		edition: t.edition,
		url: t.url,
		destPath,
		extension: 'pdf',
	};
}

export function currentMonthEdition(): string {
	const d = new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	return `${yyyy}-${mm}`;
}
