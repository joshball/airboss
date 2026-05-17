// @browser-globals: server-only -- never imported by client .svelte
/**
 * Course seed pipeline (course-primitive WP, Phase 6).
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
 * This module is the seed pipeline proper -- a runtime dependency of the
 * hangar course editor (`apps/hangar/.../courses/[slug]/+page.server.ts`
 * re-runs `seedCourses` on every save) and of the `bun run db seed courses`
 * CLI. It lives in the BC (not `scripts/`) because apps depend on libs, not
 * on scripts. The thin CLI wrapper at `scripts/db/seed-courses.ts` imports
 * `seedCourses` from `@ab/bc-study/server` and adds only argv parsing.
 *
 * Server-only: the `node:fs` / `node:crypto` imports and the
 * `@ab/db/connection` reach mean this file is value-exported from
 * `@ab/bc-study/server`, never from the runtime barrel `@ab/bc-study`.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSE_KINDS, COURSE_STEP_LEVELS, type CourseStepLevel } from '@ab/constants';
import { db } from '@ab/db/connection';
import { inArray } from 'drizzle-orm';
import { parse } from 'yaml';
import { ZodError } from 'zod';
import {
	type CourseLesson,
	type CourseManifest,
	type CourseSection,
	type CourseStep,
	type CourseTreeNode,
	courseManifestSchema,
	courseSectionSchema,
} from './course-yaml-schemas';
import { getCourseBySlug, getCourseStepsByCourse, upsertCourse, upsertCourseStep } from './courses';
import { knowledgeNode } from './schema';
import {
	CourseSeedError,
	isLessonNode,
	isStepNode,
	type ParsedSection,
	validateCourseTree,
} from './seed-courses-validator';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Locate the monorepo root by walking up from this module's own directory
 * until a directory carries both `package.json` and the `course/courses/`
 * tree. `process.cwd()` is NOT reliable here: the `bun run db seed` CLI
 * launches from the repo root, but the SvelteKit hangar dev/build process
 * runs vite with `cwd = apps/hangar/` -- so a `cwd`-relative resolve would
 * point at the non-existent `apps/hangar/course/courses`. Walking up from
 * `import.meta.url` is correct regardless of the launching cwd, and uses a
 * marker check rather than a counted `../../..` chain so the module stays
 * move-safe.
 */
function findRepoRoot(): string {
	let dir = dirname(fileURLToPath(import.meta.url));
	// `/` (POSIX) or a drive root collapses to itself under `resolve(dir, '..')`.
	for (let depth = 0; depth < 12; depth += 1) {
		if (existsSync(resolve(dir, 'package.json')) && existsSync(resolve(dir, 'course', 'courses'))) {
			return dir;
		}
		const parent = resolve(dir, '..');
		if (parent === dir) break;
		dir = parent;
	}
	throw new CourseSeedError('could not locate the repo root (no package.json + course/courses ancestor)');
}

/**
 * The canonical `course/courses/` directory. Resolved once from the repo
 * root located via {@link findRepoRoot}.
 */
export const DEFAULT_COURSES_DIR = resolve(findRepoRoot(), 'course/courses');

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

// `CourseSeedError`, `ParsedSection`, `isLessonNode`, `isStepNode`, and
// `validateCourseTree` live in `./seed-courses-validator.ts` so the unit
// test suite can import them without dragging the server-only DB barrel
// into the test runtime. Re-exported here so external callers continue to
// see them on the historical surface.
export type { ParsedSection };
export { CourseSeedError, validateCourseTree };

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

	// Wrap the per-course upserts in one transaction so a save that fails
	// after partial DB writes (a later section trips a DB-level CHECK the
	// YAML schema did not catch) rolls back entirely -- the reader never
	// surfaces a half-seeded course. The orphan-detection log below stays
	// outside the transaction (it is a read + a `process.stdout.write`).
	await db.transaction(async (tx) => {
		// Course row -- skip the UPDATE when the manifest payload is unchanged
		// from the row already in the DB. `study.course` has no `content_hash`
		// column, so equality is checked field-by-field; a future column add
		// MUST extend that check.
		const existingCourse = await getCourseBySlug(slug, tx);
		const courseRow = await upsertCourseIfChanged(manifest, existingCourse, options, summary, tx);

		// Index existing step rows by `(courseId, code)` so per-step
		// content_hash comparison can skip unchanged rows.
		const existingSteps = await getCourseStepsByCourse(courseRow.id, tx);
		const existingByCode = new Map<string, (typeof existingSteps)[number]>();
		for (const row of existingSteps) existingByCode.set(row.code, row);

		for (const { section } of sections) {
			await seedOneSection(courseRow.id, manifest.slug, section, existingByCode, options, summary, tx);
		}
	});

	// Detect orphan rows (a section/step that vanished from the YAML). The
	// course-primitive WP spec doesn't authorise the seed to delete authored
	// rows automatically; instead surface the orphan loudly so the human can
	// remove it (the hangar editor's cleanup-orphans action, or psql).
	const refreshedCourse = await getCourseBySlug(slug, db);
	if (refreshedCourse !== null) {
		const refreshedSteps = await getCourseStepsByCourse(refreshedCourse.id, db);
		const yamlCodes = collectYamlCodes(sections);
		const orphans = refreshedSteps.filter((r) => !yamlCodes.has(r.code));
		if (orphans.length > 0) {
			const list = orphans.map((r) => r.code).join(', ');
			process.stdout.write(
				`seed-courses: course '${slug}': ${orphans.length} stale course_step row(s) present in DB but not in YAML: ${list}\n`,
			);
		}
	}
}

function collectYamlCodes(sections: readonly ParsedSection[]): Set<string> {
	const codes = new Set<string>();
	function walk(node: CourseTreeNode): void {
		codes.add(node.code);
		if (isLessonNode(node)) {
			for (const child of node.steps) walk(child);
		}
	}
	for (const { section } of sections) {
		codes.add(section.code);
		for (const node of section.steps) walk(node);
	}
	return codes;
}

type SeedDb = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

async function seedOneSection(
	courseId: string,
	courseSlug: string,
	section: CourseSection,
	existingByCode: Map<string, Awaited<ReturnType<typeof getCourseStepsByCourse>>[number]>,
	options: SeedCoursesOptions,
	summary: SeedCoursesSummary,
	seedDb: SeedDb,
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
			seedDb,
		);
		summary.stepsUpserted += 1;
		existingByCode.set(section.code, sectionRow);
	}
	if (!sectionRow) {
		throw new CourseSeedError(`course '${courseSlug}': section '${section.code}' upsert returned no row`);
	}

	// Depth-first descent: upsert lessons before their children so each
	// child can resolve `parent_id` against a row already in the DB.
	await seedTreeChildren(
		courseId,
		courseSlug,
		section.code,
		sectionRow.id,
		section.steps,
		existingByCode,
		options,
		summary,
		seedDb,
	);
}

async function seedTreeChildren(
	courseId: string,
	courseSlug: string,
	parentCode: string,
	parentId: string,
	children: ReadonlyArray<CourseTreeNode>,
	existingByCode: Map<string, Awaited<ReturnType<typeof getCourseStepsByCourse>>[number]>,
	options: SeedCoursesOptions,
	summary: SeedCoursesSummary,
	seedDb: SeedDb,
): Promise<void> {
	for (const node of children) {
		if (isLessonNode(node)) {
			await seedOneLesson(courseId, courseSlug, parentCode, parentId, node, existingByCode, options, summary, seedDb);
		} else if (isStepNode(node)) {
			await seedOneStep(courseId, courseSlug, parentCode, parentId, node, existingByCode, options, summary, seedDb);
		} else {
			// `validateCourseTree` rejects unknown levels upstream; this
			// arm is defensive in case of a Zod schema drift.
			throw new CourseSeedError(`course '${courseSlug}': unknown node level in tree under '${parentCode}'`);
		}
	}
}

async function seedOneLesson(
	courseId: string,
	courseSlug: string,
	parentCode: string,
	parentId: string,
	lesson: CourseLesson,
	existingByCode: Map<string, Awaited<ReturnType<typeof getCourseStepsByCourse>>[number]>,
	options: SeedCoursesOptions,
	summary: SeedCoursesSummary,
	seedDb: SeedDb,
): Promise<void> {
	summary.stepsScanned += 1;
	const lessonHash = hashLesson(courseSlug, parentCode, lesson, options.seedOrigin ?? null);
	const existingLesson = existingByCode.get(lesson.code);
	let lessonRow = existingLesson;
	// Skip the write only when the hash AND the parent linkage are stable.
	if (existingLesson?.contentHash === lessonHash && existingLesson.parentId === parentId) {
		summary.stepsSkipped += 1;
	} else {
		lessonRow = await upsertCourseStep(
			{
				courseId,
				parentId,
				level: COURSE_STEP_LEVELS.LESSON,
				ordinal: lesson.ordinal,
				code: lesson.code,
				title: lesson.title,
				bodyMd: lesson.body_md ?? '',
				knowledgeNodeId: null,
				contentHash: lessonHash,
				...(options.seedOrigin ? { seedOrigin: options.seedOrigin } : {}),
			},
			seedDb,
		);
		summary.stepsUpserted += 1;
		existingByCode.set(lesson.code, lessonRow);
	}
	if (!lessonRow) {
		throw new CourseSeedError(`course '${courseSlug}': lesson '${lesson.code}' upsert returned no row`);
	}

	await seedTreeChildren(
		courseId,
		courseSlug,
		lesson.code,
		lessonRow.id,
		lesson.steps,
		existingByCode,
		options,
		summary,
		seedDb,
	);
}

async function seedOneStep(
	courseId: string,
	courseSlug: string,
	parentCode: string,
	parentId: string,
	step: CourseStep,
	existingByCode: Map<string, Awaited<ReturnType<typeof getCourseStepsByCourse>>[number]>,
	options: SeedCoursesOptions,
	summary: SeedCoursesSummary,
	seedDb: SeedDb,
): Promise<void> {
	summary.stepsScanned += 1;
	// `validateCourseTree` guarantees every step row that reaches here
	// carries a non-empty `knowledge_node_id`.
	if (typeof step.knowledge_node_id !== 'string' || step.knowledge_node_id.length === 0) {
		throw new CourseSeedError(`step '${courseSlug}.${step.code}' must carry knowledge_node_id`);
	}
	const knowledgeNodeId = step.knowledge_node_id;
	const stepHash = hashStep(
		courseSlug,
		parentCode,
		{
			code: step.code,
			ordinal: step.ordinal,
			title: step.title,
			body_md: step.body_md ?? '',
			knowledge_node_id: knowledgeNodeId,
		},
		options.seedOrigin ?? null,
	);
	const existingStep = existingByCode.get(step.code);
	if (existingStep?.contentHash === stepHash && existingStep.parentId === parentId) {
		summary.stepsSkipped += 1;
		return;
	}
	const row = await upsertCourseStep(
		{
			courseId,
			parentId,
			level: COURSE_STEP_LEVELS.STEP,
			ordinal: step.ordinal,
			code: step.code,
			title: step.title,
			bodyMd: step.body_md ?? '',
			knowledgeNodeId,
			contentHash: stepHash,
			...(options.seedOrigin ? { seedOrigin: options.seedOrigin } : {}),
		},
		seedDb,
	);
	summary.stepsUpserted += 1;
	existingByCode.set(step.code, row);
}

async function upsertCourseIfChanged(
	manifest: CourseManifest,
	existingCourse: Awaited<ReturnType<typeof getCourseBySlug>>,
	options: SeedCoursesOptions,
	summary: SeedCoursesSummary,
	seedDb: SeedDb,
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
		seedDb,
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

async function validateKnowledgeNodeRefs(manifest: CourseManifest, sections: readonly ParsedSection[]): Promise<void> {
	// `validateCourseTree` has already asserted every leaf carries a
	// non-empty `knowledge_node_id` and every interior carries none.
	const referencedNodeIds = new Set<string>();
	function collect(node: CourseTreeNode): void {
		if (isStepNode(node)) {
			if (typeof node.knowledge_node_id === 'string' && node.knowledge_node_id.length > 0) {
				referencedNodeIds.add(node.knowledge_node_id);
			}
			return;
		}
		if (isLessonNode(node)) {
			for (const child of node.steps) collect(child);
		}
	}
	for (const { section } of sections) {
		for (const node of section.steps) collect(node);
	}
	if (referencedNodeIds.size === 0) return;

	const ids = Array.from(referencedNodeIds);
	const rows = await db.select({ id: knowledgeNode.id }).from(knowledgeNode).where(inArray(knowledgeNode.id, ids));
	const known = new Set(rows.map((r) => r.id));

	function check(node: CourseTreeNode): void {
		if (isStepNode(node)) {
			if (typeof node.knowledge_node_id !== 'string' || node.knowledge_node_id.length === 0) return;
			if (!known.has(node.knowledge_node_id)) {
				const stepLabel = `${manifest.slug}.${node.code}`;
				throw new CourseSeedError(
					`course step '${stepLabel}' references missing knowledge_node '${node.knowledge_node_id}'`,
				);
			}
			return;
		}
		if (isLessonNode(node)) {
			for (const child of node.steps) check(child);
		}
	}
	for (const { section } of sections) {
		for (const node of section.steps) check(node);
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

function hashLesson(courseSlug: string, parentCode: string, lesson: CourseLesson, seedOrigin: string | null): string {
	return sha256({
		kind: 'course-lesson',
		course_slug: courseSlug,
		level: COURSE_STEP_LEVELS.LESSON satisfies CourseStepLevel,
		parent_code: parentCode,
		code: lesson.code,
		ordinal: lesson.ordinal,
		title: lesson.title,
		body_md: lesson.body_md ?? '',
		seed_origin: seedOrigin,
	});
}

function hashStep(
	courseSlug: string,
	parentCode: string,
	step: { code: string; ordinal: number; title: string; body_md: string; knowledge_node_id: string },
	seedOrigin: string | null,
): string {
	// The `section_code` field name is load-bearing for zero-diff
	// compatibility with pre-WP 2-level content (every existing weather-
	// comprehensive step row was hashed with this exact key).
	return sha256({
		kind: 'course-step',
		course_slug: courseSlug,
		level: COURSE_STEP_LEVELS.STEP satisfies CourseStepLevel,
		section_code: parentCode,
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
