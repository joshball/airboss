#!/usr/bin/env bun
/**
 * Credential seed phase.
 *
 * Reads `course/credentials/*.yaml` and upserts:
 *
 *   - one `study.credential` row per YAML
 *   - one `study.credential_prereq` row per prereq edge
 *   - one `study.credential_syllabus` row per syllabi link (when the
 *     referenced syllabus is already seeded; missing syllabi are silently
 *     skipped with a warning until the syllabus seed lands)
 *
 * Validates the prereq DAG is acyclic via Kahn's algorithm BEFORE writing
 * any rows; a cycle aborts the seed.
 *
 * Idempotent: a YAML file unchanged from the last run produces no row
 * writes apart from `updated_at` refreshes.
 *
 * Usage:
 *   bun scripts/db/seed-credentials.ts                    # seed every YAML
 *   bun scripts/db/seed-credentials.ts <slug>             # seed one credential
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	CREDENTIAL_CATEGORY_VALUES,
	type CredentialCategory,
	type CredentialClass,
	CREDENTIAL_CLASS_VALUES,
	CREDENTIAL_KIND_VALUES,
	type CredentialKind,
	CREDENTIAL_PREREQ_KIND_VALUES,
	type CredentialPrereqKind,
	CREDENTIAL_STATUSES,
	SYLLABUS_PRIMACY_VALUES,
	type SyllabusPrimacy,
} from '@ab/constants';
import { db } from '@ab/db';
import {
	type CredentialRow,
	credential,
	type SyllabusRow,
	syllabus,
	upsertCredential,
	upsertCredentialPrereq,
	upsertCredentialSyllabus,
	validateCredentialDag,
} from '@ab/bc-study';
import type { StructuredCitation } from '@ab/types';
import { generateCredentialId } from '@ab/utils';
import { parse } from 'yaml';
import { z } from 'zod';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CREDENTIALS_DIR = resolve(REPO_ROOT, 'course/credentials');

const slugSchema = z
	.string()
	.min(2)
	.max(64)
	.regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);

const structuredCitationSchema = z.object({
	kind: z.string(),
	reference_id: z.string(),
	framing: z.string().optional(),
	airboss_ref: z.string().optional(),
	locator: z.unknown().optional(),
	note: z.string().optional(),
});

const prereqSchema = z.object({
	slug: slugSchema,
	kind: z.enum(CREDENTIAL_PREREQ_KIND_VALUES as [CredentialPrereqKind, ...CredentialPrereqKind[]]),
	notes: z.string().optional(),
});

const credentialSyllabusSchema = z.object({
	slug: slugSchema,
	primacy: z.enum(SYLLABUS_PRIMACY_VALUES as [SyllabusPrimacy, ...SyllabusPrimacy[]]),
});

const credentialFileSchema = z.object({
	slug: slugSchema,
	kind: z.enum(CREDENTIAL_KIND_VALUES as [CredentialKind, ...CredentialKind[]]),
	title: z.string().min(1),
	category: z.enum(CREDENTIAL_CATEGORY_VALUES as [CredentialCategory, ...CredentialCategory[]]),
	class: z.union([z.enum(CREDENTIAL_CLASS_VALUES as [CredentialClass, ...CredentialClass[]]), z.null()]),
	regulatory_basis: z.array(structuredCitationSchema).default([]),
	prereqs: z.array(prereqSchema).default([]),
	syllabi: z.array(credentialSyllabusSchema).default([]),
});

type CredentialFile = z.infer<typeof credentialFileSchema>;

export interface SeedCredentialsOptions {
	seedOrigin?: string | null;
	slug?: string;
}

export interface SeedCredentialsSummary {
	filesRead: number;
	credentialsUpserted: number;
	prereqsUpserted: number;
	syllabusLinksUpserted: number;
	syllabusLinksSkipped: number;
}

export async function seedCredentials(options: SeedCredentialsOptions = {}): Promise<SeedCredentialsSummary> {
	if (!existsSync(CREDENTIALS_DIR)) {
		throw new Error(`credentials directory not found: ${CREDENTIALS_DIR}`);
	}

	const filenames = readdirSync(CREDENTIALS_DIR)
		.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
		.filter((f) => options.slug === undefined || f === `${options.slug}.yaml` || f === `${options.slug}.yml`)
		.sort();

	if (filenames.length === 0) {
		throw new Error(`no credential YAMLs found${options.slug ? ` for slug ${options.slug}` : ''}`);
	}

	// Load + validate every file BEFORE any writes so a typo in YAML #14
	// doesn't leave files 1-13 partially seeded.
	const loaded: CredentialFile[] = [];
	for (const filename of filenames) {
		const path = resolve(CREDENTIALS_DIR, filename);
		if (!statSync(path).isFile()) continue;
		const raw = await readFile(path, 'utf8');
		const parsed = parse(raw);
		const validated = credentialFileSchema.parse(parsed);
		// Filename slug must match YAML slug.
		const expectedFilename = `${validated.slug}.yaml`;
		if (filename !== expectedFilename && filename !== `${validated.slug}.yml`) {
			throw new Error(`credential YAML filename "${filename}" must match slug "${validated.slug}"`);
		}
		loaded.push(validated);
	}

	// DAG check on prereqs: build adjacency from each credential's id-equivalent
	// (here we use slugs since ids aren't stable across runs) to its prereq slugs.
	const adjacency = new Map<string, readonly string[]>();
	for (const cred of loaded) {
		adjacency.set(
			cred.slug,
			cred.prereqs.map((p) => p.slug),
		);
	}
	validateCredentialDag(adjacency);

	// Resolve existing credential rows by slug so we reuse ids on re-seed.
	const existingBySlug = new Map<string, CredentialRow>();
	const existing = await db.select().from(credential);
	for (const row of existing) existingBySlug.set(row.slug, row);

	const summary: SeedCredentialsSummary = {
		filesRead: loaded.length,
		credentialsUpserted: 0,
		prereqsUpserted: 0,
		syllabusLinksUpserted: 0,
		syllabusLinksSkipped: 0,
	};

	const idBySlug = new Map<string, string>();

	// Pass 1: upsert every credential row so prereq + syllabus passes can
	// resolve ids by slug.
	for (const cred of loaded) {
		const reuse = existingBySlug.get(cred.slug);
		const id = reuse?.id ?? generateCredentialId();
		await upsertCredential({
			id,
			slug: cred.slug,
			kind: cred.kind,
			title: cred.title,
			category: cred.category,
			class: cred.class,
			regulatoryBasis: cred.regulatory_basis as StructuredCitation[],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: options.seedOrigin ?? null,
		});
		idBySlug.set(cred.slug, id);
		summary.credentialsUpserted += 1;
	}

	// Pass 2: prereq edges.
	for (const cred of loaded) {
		const credentialId = idBySlug.get(cred.slug);
		if (credentialId === undefined) continue;
		for (const prereq of cred.prereqs) {
			const prereqId = idBySlug.get(prereq.slug);
			if (prereqId === undefined) {
				throw new Error(`credential ${cred.slug} prereq slug "${prereq.slug}" did not resolve`);
			}
			await upsertCredentialPrereq({
				credentialId,
				prereqId,
				kind: prereq.kind,
				notes: prereq.notes ?? '',
				seedOrigin: options.seedOrigin ?? null,
			});
			summary.prereqsUpserted += 1;
		}
	}

	// Pass 3: syllabus links. Syllabi are seeded by a separate phase; if the
	// link target isn't in the DB yet we skip with a warning.
	const existingSyllabi = await db.select().from(syllabus);
	const syllabusBySlug = new Map<string, SyllabusRow>();
	for (const row of existingSyllabi) syllabusBySlug.set(row.slug, row);

	for (const cred of loaded) {
		const credentialId = idBySlug.get(cred.slug);
		if (credentialId === undefined) continue;
		for (const link of cred.syllabi) {
			const syllabusRow = syllabusBySlug.get(link.slug);
			if (syllabusRow === undefined) {
				process.stdout.write(
					`seed-credentials: skipping syllabus link ${cred.slug} -> ${link.slug} (syllabus not yet seeded)\n`,
				);
				summary.syllabusLinksSkipped += 1;
				continue;
			}
			await upsertCredentialSyllabus({
				credentialId,
				syllabusId: syllabusRow.id,
				primacy: link.primacy,
				seedOrigin: options.seedOrigin ?? null,
				createdAt: new Date(),
			});
			summary.syllabusLinksUpserted += 1;
		}
	}

	return summary;
}

async function main(): Promise<void> {
	const slug = process.argv[2];
	const summary = await seedCredentials(slug !== undefined ? { slug } : {});
	process.stdout.write(
		`seed-credentials: ${summary.credentialsUpserted} credentials, ${summary.prereqsUpserted} prereqs, ${summary.syllabusLinksUpserted} syllabus links (${summary.syllabusLinksSkipped} skipped)\n`,
	);
}

if (import.meta.main) {
	main().catch((err) => {
		process.stderr.write(`seed-credentials: ${(err as Error).stack ?? err}\n`);
		process.exit(1);
	});
}

