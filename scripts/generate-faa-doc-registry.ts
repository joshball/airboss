/**
 * Scan disk for FAA documents (handbooks, ACs, ACS, CFR-14, CFR-49) and emit
 * `libs/aviation/src/references/faa-docs.ts`.
 *
 * Each scanned doc becomes one `Reference` row carrying every form a user
 * might type:
 *   id          stable, source-prefixed (e.g. "doc-faa-h-8083-28b")
 *   displayName "Aviation Weather Handbook"
 *   aliases     ["FAA-H-8083-28B", "FAA-H-8083-28", "8083-28", "AvWX",
 *                "Aviation Weather Handbook", "aviation weather"]
 *   keywords    punctuation-stripped + synonym-expanded forms
 *
 * Run via `bun scripts/generate-faa-doc-registry.ts`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const OUTPUT_PATH = join(REPO_ROOT, 'libs/aviation/src/references/faa-docs.ts');

/**
 * Source-type values emitted by this generator. Mirrors a subset of
 * REFERENCE_SOURCE_TYPES (kept as a literal union here rather than imported
 * because the generator runs under bun outside the build graph; keeping the
 * union literal is faster to read and matches the snapshot the emitter writes).
 */
type EmittedSourceType =
	| 'cfr'
	| 'aim'
	| 'ac'
	| 'acs'
	| 'phak'
	| 'afh'
	| 'ifh'
	| 'avwx'
	| 'iph'
	| 'rmh'
	| 'aih'
	| 'hfh'
	| 'gfh'
	| 'bfh';

interface DocRow {
	id: string;
	displayName: string;
	aliases: string[];
	keywords: string[];
	sourceType: EmittedSourceType;
	aviationTopic: readonly string[];
	flightRules: 'vfr' | 'ifr' | 'both' | 'na';
	knowledgeKind: 'reference' | 'regulation';
	paraphrase: string;
}

// ---------- token helpers ----------

/** Lowercase + strip non-alphanumeric for keyword matching. */
function stripPunct(s: string): string {
	return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Split a doc CODE (not a title) into fragments. Input must look like a doc
 * code (`FAA-H-8083-28`, `14 CFR 91`, `AC 00-6B`) -- short and structured.
 * Returns the original, the punctuation-stripped form, progressive
 * right-aligned joins, and plain numeric fragments. Bail out on inputs that
 * are too long to be a code (>40 chars).
 */
function codeFragments(code: string): string[] {
	if (code.length > 40) return [code];
	const fragments = new Set<string>();
	fragments.add(code);
	fragments.add(code.toLowerCase());
	fragments.add(stripPunct(code));

	const parts = code.split(/[-\s]+/).filter(Boolean);
	if (parts.length > 1) {
		// Join progressively from the right: 8083-28, H-8083-28, FAA-H-8083-28
		for (let i = parts.length - 2; i >= 0; i--) {
			fragments.add(parts.slice(i).join('-'));
		}
	}
	// Plain numeric fragments (≥ 3 chars to avoid noise like "1", "9")
	for (const part of parts) {
		if (/^\d+$/.test(part) && part.length >= 3) {
			fragments.add(part);
		}
	}
	return [...fragments];
}

// ---------- handbook scanner ----------

interface HandbookManifest {
	document_slug?: string;
	edition?: string;
	kind?: string;
	title?: string;
	subjects?: string[];
	primary_cert?: string;
}

const HANDBOOK_ROOT = join(REPO_ROOT, 'handbooks');

/** Canonical abbreviations for known handbooks. */
const HANDBOOK_ABBREVIATIONS: Record<string, string[]> = {
	'FAA-H-8083-25C': ['PHAK'],
	'FAA-H-8083-3C': ['AFH'],
	'FAA-H-8083-15B': ['IFH'],
	'FAA-H-8083-16B': ['IPH'],
	'FAA-H-8083-28B': ['AvWX'],
	'FAA-H-8083-2A': ['RMH'],
	'FAA-H-8083-9': ['AIH', 'IAH'],
	'FAA-H-8083-21': ['HFH'],
	'FAA-H-8083-1': ['GFH'],
	'FAA-H-8083-11': ['BFH'],
};

/**
 * Map a handbook edition code (`FAA-H-8083-NN[X]`) to its dedicated source-type
 * slot. ONE SLOT PER HANDBOOK per the command-palette WP Decision #7. PHAK,
 * AFH, IFH already had slots; AVWX/IPH/RMH/AIH/HFH/GFH/BFH are new in Phase 2.
 * Unrecognised editions fall back to `phak` (the umbrella historical default).
 */
function handbookSourceType(edition: string): EmittedSourceType {
	const m = edition.match(/^FAA-H-8083-(\d+)([A-Z])?$/);
	if (!m) return 'phak';
	const n = m[1] ?? '';
	// -25 PHAK, -3 AFH, -15 IFH, -16 IPH, -28 AvWX, -2 RMH, -9 AIH, -21 HFH,
	// -1 GFH, -11 BFH. Each is a discrete document family ("one slot per
	// handbook" -- WP Decision #7).
	if (n === '25') return 'phak';
	if (n === '3') return 'afh';
	if (n === '15') return 'ifh';
	if (n === '16') return 'iph';
	if (n === '28') return 'avwx';
	if (n === '2') return 'rmh';
	if (n === '9') return 'aih';
	if (n === '21') return 'hfh';
	if (n === '1') return 'gfh';
	if (n === '11') return 'bfh';
	return 'phak';
}

const TOPIC_BY_SUBJECT: Record<string, string[]> = {
	weather: ['weather'],
	'flight-planning': ['procedures', 'flight-planning' as never],
	regulations: ['regulations'],
	performance: ['performance'],
	aerodynamics: ['aerodynamics'],
	instruments: ['flight-instruments'],
	'instrument-procedures': ['instrument-procedures'],
	risk: ['human-factors'],
	teaching: ['human-factors'],
	mountain: ['operations'],
};

function scanHandbooks(): DocRow[] {
	if (!existsSync(HANDBOOK_ROOT)) return [];
	const rows: DocRow[] = [];

	for (const slug of readdirSync(HANDBOOK_ROOT)) {
		const slugDir = join(HANDBOOK_ROOT, slug);
		if (!statSync(slugDir).isDirectory()) continue;

		for (const edition of readdirSync(slugDir)) {
			const editionDir = join(slugDir, edition);
			if (!statSync(editionDir).isDirectory()) continue;

			const manifestPath = join(editionDir, 'manifest.json');
			if (!existsSync(manifestPath)) continue;

			const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as HandbookManifest;
			if (!manifest.title || !manifest.edition) continue;

			const code = manifest.edition;
			const codeNoRev = code.replace(/[A-Z]$/, ''); // FAA-H-8083-28B -> FAA-H-8083-28
			const aliases = new Set<string>();
			aliases.add(code);
			if (codeNoRev !== code) aliases.add(codeNoRev);

			// Numeric tail variants: "8083-28", "H-8083-28"
			const m = code.match(/^FAA-H-(\d+(?:-\d+)?)([A-Z])?$/);
			if (m) {
				aliases.add(m[1] ?? '');
				aliases.add(`H-${m[1]}`);
				aliases.add(`FAA-H-${m[1]}`);
			}

			const abbrevs = HANDBOOK_ABBREVIATIONS[code] ?? [];
			for (const a of abbrevs) aliases.add(a);

			aliases.add(manifest.title);

			const topics = new Set<string>();
			for (const subject of manifest.subjects ?? []) {
				const mapped = TOPIC_BY_SUBJECT[subject];
				if (mapped) for (const t of mapped) topics.add(t);
			}
			if (topics.size === 0) topics.add('definitions');

			const keywords = new Set<string>();
			// Codes and abbreviations get fragmented; titles do not.
			const codeForms = new Set<string>([code, codeNoRev]);
			if (m) {
				codeForms.add(m[1] ?? '');
				codeForms.add(`H-${m[1]}`);
				codeForms.add(`FAA-H-${m[1]}`);
			}
			for (const abbrev of abbrevs) codeForms.add(abbrev);
			for (const codeForm of codeForms) {
				if (!codeForm) continue;
				for (const frag of codeFragments(codeForm)) keywords.add(stripPunct(frag));
			}
			keywords.add(stripPunct(manifest.title));

			const sourceType: EmittedSourceType = handbookSourceType(code);

			rows.push({
				id: `doc-${stripPunct(code)}`,
				displayName: manifest.title,
				aliases: [...aliases].filter(Boolean).sort(),
				keywords: [...keywords].filter(Boolean).sort(),
				sourceType,
				aviationTopic: [...topics],
				flightRules: 'both',
				knowledgeKind: 'reference',
				paraphrase: `${manifest.title} (${code}) -- FAA handbook.`,
			});
		}
	}
	return rows;
}

// ---------- AC scanner ----------

interface AcIndexEntry {
	doc_slug: string;
	doc_number: string;
	revision: string;
	title: string;
}

interface AcIndex {
	entries: AcIndexEntry[];
}

function scanAcs(): DocRow[] {
	const indexPath = join(REPO_ROOT, 'ac/index.json');
	if (!existsSync(indexPath)) return [];
	const index = JSON.parse(readFileSync(indexPath, 'utf-8')) as AcIndex;

	return index.entries.map((entry) => {
		const code = `AC ${entry.doc_number}${entry.revision.toUpperCase()}`;
		const codeNoRev = `AC ${entry.doc_number}`;
		const titleClean = entry.title.replace(/^AC\s+[\w.-]+\s*[-,]\s*/i, '').trim();

		const aliases = new Set<string>([
			code,
			codeNoRev,
			entry.doc_number,
			`${entry.doc_number}${entry.revision.toUpperCase()}`,
			titleClean,
		]);

		const keywords = new Set<string>();
		// Only the doc code gets fragmented; titles do not.
		for (const codeForm of [code, codeNoRev, entry.doc_number, `${entry.doc_number}${entry.revision.toUpperCase()}`]) {
			for (const frag of codeFragments(codeForm)) keywords.add(stripPunct(frag));
		}
		keywords.add(stripPunct(titleClean));

		// Topic guess from title
		const topics = new Set<string>();
		const tl = titleClean.toLowerCase();
		if (tl.includes('weather')) topics.add('weather');
		if (tl.includes('certif') || tl.includes('certificate')) topics.add('regulations');
		if (tl.includes('operating') || tl.includes('procedures')) topics.add('procedures');
		if (tl.includes('flight test')) topics.add('performance');
		if (tl.includes('parachute')) topics.add('operations');
		if (topics.size === 0) topics.add('regulations');

		return {
			id: `doc-ac-${stripPunct(entry.doc_number)}${entry.revision}`,
			displayName: `AC ${entry.doc_number}${entry.revision.toUpperCase()} -- ${titleClean || `Advisory Circular ${entry.doc_number}`}`,
			aliases: [...aliases].filter(Boolean).sort(),
			keywords: [...keywords].filter(Boolean).sort(),
			sourceType: 'ac',
			aviationTopic: [...topics],
			flightRules: 'both',
			knowledgeKind: 'reference',
			paraphrase: `Advisory Circular ${entry.doc_number}${entry.revision.toUpperCase()} -- ${titleClean}`,
		};
	});
}

// ---------- ACS scanner ----------

interface AcsIndexEntry {
	slug: string;
	title: string;
}

interface AcsIndex {
	entries: AcsIndexEntry[];
}

function scanAcs2(): DocRow[] {
	const indexPath = join(REPO_ROOT, 'acs/index.json');
	if (!existsSync(indexPath)) return [];
	const index = JSON.parse(readFileSync(indexPath, 'utf-8')) as AcsIndex;

	return index.entries.map((entry) => {
		const m = entry.slug.match(/^([a-z]+)-airplane-acs-(\d+[a-z]?)$/);
		const cert = m?.[1] ?? '';
		const num = m?.[2] ?? '';
		const code = num ? `FAA-S-ACS-${num.toUpperCase()}` : entry.slug;

		const aliases = new Set<string>([code, entry.slug, entry.title]);
		if (cert === 'ppl') aliases.add('PPL ACS');
		if (cert === 'cpl') aliases.add('CPL ACS');
		if (cert === 'ir') aliases.add('IR ACS');
		if (cert === 'atp') aliases.add('ATP ACS');
		if (cert === 'cfi') aliases.add('CFI ACS');

		const keywords = new Set<string>();
		for (const a of aliases) {
			if (a) keywords.add(stripPunct(a));
		}

		return {
			id: `doc-${entry.slug}`,
			displayName: entry.title,
			aliases: [...aliases].filter(Boolean).sort(),
			keywords: [...keywords].filter(Boolean).sort(),
			sourceType: 'acs',
			aviationTopic: ['regulations'],
			flightRules: 'both',
			knowledgeKind: 'reference',
			paraphrase: `${entry.title} -- airman certification standard.`,
		};
	});
}

// ---------- CFR scanner ----------

interface CfrManifest {
	parts?: ReadonlyArray<{ number: string; officialTitle?: string }>;
}

function scanCfr(title: 14 | 49): DocRow[] {
	const titleRoot = join(REPO_ROOT, `regulations/cfr-${title}`);
	if (!existsSync(titleRoot)) return [];

	// Pick the most recent snapshot dir (YYYY-MM-DD), skipping `_authoring`.
	const snapshots = readdirSync(titleRoot)
		.filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n))
		.sort()
		.reverse();
	const snapshot = snapshots[0];
	if (!snapshot) return [];

	const snapshotDir = join(titleRoot, snapshot);
	// Newer snapshot layout: a single manifest.json carries `parts` with
	// `{ number, officialTitle }`. Older layout (pre-PR #817) used per-part
	// subdirectories. Prefer the manifest when present.
	const manifestPath = join(snapshotDir, 'manifest.json');
	let parts: Array<{ number: string; title?: string }> = [];
	if (existsSync(manifestPath)) {
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as CfrManifest;
		for (const p of manifest.parts ?? []) {
			parts.push({ number: p.number, title: p.officialTitle });
		}
	} else {
		parts = readdirSync(snapshotDir)
			.filter((n) => statSync(join(snapshotDir, n)).isDirectory())
			.map((number) => ({ number }));
	}

	return parts.map(({ number: part, title: officialTitle }) => {
		const aliases = new Set<string>([
			`${title} CFR ${part}`,
			`${title} CFR Part ${part}`,
			`Part ${part}`,
			`${title} CFR §${part}`,
			part,
		]);
		if (officialTitle) aliases.add(officialTitle);
		const keywords = new Set<string>();
		for (const a of aliases) keywords.add(stripPunct(a));
		keywords.add(stripPunct(`${title}cfr${part}`));
		keywords.add(stripPunct(`cfr${title}${part}`));

		const display = officialTitle ? `${title} CFR Part ${part} -- ${officialTitle}` : `${title} CFR Part ${part}`;

		return {
			id: `doc-cfr-${title}-${part}`,
			displayName: display,
			aliases: [...aliases].filter(Boolean).sort(),
			keywords: [...keywords].filter(Boolean).sort(),
			sourceType: 'cfr',
			aviationTopic: ['regulations'],
			flightRules: 'both',
			knowledgeKind: 'regulation',
			paraphrase: `Title ${title} of the Code of Federal Regulations, Part ${part}${officialTitle ? ` -- ${officialTitle}` : ''}.`,
		};
	});
}

// ---------- AIM scanner ----------

interface AimManifestEntry {
	kind: 'chapter' | 'section' | 'paragraph';
	code: string;
	title?: string;
	body_path?: string;
}

interface AimManifest {
	edition?: string;
	title?: string;
	entries?: readonly AimManifestEntry[];
}

/**
 * Scan `aim/<edition>/manifest.json` and emit one `Reference` per AIM chapter
 * and section. Paragraphs (697 of them) are skipped at the registry layer --
 * they are too granular for top-level palette results and surface instead
 * via the `loaders/aim-sections.ts` runtime FTS loader.
 */
function scanAim(): DocRow[] {
	const aimRoot = join(REPO_ROOT, 'aim');
	if (!existsSync(aimRoot)) return [];
	const editions = readdirSync(aimRoot)
		.filter((n) => /^\d{4}-\d{2}$/.test(n))
		.sort()
		.reverse();
	const edition = editions[0];
	if (!edition) return [];
	const manifestPath = join(aimRoot, edition, 'manifest.json');
	if (!existsSync(manifestPath)) return [];

	const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as AimManifest;
	const out: DocRow[] = [];
	for (const entry of manifest.entries ?? []) {
		if (entry.kind !== 'chapter' && entry.kind !== 'section') continue;
		const title = entry.title ?? `AIM ${entry.code}`;
		const aliases = new Set<string>([`AIM ${entry.code}`, `AIM-${entry.code}`, entry.code, title]);
		const keywords = new Set<string>();
		for (const a of aliases) keywords.add(stripPunct(a));
		keywords.add(stripPunct(`aim${entry.code}`));

		out.push({
			id: `doc-aim-${entry.code}`,
			displayName: `AIM ${entry.code} -- ${title}`,
			aliases: [...aliases].filter(Boolean).sort(),
			keywords: [...keywords].filter(Boolean).sort(),
			sourceType: 'aim',
			aviationTopic: ['procedures'],
			flightRules: 'both',
			knowledgeKind: 'reference',
			paraphrase: `Aeronautical Information Manual (${edition}), ${entry.kind === 'chapter' ? 'Chapter' : 'Section'} ${entry.code} -- ${title}.`,
		});
	}
	return out;
}

// ---------- emit ----------

const FAA_DOCS_HEADER = `/**
 * FAA_DOC_REFERENCES -- generated by scripts/generate-faa-doc-registry.ts.
 *
 * DO NOT EDIT BY HAND. Re-generate with:
 *   bun scripts/generate-faa-doc-registry.ts
 *
 * Sources scanned:
 *   - handbooks (PHAK, AFH, IFH, IPH, AvWX, RMH, AIH, MTN)
 *   - ac/index.json                             (Advisory Circulars)
 *   - acs/index.json                            (Airman Certification Standards)
 *   - regulations/cfr-14 latest snapshot        (14 CFR parts)
 *   - regulations/cfr-49 latest snapshot        (49 CFR parts)
 *
 * This file is registered at module load by the index file so the registry
 * is populated before any consumer imports it.
 *
 * AIM chapter/section rows live in the sibling generated file
 * \`aim-docs.ts\` (split out when the AIM scanner pushes the combined
 * output past ~5000 lines).
 */

import { registerReferences } from '../registry';
import type { Reference } from '../schema/reference';

export const FAA_DOC_REFERENCES: readonly Reference[] = [
`;

const AIM_DOCS_HEADER = `/**
 * AIM_REFERENCES -- generated by scripts/generate-faa-doc-registry.ts.
 *
 * DO NOT EDIT BY HAND. Re-generate with:
 *   bun scripts/generate-faa-doc-registry.ts
 *
 * One row per AIM chapter / section from the current edition manifest.
 * Paragraphs are NOT emitted here; the section row covers the parent and
 * runtime FTS in \`libs/help/src/loaders/aim-sections.ts\` handles per-
 * paragraph hits.
 */

import { registerReferences } from '../registry';
import type { Reference } from '../schema/reference';

export const AIM_REFERENCES: readonly Reference[] = [
`;

function emit(rows: readonly DocRow[], header: string, registerCallSymbol: string): string {
	const body = rows
		.map((row) => {
			const aliasList = row.aliases.map((a) => JSON.stringify(a)).join(', ');
			const keywordList = row.keywords.map((k) => JSON.stringify(k)).join(', ');
			const topicList = row.aviationTopic.map((t) => JSON.stringify(t)).join(', ');
			return `\t{
\t\tid: ${JSON.stringify(row.id)},
\t\tdisplayName: ${JSON.stringify(row.displayName)},
\t\taliases: [${aliasList}],
\t\tparaphrase: ${JSON.stringify(row.paraphrase)},
\t\ttags: {
\t\t\tsourceType: ${JSON.stringify(row.sourceType)},
\t\t\taviationTopic: [${topicList}],
\t\t\tflightRules: ${JSON.stringify(row.flightRules)},
\t\t\tknowledgeKind: ${JSON.stringify(row.knowledgeKind)},
\t\t\tkeywords: [${keywordList}],
\t\t},
\t\tsources: [],
\t\trelated: [],
\t},`;
		})
		.join('\n');

	const footer = `
];

registerReferences(${registerCallSymbol});
`;

	return header + body + footer;
}

// ---------- main ----------

const AIM_OUTPUT_PATH = join(REPO_ROOT, 'libs/aviation/src/references/aim-docs.ts');

function dedupe(rows: readonly DocRow[]): DocRow[] {
	const byId = new Map<string, DocRow>();
	for (const row of rows) {
		const existing = byId.get(row.id);
		if (existing) {
			console.warn(`duplicate id, keeping first: ${row.id}`);
			continue;
		}
		byId.set(row.id, row);
	}
	return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function main(): void {
	const faaDocRows: DocRow[] = [];
	faaDocRows.push(...scanHandbooks());
	faaDocRows.push(...scanAcs());
	faaDocRows.push(...scanAcs2());
	faaDocRows.push(...scanCfr(14));
	faaDocRows.push(...scanCfr(49));

	const aimRows = scanAim();

	const sortedFaa = dedupe(faaDocRows);
	const sortedAim = dedupe(aimRows);

	const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs');
	fs.writeFileSync(OUTPUT_PATH, emit(sortedFaa, FAA_DOCS_HEADER, 'FAA_DOC_REFERENCES'), 'utf-8');
	fs.writeFileSync(AIM_OUTPUT_PATH, emit(sortedAim, AIM_DOCS_HEADER, 'AIM_REFERENCES'), 'utf-8');

	console.log(`Wrote ${sortedFaa.length} FAA doc references to ${OUTPUT_PATH}`);
	console.log(`  handbooks: ${sortedFaa.filter((r) => /^doc-faah/.test(r.id)).length}`);
	console.log(`  ACs:       ${sortedFaa.filter((r) => /^doc-ac-/.test(r.id)).length}`);
	console.log(`  ACS:       ${sortedFaa.filter((r) => /^doc-(ppl|cpl|ir|atp|cfi)/.test(r.id)).length}`);
	console.log(`  CFR-14:    ${sortedFaa.filter((r) => /^doc-cfr-14-/.test(r.id)).length}`);
	console.log(`  CFR-49:    ${sortedFaa.filter((r) => /^doc-cfr-49-/.test(r.id)).length}`);
	console.log(`Wrote ${sortedAim.length} AIM references to ${AIM_OUTPUT_PATH}`);
}

main();
