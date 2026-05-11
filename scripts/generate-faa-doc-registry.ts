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

interface DocRow {
	id: string;
	displayName: string;
	aliases: string[];
	keywords: string[];
	sourceType: 'cfr' | 'ac' | 'acs' | 'phak' | 'afh' | 'ifh' | 'aim';
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
};

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

			const sourceType = slug === 'phak' ? 'phak' : slug === 'afh' ? 'afh' : slug === 'ifh' ? 'ifh' : ('phak' as const); // fallback for handbooks without a dedicated source type

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
	const parts = readdirSync(snapshotDir).filter((n) => statSync(join(snapshotDir, n)).isDirectory());

	return parts.map((part) => {
		const aliases = new Set<string>([
			`${title} CFR ${part}`,
			`${title} CFR Part ${part}`,
			`Part ${part}`,
			`${title} CFR §${part}`,
			part,
		]);
		const keywords = new Set<string>();
		for (const a of aliases) keywords.add(stripPunct(a));
		keywords.add(stripPunct(`${title}cfr${part}`));
		keywords.add(stripPunct(`cfr${title}${part}`));

		return {
			id: `doc-cfr-${title}-${part}`,
			displayName: `${title} CFR Part ${part}`,
			aliases: [...aliases].filter(Boolean).sort(),
			keywords: [...keywords].filter(Boolean).sort(),
			sourceType: 'cfr',
			aviationTopic: ['regulations'],
			flightRules: 'both',
			knowledgeKind: 'regulation',
			paraphrase: `Title ${title} of the Code of Federal Regulations, Part ${part}.`,
		};
	});
}

// ---------- emit ----------

function emit(rows: readonly DocRow[]): string {
	const header = `/**
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
 */

import { registerReferences } from '../registry';
import type { Reference } from '../schema/reference';

export const FAA_DOC_REFERENCES: readonly Reference[] = [
`;

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

registerReferences(FAA_DOC_REFERENCES);
`;

	return header + body + footer;
}

// ---------- main ----------

function main(): void {
	const rows: DocRow[] = [];
	rows.push(...scanHandbooks());
	rows.push(...scanAcs());
	rows.push(...scanAcs2());
	rows.push(...scanCfr(14));
	rows.push(...scanCfr(49));

	// Dedupe by id
	const byId = new Map<string, DocRow>();
	for (const row of rows) {
		const existing = byId.get(row.id);
		if (existing) {
			console.warn(`duplicate id, keeping first: ${row.id}`);
			continue;
		}
		byId.set(row.id, row);
	}
	const sorted = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));

	const out = emit(sorted);
	const fs = process.getBuiltinModule('node:fs') as typeof import('node:fs');
	fs.writeFileSync(OUTPUT_PATH, out, 'utf-8');

	console.log(`Wrote ${sorted.length} FAA doc references to ${OUTPUT_PATH}`);
	console.log(`  handbooks: ${sorted.filter((r) => /^doc-faah/.test(r.id)).length}`);
	console.log(`  ACs:       ${sorted.filter((r) => /^doc-ac-/.test(r.id)).length}`);
	console.log(`  ACS:       ${sorted.filter((r) => /^doc-(ppl|cpl|ir|atp|cfi)/.test(r.id)).length}`);
	console.log(`  CFR-14:    ${sorted.filter((r) => /^doc-cfr-14-/.test(r.id)).length}`);
	console.log(`  CFR-49:    ${sorted.filter((r) => /^doc-cfr-49-/.test(r.id)).length}`);
}

main();
