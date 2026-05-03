/**
 * Smoke test for the `seed-references.ts` zod schema -- specifically the
 * Wave 1 addition of the optional `primary_cert` field to YAML reference
 * entries (library-by-cert WP).
 *
 * Covers:
 *   - valid `primary_cert` value (must be one of CERT_APPLICABILITY_VALUES) passes
 *   - invalid `primary_cert` value fails with a Zod enum error
 *   - omitted `primary_cert` passes (field is optional)
 *   - explicit `primary_cert: null` passes (nullable on the wire)
 *
 * Wave 6 adds:
 *   - link-only AC stubs declare a `url:` so library cards / citation chips
 *     deep-link to the FAA-hosted PDF instead of falling back to the AC index
 *     landing page.
 *
 * Lives next to the loader so a `bun test scripts/db/seed-references.test.ts`
 * is enough to validate the schema in isolation; no DB needed.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { referenceEntrySchema } from './seed-references';

const baseEntry = {
	slug: 'phak',
	kind: 'handbook' as const,
	edition: 'FAA-H-8083-25C',
	title: "Pilot's Handbook of Aeronautical Knowledge",
	subjects: ['aerodynamics'] as const,
};

describe('seed-references zod schema -- primary_cert', () => {
	it('accepts a valid CERT_APPLICABILITY value', () => {
		const result = referenceEntrySchema.safeParse({ ...baseEntry, primary_cert: 'private' });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.primary_cert).toBe('private');
		}
	});

	it('rejects an unknown primary_cert value', () => {
		const result = referenceEntrySchema.safeParse({ ...baseEntry, primary_cert: 'bogus' });
		expect(result.success).toBe(false);
		if (!result.success) {
			// Zod enum failures surface the offending path; assert it points at primary_cert.
			const hasPrimaryCertIssue = result.error.issues.some((issue) => issue.path.includes('primary_cert'));
			expect(hasPrimaryCertIssue).toBe(true);
		}
	});

	it('accepts an entry with primary_cert omitted (optional)', () => {
		const result = referenceEntrySchema.safeParse({ ...baseEntry });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.primary_cert).toBeUndefined();
		}
	});

	it('accepts an explicit null primary_cert (cert-agnostic)', () => {
		const result = referenceEntrySchema.safeParse({ ...baseEntry, primary_cert: null });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.primary_cert).toBeNull();
		}
	});
});

// ---------------------------------------------------------------------------
// WP-AC-LINK-ONLY (Wave 6) -- AC YAML coverage check.
//
// Every AC YAML row that is NOT backed by an on-disk `manifest.json` (i.e.
// link-only stubs) must carry an explicit `url:` so the regulations spine
// renders a proper "external link" card pointing at the FAA-hosted PDF
// rather than falling back to the AC index landing page (per
// `externalUrlForReference` in `libs/constants/src/study.ts`).
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const AC_YAML_PATH = resolve(REPO_ROOT, 'course/references/advisory-circulars.yaml');
const AC_DIR = resolve(REPO_ROOT, 'ac');

interface LoadedAcEntry {
	slug: string;
	url?: string | null;
}

function loadAcYaml(): LoadedAcEntry[] {
	const raw = readFileSync(AC_YAML_PATH, 'utf8');
	const parsed = parseYaml(raw) as { references: LoadedAcEntry[] };
	return parsed.references;
}

function hasManifest(slug: string): boolean {
	// AC manifests live at `ac/<doc_slug>/<revision>/manifest.json`. The YAML
	// slug is `ac-<doc_slug>` (e.g. `ac-00-6` -> `ac/00-6/`). A manifest at any
	// revision under the doc dir is enough to treat the AC as readable.
	const docSlug = slug.startsWith('ac-') ? slug.slice(3) : slug;
	const docDir = resolve(AC_DIR, docSlug);
	if (!existsSync(docDir)) return false;
	const entries = readdirSync(docDir, { withFileTypes: false });
	for (const entry of entries) {
		const sub = resolve(docDir, entry);
		if (!statSync(sub).isDirectory()) continue;
		if (existsSync(resolve(sub, 'manifest.json'))) return true;
	}
	return false;
}

describe('seed-references YAML -- AC link-only stubs (Wave 6)', () => {
	const acEntries = loadAcYaml();

	it('loads a non-empty AC inventory', () => {
		expect(acEntries.length).toBeGreaterThan(0);
	});

	it('every link-only AC stub declares a url so the chip deep-links to the FAA PDF', () => {
		const linkOnlyWithoutUrl = acEntries
			.filter((entry) => !hasManifest(entry.slug))
			.filter((entry) => entry.url == null || entry.url.length === 0);

		expect(linkOnlyWithoutUrl.map((e) => e.slug)).toEqual([]);
	});

	it('every declared AC url points at the canonical FAA Document Library prefix', () => {
		const FAA_AC_PREFIX = 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_';
		for (const entry of acEntries) {
			if (entry.url == null) continue;
			expect(entry.url.startsWith(FAA_AC_PREFIX)).toBe(true);
			expect(entry.url.endsWith('.pdf')).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// WP-ACS-LINK-ONLY (Wave 6) -- ACS / PTS YAML coverage check.
//
// CFII PTS and the ACS Companion Guide are link-only (no on-disk manifest)
// and must declare a `url:` so library cards / citation chips deep-link to
// the FAA-hosted PDF directly. Pattern: every entry kind in
// {`pts`, `other`} must declare a `url:` (the `acs` kind is allowed to omit
// it because the manifest carries `source_url` for readable ACS).
// ---------------------------------------------------------------------------

const ACS_YAML_PATH = resolve(REPO_ROOT, 'course/references/acs-pts.yaml');

interface LoadedAcsEntry {
	slug: string;
	kind: string;
	url?: string | null;
}

function loadAcsYaml(): LoadedAcsEntry[] {
	const raw = readFileSync(ACS_YAML_PATH, 'utf8');
	const parsed = parseYaml(raw) as { references: LoadedAcsEntry[] };
	return parsed.references;
}

describe('seed-references YAML -- ACS / PTS link-only stubs (Wave 6)', () => {
	const acsEntries = loadAcsYaml();

	it('CFII PTS stub declares a url to the FAA-hosted PDF', () => {
		const cfii = acsEntries.find((e) => e.slug === 'cfii-airplane-pts-9e');
		expect(cfii).toBeDefined();
		if (cfii !== undefined) {
			expect(cfii.kind).toBe('pts');
			expect(cfii.url).toMatch(/^https:\/\/www\.faa\.gov\/.+\.pdf$/);
		}
	});

	it('ACS Companion Guide stub declares a url to the FAA-hosted PDF', () => {
		const guide = acsEntries.find((e) => e.slug === 'faa-g-acs-2-companion-guide');
		expect(guide).toBeDefined();
		if (guide !== undefined) {
			expect(guide.kind).toBe('other');
			expect(guide.url).toMatch(/^https:\/\/www\.faa\.gov\/.+\.pdf$/);
		}
	});
});
