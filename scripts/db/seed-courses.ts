#!/usr/bin/env bun
/**
 * Course seed phase (course-primitive WP, Phase 6).
 *
 * Walks `course/courses/<slug>/manifest.yaml` + every
 * `course/courses/<slug>/sections/*.yaml` and upserts:
 *
 *   - one `study.course` row per manifest
 *   - one `study.course_step` row per section
 *   - one `study.course_step` row per step (level='step', under its section)
 *
 * Validates the full course tree before any DB writes. Every rejection
 * message in the course-primitive spec's "Seed validator rejections" table
 * fires verbatim so log-greps stay stable.
 *
 * Idempotent + content-hashed: each course-step row carries a SHA-256 of
 * its canonicalized YAML payload. A section/step whose hash matches the
 * row already in the DB is skipped (no UPDATE), so an unchanged YAML
 * tree produces zero writes on a re-run. The course row itself is
 * skipped when its top-level manifest hash is unchanged.
 *
 * Usage:
 *   bun scripts/db/seed-courses.ts                  # every course dir
 *   bun scripts/db/seed-courses.ts <slug>           # one course
 *   bun scripts/db/seed-courses.ts --dir <path>     # custom courses root
 *                                                   # (defaults to course/courses/)
 *
 * The dispatcher (`bun run db seed courses`) wires through to this script;
 * see `scripts/db.ts`.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CourseManifest, type CourseSection, courseManifestSchema, courseSectionSchema } from '@ab/bc-study';
import {
	getCourseBySlug,
	getCourseStepsByCourse,
	knowledgeNode,
	upsertCourse,
	upsertCourseStep,
} from '@ab/bc-study/server';
import { COURSE_KINDS, COURSE_STEP_LEVELS, type CourseStepLevel } from '@ab/constants';
import { client, db } from '@ab/db/connection';
import { inArray } from 'drizzle-orm';
import { parse } from 'yaml';
import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Paths + CLI flags
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const DEFAULT_COURSES_DIR = resolve(REPO_ROOT, 'course/courses');

// Skip-listed top-level entries inside `course/courses/`. The fixture root
// (`_fixtures/`) houses subdirectories with their own slugs that are
// authored on-demand by tests; iterating it as a slug would 404.
const TOP_LEVEL_SKIP = new Set<string>(['_fixtures']);

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface SeedCoursesOptions {
	/** Override `course/courses/`. Used by smoke tests + the seed-smoke fixture. */
	coursesDir?: string;
	/** When set, seed only the named course slug. */
	slug?: string;
	/** Marker propagated to every row; surfaced by `bun run db seed:check`. */
	seedOrigin?: string | null;
}

export interface SeedCoursesSummary {
	coursesScanned: number;
	coursesUpserted: number;
	coursesSkipped: number;
	stepsScanned: number;
	stepsUpserted: number;
	stepsSkipped: number;
}

export class CourseSeedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CourseSeedError';
	}
}

export async function seedCourses(options: SeedCoursesOptions = {}): Promise<SeedCoursesSummary> {
	const coursesDir = options.coursesDir ?? DEFAULT_COURSES_DIR;
	if (!existsSync(coursesDir)) {
		throw new CourseSeedError(`courses directory not found: ${coursesDir}`);
	}

	const slugs = readdirSync(coursesDir)
		.filter((entry) => !TOP_LEVEL_SKIP.has(entry))
		.filter((entry) => statSync(resolve(coursesDir, entry)).isDirectory())
		.filter((slug) => options.slug === undefined || slug === options.slug)
		.sort();

	if (slugs.length === 0) {
		const detail = options.slug ? ` for slug ${options.slug}` : '';
		throw new CourseSeedError(`no course directories found${detail} in ${coursesDir}`);
	}

	const summary: SeedCoursesSummary = {
		coursesScanned: 0,
		coursesUpserted: 0,
		coursesSkipped: 0,
		stepsScanned: 0,
		stepsUpserted: 0,
		stepsSkipped: 0,
	};

	for (const slug of slugs) {
		await seedOneCourse(coursesDir, slug, options, summary);
	}

	return summary;
}

// ---------------------------------------------------------------------------
// Per-course seeding
// ---------------------------------------------------------------------------

interface ParsedSection {
	readonly filename: string;
	readonly section: CourseSection;
}

async function seedOneCourse(
	coursesDir: string,
	slug: string,
	options: SeedCoursesOptions,
	summary: SeedCoursesSummary,
): Promise<void> {
	summary.coursesScanned += 1;
	const dir = resolve(coursesDir, slug);
	const manifestPath = resolve(dir, 'manifest.yaml');
	if (!existsSync(manifestPath)) {
		throw new CourseSeedError(`course '${slug}': manifest.yaml not found at ${manifestPath}`);
	}

	const manifestRaw = await readFile(manifestPath, 'utf8');
	const manifest = parseManifest(slug, manifestRaw);

	if (manifest.slug !== slug) {
		throw new CourseSeedError(`course directory '${slug}' carries manifest slug '${manifest.slug}'`);
	}

	const sections = await loadSections(dir, slug);

	// Full-tree validator pass BEFORE any DB writes. Every rejection in the
	// spec's "Seed validator rejections" table fires here with the exact
	// message string callers can grep against.
	validateCourseTree(manifest, sections);
	await validateKnowledgeNodeRefs(manifest, sections);

	// Course row -- skip the UPDATE when the manifest payload is unchanged
	// from the row already in the DB. `study.course` has no `content_hash`
	// column, so equality is checked field-by-field; a future column add
	// MUST extend that check.
	const existingCourse = await getCourseBySlug(slug, db);
	const courseRow = await upsertCourseIfChanged(manifest, existingCourse, options, summary);

	// Index existing step rows by `(courseId, code)` so per-step content_hash
	// comparison can skip unchanged rows. After the first time a course is
	// seeded the entire tree is loaded once and held in memory for the rest
	// of this course's pass.
	const existingSteps = await getCourseStepsByCourse(courseRow.id, db);
	const existingByCode = new Map<string, (typeof existingSteps)[number]>();
	for (const row of existingSteps) existingByCode.set(row.code, row);

	for (const { section } of sections) {
		await seedOneSection(courseRow.id, manifest.slug, section, existingByCode, options, summary);
	}

	// Detect orphan rows (a section/step that vanished from the YAML). The
	// course-primitive WP spec doesn't authorise the seed to delete authored
	// rows automatically; instead surface the orphan loudly so the human can
	// remove it via psql or an explicit migration. The smoke fixture's hash
	// expectations assume zero orphans, so this also doubles as a
	// cleanliness gate during fixture development.
	const yamlCodes = collectYamlCodes(sections);
	const orphans = existingSteps.filter((r) => !yamlCodes.has(r.code));
	if (orphans.length > 0) {
		const list = orphans.map((r) => r.code).join(', ');
		process.stdout.write(
			`seed-courses: course '${slug}': ${orphans.length} stale course_step row(s) present in DB but not in YAML: ${list}\n`,
		);
	}
}

function collectYamlCodes(sections: readonly ParsedSection[]): Set<string> {
	const codes = new Set<string>();
	for (const { section } of sections) {
		codes.add(section.code);
		for (const step of section.steps) codes.add(step.code);
	}
	return codes;
}

async function seedOneSection(
	courseId: string,
	courseSlug: string,
	section: CourseSection,
	existingByCode: Map<string, Awaited<ReturnType<typeof getCourseStepsByCourse>>[number]>,
	options: SeedCoursesOptions,
	summary: SeedCoursesSummary,
): Promise<void> {
	summary.stepsScanned += 1;
	const sectionHash = hashSection(courseSlug, section, options.seedOrigin ?? null);
	const existingSection = existingByCode.get(section.code);
	let sectionRow = existingSection;
	if (existingSection?.contentHash === sectionHash) {
		summary.stepsSkipped += 1;
	} else {
		sectionRow = await upsertCourseStep(
			{
				courseId,
				parentId: null,
				level: COURSE_STEP_LEVELS.SECTION,
				ordinal: section.ordinal,
				code: section.code,
				title: section.title,
				bodyMd: section.body_md,
				knowledgeNodeId: null,
				contentHash: sectionHash,
				...(options.seedOrigin ? { seedOrigin: options.seedOrigin } : {}),
			},
			db,
		);
		summary.stepsUpserted += 1;
		existingByCode.set(section.code, sectionRow);
	}
	if (!sectionRow) {
		throw new CourseSeedError(`course '${courseSlug}': section '${section.code}' upsert returned no row`);
	}
	const sectionId = sectionRow.id;

	for (const step of section.steps) {
		summary.stepsScanned += 1;
		const stepHash = hashStep(courseSlug, section.code, step, options.seedOrigin ?? null);
		const existingStep = existingByCode.get(step.code);
		// Skip the write only when the hash AND the parent linkage are
		// stable. A step that moved to a new section needs a row update so
		// `parent_id` follows the YAML.
		if (existingStep?.contentHash === stepHash && existingStep.parentId === sectionId) {
			summary.stepsSkipped += 1;
			continue;
		}
		const row = await upsertCourseStep(
			{
				courseId,
				parentId: sectionId,
				level: COURSE_STEP_LEVELS.STEP,
				ordinal: step.ordinal,
				code: step.code,
				title: step.title,
				bodyMd: step.body_md,
				knowledgeNodeId: step.knowledge_node_id,
				contentHash: stepHash,
				...(options.seedOrigin ? { seedOrigin: options.seedOrigin } : {}),
			},
			db,
		);
		summary.stepsUpserted += 1;
		existingByCode.set(step.code, row);
	}
}

async function upsertCourseIfChanged(
	manifest: CourseManifest,
	existingCourse: Awaited<ReturnType<typeof getCourseBySlug>>,
	options: SeedCoursesOptions,
	summary: SeedCoursesSummary,
): Promise<Awaited<ReturnType<typeof upsertCourse>>> {
	if (
		existingCourse !== null &&
		existingCourse.kind === manifest.kind &&
		existingCourse.title === manifest.title &&
		existingCourse.description === manifest.description &&
		existingCourse.status === manifest.status &&
		(existingCourse.seedOrigin ?? null) === (options.seedOrigin ?? null)
	) {
		summary.coursesSkipped += 1;
		return existingCourse;
	}

	const row = await upsertCourse(
		{
			slug: manifest.slug,
			kind: manifest.kind,
			title: manifest.title,
			description: manifest.description,
			status: manifest.status,
			...(options.seedOrigin ? { seedOrigin: options.seedOrigin } : {}),
		},
		db,
	);
	summary.coursesUpserted += 1;
	return row;
}

// ---------------------------------------------------------------------------
// Parsing + per-file validators (Zod shape only)
// ---------------------------------------------------------------------------

function parseManifest(slug: string, raw: string): CourseManifest {
	let parsed: unknown;
	try {
		parsed = parse(raw);
	} catch (err) {
		throw new CourseSeedError(`course '${slug}': manifest YAML failed to parse: ${(err as Error).message}`);
	}

	let manifest: CourseManifest;
	try {
		manifest = courseManifestSchema.parse(parsed);
	} catch (err) {
		// Friendlier kind-specific rejections take priority; surface them
		// before the generic Zod stack.
		const rawKind = isPlainRecord(parsed) ? parsed.kind : undefined;
		if (typeof rawKind === 'string') {
			if (rawKind === COURSE_KINDS.PERSONAL) {
				throw new CourseSeedError(`course kind '${rawKind}' is reserved; authoring deferred`);
			}
			if (!isAllowedCourseKind(rawKind)) {
				throw new CourseSeedError(`course kind '${rawKind}' is not allowed`);
			}
		}
		const rawSlug = isPlainRecord(parsed) ? parsed.slug : undefined;
		if (typeof rawSlug === 'string' && err instanceof ZodError) {
			const slugIssue = err.issues.find((i) => i.path[0] === 'slug');
			if (slugIssue) {
				throw new CourseSeedError(`course slug '${rawSlug}' fails kebab-case shape`);
			}
		}
		throw new CourseSeedError(`course '${slug}': manifest validation failed: ${formatZodError(err)}`);
	}

	// Defensive: the schema accepts `personal` because the kind enum is
	// shared with the (future) UI; the seed pipeline reserves it.
	if (manifest.kind === COURSE_KINDS.PERSONAL) {
		throw new CourseSeedError(`course kind '${manifest.kind}' is reserved; authoring deferred`);
	}

	return manifest;
}

async function loadSections(dir: string, slug: string): Promise<ParsedSection[]> {
	const sectionsDir = resolve(dir, 'sections');
	if (!existsSync(sectionsDir)) {
		return [];
	}

	const filenames = readdirSync(sectionsDir)
		.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
		.sort();

	const sections: ParsedSection[] = [];
	for (const filename of filenames) {
		const path = resolve(sectionsDir, filename);
		const raw = await readFile(path, 'utf8');
		let parsed: unknown;
		try {
			parsed = parse(raw);
		} catch (err) {
			throw new CourseSeedError(
				`course '${slug}': section '${filename}' YAML failed to parse: ${(err as Error).message}`,
			);
		}
		let section: CourseSection;
		try {
			section = courseSectionSchema.parse(parsed);
		} catch (err) {
			throw new CourseSeedError(`course '${slug}': section '${filename}' validation failed: ${formatZodError(err)}`);
		}
		sections.push({ filename, section });
	}
	return sections;
}

// ---------------------------------------------------------------------------
// Cross-row tree validators (the spec's "Seed validator rejections" table)
// ---------------------------------------------------------------------------

function validateCourseTree(manifest: CourseManifest, sections: readonly ParsedSection[]): void {
	const courseSlug = manifest.slug;

	// Duplicate section ordinals across the whole course.
	const sectionOrdinals = new Set<number>();
	for (const { section } of sections) {
		if (sectionOrdinals.has(section.ordinal)) {
			throw new CourseSeedError(`duplicate ordinal in course '${courseSlug}' sections`);
		}
		sectionOrdinals.add(section.ordinal);
	}

	// Cross-section duplicate codes (course-wide).
	const codes = new Set<string>();
	for (const { section } of sections) {
		if (codes.has(section.code)) {
			throw new CourseSeedError(`duplicate code '${section.code}' in course '${courseSlug}'`);
		}
		codes.add(section.code);
		for (const step of section.steps) {
			if (codes.has(step.code)) {
				throw new CourseSeedError(`duplicate code '${step.code}' in course '${courseSlug}'`);
			}
			codes.add(step.code);
		}
	}

	for (const { section } of sections) {
		const sectionLabel = `${courseSlug}.${section.code}`;
		// Sections never carry `knowledge_node_id`. The Zod section schema
		// has no `knowledge_node_id` field at all (strict object), so the
		// only way to land here is via a section file that smuggled the
		// key past the strict parse -- which Zod rejects up-stack with an
		// "unrecognized key" error. Defensive check kept so the rejection
		// message in the spec stays grep-stable.
		if (
			'knowledge_node_id' in section &&
			(section as unknown as Record<string, unknown>).knowledge_node_id !== undefined
		) {
			throw new CourseSeedError(`section '${sectionLabel}' must not carry knowledge_node_id`);
		}

		const stepOrdinals = new Set<number>();
		for (const step of section.steps) {
			if (stepOrdinals.has(step.ordinal)) {
				throw new CourseSeedError(`duplicate ordinal in section '${sectionLabel}' steps`);
			}
			stepOrdinals.add(step.ordinal);

			// Steps must carry `knowledge_node_id`. The schema requires a
			// non-empty string, so this guard is defensive on top of Zod.
			// Step labels follow `<course>.<step_code>` (the step code
			// already encodes its section prefix per the WP authoring
			// convention -- e.g. `s1.3` is the third step under section
			// `s1`). Matches the spec's "Seed validator rejections"
			// table format exactly so log-greps stay stable.
			if (typeof step.knowledge_node_id !== 'string' || step.knowledge_node_id.length === 0) {
				throw new CourseSeedError(`step '${courseSlug}.${step.code}' must carry knowledge_node_id`);
			}
		}
	}

	// Cycle check. The two-level tree shape guarantees no cycles in
	// practice (sections have NULL parent_id at the schema layer; steps
	// can only point at a section), so this is purely defensive against
	// a future authoring shape that allows nested sections. Walk every
	// step + ensure its declared parent is one of the seen sections.
	const sectionCodes = new Set<string>();
	for (const { section } of sections) sectionCodes.add(section.code);
	const stepParentByCode = new Map<string, string>();
	for (const { section } of sections) {
		for (const step of section.steps) {
			stepParentByCode.set(step.code, section.code);
		}
	}
	for (const [code, parent] of stepParentByCode) {
		if (parent === code) {
			throw new CourseSeedError(`cycle in course '${courseSlug}' tree`);
		}
		if (!sectionCodes.has(parent)) {
			throw new CourseSeedError(`cycle in course '${courseSlug}' tree`);
		}
	}

	// Section / step level consistency surfaces in two more places (sections
	// at the `parent_id IS NULL` level and steps at the `parent_id IS NOT
	// NULL` level). Both are baked into the upsert path; the schema CHECK
	// (`course_step_consistency_check`) is the safety net, the messages
	// above are the friendly version.
}

async function validateKnowledgeNodeRefs(manifest: CourseManifest, sections: readonly ParsedSection[]): Promise<void> {
	const referencedNodeIds = new Set<string>();
	for (const { section } of sections) {
		for (const step of section.steps) {
			referencedNodeIds.add(step.knowledge_node_id);
		}
	}
	if (referencedNodeIds.size === 0) return;

	const ids = Array.from(referencedNodeIds);
	const rows = await db.select({ id: knowledgeNode.id }).from(knowledgeNode).where(inArray(knowledgeNode.id, ids));
	const known = new Set(rows.map((r) => r.id));

	for (const { section } of sections) {
		for (const step of section.steps) {
			if (!known.has(step.knowledge_node_id)) {
				// `<course>.<step_code>` -- the step code already encodes
				// its section prefix (e.g. `s1.3`). Matches the spec
				// rejection table's `'X.s1.3'` example.
				void section;
				const stepLabel = `${manifest.slug}.${step.code}`;
				throw new CourseSeedError(
					`course step '${stepLabel}' references missing knowledge_node '${step.knowledge_node_id}'`,
				);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function hashSection(courseSlug: string, section: CourseSection, seedOrigin: string | null): string {
	return sha256({
		kind: 'course-section',
		course_slug: courseSlug,
		level: COURSE_STEP_LEVELS.SECTION satisfies CourseStepLevel,
		code: section.code,
		ordinal: section.ordinal,
		title: section.title,
		body_md: section.body_md,
		seed_origin: seedOrigin,
	});
}

function hashStep(
	courseSlug: string,
	sectionCode: string,
	step: { code: string; ordinal: number; title: string; body_md: string; knowledge_node_id: string },
	seedOrigin: string | null,
): string {
	return sha256({
		kind: 'course-step',
		course_slug: courseSlug,
		level: COURSE_STEP_LEVELS.STEP satisfies CourseStepLevel,
		section_code: sectionCode,
		code: step.code,
		ordinal: step.ordinal,
		title: step.title,
		body_md: step.body_md,
		knowledge_node_id: step.knowledge_node_id,
		seed_origin: seedOrigin,
	});
}

function sha256(value: unknown): string {
	const canonical = canonicalJson(value);
	return createHash('sha256').update(canonical).digest('hex');
}

function canonicalJson(value: unknown): string {
	if (value === null) return 'null';
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(',')}]`;
	}
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
	}
	return JSON.stringify(String(value));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAllowedCourseKind(value: string): boolean {
	return Object.values(COURSE_KINDS).includes(value as (typeof COURSE_KINDS)[keyof typeof COURSE_KINDS]);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatZodError(err: unknown): string {
	if (err instanceof ZodError) {
		return err.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
	}
	return (err as Error).message;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	// Walk argv and split into options + positional. `--dir <path>`
	// consumes the next slot as its value; everything else that starts
	// with `-` is dropped (no other flags today). The first remaining
	// positional is treated as a course slug to scope the seed.
	let customDir: string | undefined;
	const positional: string[] = [];
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === '--dir') {
			customDir = args[i + 1];
			i += 1;
			continue;
		}
		if (arg !== undefined && !arg.startsWith('-')) {
			positional.push(arg);
		}
	}
	const slug = positional[0];

	const options: SeedCoursesOptions = {};
	if (slug) options.slug = slug;
	if (customDir) options.coursesDir = resolve(process.cwd(), customDir);

	const summary = await seedCourses(options);
	process.stdout.write(
		`seed-courses: ${summary.coursesScanned} scanned (${summary.coursesUpserted} written, ${summary.coursesSkipped} unchanged), ` +
			`${summary.stepsScanned} step rows scanned (${summary.stepsUpserted} written, ${summary.stepsSkipped} unchanged)\n`,
	);
}

if (import.meta.main) {
	main()
		.catch((err) => {
			if (err instanceof CourseSeedError) {
				process.stderr.write(`seed-courses: ${err.message}\n`);
			} else {
				process.stderr.write(`seed-courses: ${(err as Error).stack ?? err}\n`);
			}
			process.exitCode = 1;
		})
		.finally(() => client.end());
}
