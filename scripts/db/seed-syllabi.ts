#!/usr/bin/env bun
/**
 * Syllabus seed phase.
 *
 * Walks `course/syllabi/<slug>/manifest.yaml` + every
 * `course/syllabi/<slug>/areas/*.yaml` and upserts:
 *
 *   - one `study.syllabus` row per manifest
 *   - one `study.syllabus_node` row per area + task + element
 *   - one `study.syllabus_node_link` row per `knowledge_links[<element>]` entry
 *
 * Validates every row's airboss_ref via `@ab/sources` parser before any
 * writes; an invalid identifier aborts the seed.
 *
 * Idempotent: a syllabus YAML unchanged from the last run produces no
 * row writes apart from `updated_at` refreshes. Knowledge-graph link
 * sets are rewritten via `replaceSyllabusNodeLinks` per leaf so the
 * seed can prune stale links.
 *
 * Usage:
 *   bun scripts/db/seed-syllabi.ts                  # every syllabus dir
 *   bun scripts/db/seed-syllabi.ts <slug>           # one syllabus
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	knowledgeNode,
	type NewSyllabusNodeLinkRow,
	replaceSyllabusNodeLinks,
	syllabus,
	syllabusNode,
	upsertSyllabus,
	upsertSyllabusNode,
	validateAirbossRefForLeaf,
} from '@ab/bc-study';
import {
	ACS_TRIAD_VALUES,
	type ACSTriad,
	BLOOM_LEVEL_VALUES,
	type BloomLevel,
	SYLLABUS_KIND_VALUES,
	SYLLABUS_NODE_LEVELS,
	SYLLABUS_STATUS_VALUES,
	type SyllabusKind,
	type SyllabusStatus,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateSyllabusId, generateSyllabusNodeId, generateSyllabusNodeLinkId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { parse } from 'yaml';
import { z } from 'zod';
import { reference } from '../../libs/bc/study/src/schema';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const SYLLABI_DIR = resolve(REPO_ROOT, 'course/syllabi');

const slugSchema = z
	.string()
	.min(2)
	.max(64)
	.regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);

const elementSchema = z.object({
	code: z.string().min(1),
	triad: z.enum(ACS_TRIAD_VALUES as [ACSTriad, ...ACSTriad[]]),
	ordinal: z.number().int().nonnegative(),
	required_bloom: z.enum(BLOOM_LEVEL_VALUES as [BloomLevel, ...BloomLevel[]]),
	title: z.string().min(1),
	description: z.string().min(1),
	airboss_ref: z.string().min(1),
});

const taskSchema = z.object({
	code: z.string().min(1),
	ordinal: z.number().int().nonnegative(),
	title: z.string().min(1),
	airboss_ref: z.string().min(1),
	classes: z.union([z.array(z.string()).min(1), z.null()]).optional(),
	references: z.array(z.string()).optional(),
	objective: z.string().optional(),
	elements: z.array(elementSchema).default([]),
});

const areaSchema = z.object({
	area: z.object({
		code: z.string().min(1),
		ordinal: z.number().int().nonnegative(),
		title: z.string().min(1),
		airboss_ref: z.string().min(1),
		citations: z.array(z.unknown()).default([]),
	}),
	tasks: z.array(taskSchema).min(1),
	knowledge_links: z
		.record(
			z.string(),
			z.array(
				z.object({
					node_id: z.string().min(1),
					weight: z.number().min(0).max(1).default(1.0),
					notes: z.string().optional(),
				}),
			),
		)
		.default({}),
});

const manifestSchema = z.object({
	slug: slugSchema,
	kind: z.enum(SYLLABUS_KIND_VALUES as [SyllabusKind, ...SyllabusKind[]]),
	title: z.string().min(1),
	edition: z.string().min(1),
	edition_pin: z
		.string()
		.regex(/^\d{4}-\d{2}$/)
		.optional(),
	reference_slug: z.string().optional(),
	status: z.enum(SYLLABUS_STATUS_VALUES as [SyllabusStatus, ...SyllabusStatus[]]).default('active'),
	source_url: z.string().url().optional(),
	notes: z.string().optional(),
});

export interface SeedSyllabiOptions {
	seedOrigin?: string | null;
	slug?: string;
}

export interface SeedSyllabiSummary {
	syllabiUpserted: number;
	nodesUpserted: number;
	linksUpserted: number;
	linksSkipped: number;
}

export async function seedSyllabi(options: SeedSyllabiOptions = {}): Promise<SeedSyllabiSummary> {
	if (!existsSync(SYLLABI_DIR)) {
		throw new Error(`syllabi directory not found: ${SYLLABI_DIR}`);
	}

	const slugs = readdirSync(SYLLABI_DIR)
		.filter((entry) => statSync(resolve(SYLLABI_DIR, entry)).isDirectory())
		.filter((slug) => options.slug === undefined || slug === options.slug)
		.sort();

	if (slugs.length === 0) {
		throw new Error(`no syllabus directories found${options.slug ? ` for slug ${options.slug}` : ''}`);
	}

	const summary: SeedSyllabiSummary = {
		syllabiUpserted: 0,
		nodesUpserted: 0,
		linksUpserted: 0,
		linksSkipped: 0,
	};

	for (const slug of slugs) {
		await seedOneSyllabus(slug, options, summary);
	}

	return summary;
}

async function seedOneSyllabus(slug: string, options: SeedSyllabiOptions, summary: SeedSyllabiSummary): Promise<void> {
	const dir = resolve(SYLLABI_DIR, slug);
	const manifestPath = resolve(dir, 'manifest.yaml');
	if (!existsSync(manifestPath)) {
		throw new Error(`manifest not found: ${manifestPath}`);
	}
	const manifestRaw = await readFile(manifestPath, 'utf8');
	const manifestParsed = parse(manifestRaw);
	const manifest = manifestSchema.parse(manifestParsed);
	if (manifest.slug !== slug) {
		throw new Error(`syllabus dir "${slug}" carries manifest slug "${manifest.slug}"`);
	}

	// Resolve reference id when manifest carries one.
	let referenceId: string | null = null;
	if (manifest.reference_slug !== undefined) {
		const refRow = await db
			.select()
			.from(reference)
			.where(eq(reference.documentSlug, manifest.reference_slug))
			.limit(1);
		if (refRow.length === 0) {
			throw new Error(
				`syllabus ${slug}: reference_slug "${manifest.reference_slug}" did not resolve; seed references first.`,
			);
		}
		const matched = refRow[0];
		if (matched !== undefined) referenceId = matched.id;
	}

	// Reuse syllabus id when one already exists.
	const existing = await db.select().from(syllabus).where(eq(syllabus.slug, slug)).limit(1);
	const existingRow = existing[0];
	const syllabusId = existingRow?.id ?? generateSyllabusId();

	await upsertSyllabus({
		id: syllabusId,
		slug: manifest.slug,
		kind: manifest.kind,
		title: manifest.title,
		edition: manifest.edition,
		sourceUrl: manifest.source_url ?? null,
		status: manifest.status,
		supersededById: null,
		referenceId,
		seedOrigin: options.seedOrigin ?? null,
		createdAt: existingRow?.createdAt ?? new Date(),
		updatedAt: new Date(),
	});
	summary.syllabiUpserted += 1;

	// Walk areas/*.yaml.
	const areasDir = resolve(dir, 'areas');
	if (!existsSync(areasDir)) return;
	const areaFiles = readdirSync(areasDir)
		.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
		.sort();

	// Collect every node-id we already see in DB so we can resolve
	// knowledge_links by slug.
	const knownNodeIds = new Set<string>();
	const allNodes = await db.select({ id: knowledgeNode.id }).from(knowledgeNode);
	for (const row of allNodes) knownNodeIds.add(row.id);

	for (const filename of areaFiles) {
		const path = resolve(areasDir, filename);
		const raw = await readFile(path, 'utf8');
		const parsed = parse(raw);
		const validated = areaSchema.parse(parsed);
		await seedOneArea(syllabusId, manifest.kind, validated, options, summary, knownNodeIds);
	}
}

async function seedOneArea(
	syllabusId: string,
	syllabusKind: SyllabusKind,
	area: z.infer<typeof areaSchema>,
	options: SeedSyllabiOptions,
	summary: SeedSyllabiSummary,
	knownNodeIds: ReadonlySet<string>,
): Promise<void> {
	// Reuse existing ids by code so re-seeding is stable.
	const existingNodes = await db
		.select({ id: syllabusNode.id, code: syllabusNode.code })
		.from(syllabusNode)
		.where(eq(syllabusNode.syllabusId, syllabusId));
	const idByCode = new Map<string, string>();
	for (const row of existingNodes) idByCode.set(row.code, row.id);

	function ensureId(code: string): string {
		const existing = idByCode.get(code);
		if (existing !== undefined) return existing;
		const fresh = generateSyllabusNodeId();
		idByCode.set(code, fresh);
		return fresh;
	}

	// Validate every airboss_ref BEFORE writes.
	validateAirbossRefForLeaf(area.area.airboss_ref, { syllabusKind });
	for (const task of area.tasks) {
		validateAirbossRefForLeaf(task.airboss_ref, { syllabusKind });
		for (const elem of task.elements) {
			validateAirbossRefForLeaf(elem.airboss_ref, { syllabusKind });
		}
	}

	// Area row.
	const areaId = ensureId(area.area.code);
	const now = new Date();
	await upsertSyllabusNode({
		id: areaId,
		syllabusId,
		parentId: null,
		level: SYLLABUS_NODE_LEVELS.AREA,
		ordinal: area.area.ordinal,
		code: area.area.code,
		title: area.area.title,
		description: '',
		triad: null,
		requiredBloom: null,
		isLeaf: false,
		airbossRef: area.area.airboss_ref,
		citations: [],
		classes: null,
		contentHash: null,
		seedOrigin: options.seedOrigin ?? null,
		createdAt: now,
		updatedAt: now,
	});
	summary.nodesUpserted += 1;

	// Task + element rows.
	for (const task of area.tasks) {
		const taskId = ensureId(task.code);
		await upsertSyllabusNode({
			id: taskId,
			syllabusId,
			parentId: areaId,
			level: SYLLABUS_NODE_LEVELS.TASK,
			ordinal: task.ordinal,
			code: task.code,
			title: task.title,
			description: task.objective ?? '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: task.airboss_ref,
			citations: [],
			classes: task.classes ?? null,
			contentHash: null,
			seedOrigin: options.seedOrigin ?? null,
			createdAt: now,
			updatedAt: now,
		});
		summary.nodesUpserted += 1;

		for (const elem of task.elements) {
			const elemId = ensureId(elem.code);
			await upsertSyllabusNode({
				id: elemId,
				syllabusId,
				parentId: taskId,
				level: SYLLABUS_NODE_LEVELS.ELEMENT,
				ordinal: elem.ordinal,
				code: elem.code,
				title: elem.title,
				description: elem.description,
				triad: elem.triad,
				requiredBloom: elem.required_bloom,
				isLeaf: true,
				airbossRef: elem.airboss_ref,
				citations: [],
				// Element-level rows inherit the parent task's class scope when
				// not explicitly overridden. The current schema doesn't carry
				// class scope on elements directly (FAA tags class on the task);
				// this seed keeps elements at NULL.
				classes: null,
				contentHash: null,
				seedOrigin: options.seedOrigin ?? null,
				createdAt: now,
				updatedAt: now,
			});
			summary.nodesUpserted += 1;

			// Knowledge graph links.
			const linkSpecs = area.knowledge_links[elem.code] ?? [];
			const linkRows: NewSyllabusNodeLinkRow[] = [];
			for (const spec of linkSpecs) {
				if (!knownNodeIds.has(spec.node_id)) {
					process.stdout.write(
						`seed-syllabi: skipping link ${elem.code} -> ${spec.node_id} (knowledge node not seeded)\n`,
					);
					summary.linksSkipped += 1;
					continue;
				}
				linkRows.push({
					id: generateSyllabusNodeLinkId(),
					syllabusNodeId: elemId,
					knowledgeNodeId: spec.node_id,
					weight: spec.weight,
					notes: spec.notes ?? '',
					seedOrigin: options.seedOrigin ?? null,
					createdAt: now,
				});
			}
			await replaceSyllabusNodeLinks(elemId, linkRows);
			summary.linksUpserted += linkRows.length;
		}
	}
}

async function main(): Promise<void> {
	const slug = process.argv[2];
	const summary = await seedSyllabi(slug !== undefined ? { slug } : {});
	process.stdout.write(
		`seed-syllabi: ${summary.syllabiUpserted} syllabi, ${summary.nodesUpserted} nodes, ${summary.linksUpserted} links (${summary.linksSkipped} skipped)\n`,
	);
}

if (import.meta.main) {
	main().catch((err) => {
		process.stderr.write(`seed-syllabi: ${(err as Error).stack ?? err}\n`);
		process.exit(1);
	});
}
