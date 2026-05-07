#!/usr/bin/env bun
/**
 * Reference seed phase for non-handbook references (ACS / PTS / companion
 * guide / endorsement-source publications).
 *
 * Reads `course/references/*.yaml` and upserts one `study.reference` row
 * per `(slug, edition)` pair. Idempotent: re-running with no changes is a
 * no-op apart from updated_at refresh.
 *
 * Handbook references are seeded separately by
 * `scripts/db/seed-references-from-manifest.ts`; this script appends the
 * ACS / PTS / endorsement-source rows the cert-syllabus WP requires.
 *
 * Usage:
 *   bun scripts/db/seed-references.ts          # seed every YAML
 *   bun scripts/db/seed-references.ts <file>   # seed one file
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	AVIATION_TOPIC_VALUES,
	type AviationTopic,
	CERT_APPLICABILITY_VALUES,
	type CertApplicability,
	REFERENCE_KIND_VALUES,
	REFERENCE_KINDS,
	type ReferenceKind,
} from '@ab/constants';
import { client } from '@ab/db/connection';
import { parse } from 'yaml';
import { z } from 'zod';
import { attachSupersededByLatest, getReferenceByDocument, upsertReference } from '../../libs/bc/study/src/references';
import { loadPohAuthoring, type PohOverlay } from '../../libs/bc/study/src/seeders/poh-authoring';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const REFERENCES_DIR = resolve(REPO_ROOT, 'course/references');

/**
 * Per-aircraft POH authoring overlay. Loaded once per seed run from
 * `aircraft/_authoring/poh.yaml` and merged into `reference.metadata` for
 * any entry whose `kind: poh`. See
 * `libs/bc/study/src/seeders/poh-authoring.ts` for the schema; missing
 * file = empty map (no-op merge).
 */
const POH_AUTHORING_PATH = resolve(REPO_ROOT, 'aircraft/_authoring/poh.yaml');

/**
 * Build the metadata jsonb for a POH reference. Only applies when an
 * overlay row exists for the slug -- entries without an overlay (e.g. the
 * legacy `poh-afm` umbrella) keep an empty metadata object so the audit
 * page surfaces the missing fields as recommended-field gaps.
 */
function buildPohMetadata(overlay: PohOverlay): Record<string, unknown> {
	return {
		aircraftModel: overlay.aircraftModel,
		manufacturer: overlay.manufacturer,
		revision: overlay.revision,
		...(overlay.revisionDate !== undefined ? { revisionDate: overlay.revisionDate } : {}),
		...(overlay.applicableSerialNumbers !== undefined
			? { applicableSerialNumbers: overlay.applicableSerialNumbers }
			: {}),
		description: overlay.description,
		whyItMatters: overlay.whyItMatters,
		topics: overlay.topics,
	};
}

export const referenceEntrySchema = z.object({
	slug: z
		.string()
		.min(3)
		.max(32)
		.regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
	kind: z.enum(REFERENCE_KIND_VALUES as [ReferenceKind, ...ReferenceKind[]]),
	edition: z.string().min(1).max(64),
	title: z.string().min(1),
	publisher: z.string().optional(),
	url: z.string().url().optional(),
	// Required: every authored reference must declare 1..3 aviation-topic
	// subjects so the library index can group it. Validator enforces enum
	// membership; the CHECK constraint on `study.reference.subjects` is the
	// safety net at the DB layer.
	subjects: z
		.array(z.enum(AVIATION_TOPIC_VALUES as [AviationTopic, ...AviationTopic[]]))
		.min(1)
		.max(3),
	/**
	 * Optional primary cert that owns this reference for library-by-cert
	 * browsing. Omitted / null = cert-agnostic. When present, must be one of
	 * `CERT_APPLICABILITY_VALUES`. The DB CHECK constraint mirrors this at the
	 * storage layer; the YAML validator catches invalid values before they
	 * reach the upsert.
	 */
	primary_cert: z
		.enum(CERT_APPLICABILITY_VALUES as [CertApplicability, ...CertApplicability[]])
		.nullable()
		.optional(),
});

const referencesFileSchema = z.object({
	references: z.array(referenceEntrySchema).min(1),
});

export interface SeedReferencesOptions {
	/** Optional dev-seed marker; production runs leave this null. */
	seedOrigin?: string | null;
	/** Filter to one YAML file. Default = walk every YAML in `course/references/`. */
	filename?: string;
}

export interface SeedReferencesSummary {
	filesRead: number;
	rowsUpserted: number;
}

/** Walk `course/references/*.yaml` and upsert every entry. */
export async function seedReferences(options: SeedReferencesOptions = {}): Promise<SeedReferencesSummary> {
	if (!existsSync(REFERENCES_DIR)) {
		throw new Error(`references directory not found: ${REFERENCES_DIR}`);
	}

	const summary: SeedReferencesSummary = { filesRead: 0, rowsUpserted: 0 };
	const filenames = options.filename
		? [options.filename]
		: readdirSync(REFERENCES_DIR)
				.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
				.sort();

	// Per-aircraft POH overlay (description / whyItMatters / topics / revision
	// metadata). Empty when `aircraft/_authoring/poh.yaml` is absent -- the
	// audit page surfaces missing fields rather than failing the seed.
	const pohAuthoring = await loadPohAuthoring(POH_AUTHORING_PATH);

	const slugsTouched = new Set<string>();
	for (const filename of filenames) {
		const path = resolve(REFERENCES_DIR, filename);
		if (!existsSync(path) || !statSync(path).isFile()) {
			throw new Error(`references file not found: ${path}`);
		}
		const raw = await readFile(path, 'utf8');
		const parsed = parse(raw);
		const validated = referencesFileSchema.parse(parsed);
		summary.filesRead += 1;
		for (const entry of validated.references) {
			// POH entries with an authoring overlay get the manufacturer voice
			// + topic chips merged into `metadata` so the PohCard renders the
			// extended layout. Entries without an overlay (e.g. the legacy
			// `poh-afm` umbrella row) keep an empty metadata object; the
			// audit page surfaces the gap.
			const pohOverlay = entry.kind === REFERENCE_KINDS.POH ? pohAuthoring[entry.slug] : undefined;
			const metadata = pohOverlay !== undefined ? buildPohMetadata(pohOverlay) : undefined;

			await upsertReference({
				kind: entry.kind,
				documentSlug: entry.slug,
				edition: entry.edition,
				title: entry.title,
				publisher: entry.publisher ?? 'FAA',
				url: entry.url ?? null,
				subjects: entry.subjects,
				primaryCert: entry.primary_cert ?? null,
				...(metadata !== undefined ? { metadata } : {}),
				seedOrigin: options.seedOrigin ?? null,
			});
			summary.rowsUpserted += 1;
			slugsTouched.add(entry.slug);
		}
	}

	// Wire `supersededById` chains for slugs that may have a manifest-seeded
	// sibling (e.g. AFH 3B in YAML coexists with AFH 3C from the manifest
	// seeder). The manifest seeder's own chain step only fires when it sees
	// >1 edition in the manifest tree, so cross-path pairs (one YAML row,
	// one manifest row) need this pass. Idempotent: a slug with one row in
	// the DB resolves to itself and `attachSupersededByLatest` is a no-op
	// (the WHERE clause excludes the latest id).
	//
	// Caveat: relies on `phaseHandbooks` running before `phaseReferences` in
	// seed-all.ts; standalone `bun scripts/db/seed-references.ts` on a fresh
	// DB without a prior manifest seed will leave the chain unset until the
	// manifest seeder runs. The combined seed flow is the authoritative path.
	for (const slug of slugsTouched) {
		const latest = await getReferenceByDocument(slug);
		await attachSupersededByLatest(slug, latest.id);
	}

	return summary;
}

async function main(): Promise<void> {
	const arg = process.argv[2];
	const summary = await seedReferences(arg !== undefined ? { filename: arg } : {});
	process.stdout.write(`seed-references: ${summary.rowsUpserted} rows from ${summary.filesRead} file(s)\n`);
}

if (import.meta.main) {
	main()
		.catch((err) => {
			process.stderr.write(`seed-references: ${(err as Error).stack ?? err}\n`);
			process.exitCode = 1;
		})
		.finally(() => client.end());
}
