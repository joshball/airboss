// Course YAML disk I/O (course-reader-and-editor WP, Phase 6).
//
// Read + write helpers around `course/courses/<slug>/manifest.yaml` and
// `course/courses/<slug>/sections/*.yaml`. Used by the hangar editor's
// per-save flow:
//
//   1. read backup of YAML file
//   2. emit canonical YAML for the new state
//   3. write the file
//   4. invoke the seed pipeline (course-seed.ts)
//   5. on seed failure: write the backup back
//
// This module is intentionally side-effecting (filesystem reads and
// writes). Pure-data emission is in `./course-yaml-emit.ts`. The two are
// separate so unit tests for the canonical emit don't need a tmp
// directory.

import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type CourseManifest, type CourseSection, courseManifestSchema, courseSectionSchema } from '@ab/bc-study';
import { COURSES_DIR_RELATIVE } from '@ab/constants';
import { parse } from 'yaml';

export interface SectionFileRecord {
	readonly filename: string;
	readonly section: CourseSection;
}

/**
 * Repo-root absolute path to the course directory for a slug. The hangar
 * is run from the repo root, so the relative path resolves correctly via
 * Node's `process.cwd()`. Tests can override the courses root by passing
 * a `coursesDir` override into the wrappers below.
 */
export function courseDirFor(slug: string, coursesDir: string = COURSES_DIR_RELATIVE): string {
	return resolve(coursesDir, slug);
}

export function manifestPathFor(slug: string, coursesDir?: string): string {
	return resolve(courseDirFor(slug, coursesDir), 'manifest.yaml');
}

export function sectionsDirFor(slug: string, coursesDir?: string): string {
	return resolve(courseDirFor(slug, coursesDir), 'sections');
}

export function sectionPathFor(slug: string, filename: string, coursesDir?: string): string {
	return resolve(sectionsDirFor(slug, coursesDir), filename);
}

/**
 * Read + parse the manifest YAML for a course. Returns the validated
 * {@link CourseManifest} or throws a verbose error so the caller's
 * banner can surface the parse failure.
 */
export async function readManifest(slug: string, coursesDir?: string): Promise<CourseManifest> {
	const path = manifestPathFor(slug, coursesDir);
	const raw = await readFile(path, 'utf8');
	const parsed = parse(raw);
	return courseManifestSchema.parse(parsed);
}

/**
 * Raw read of the manifest as text (without parsing). Used for the
 * pre-write backup so a seed failure can revert the bytes verbatim.
 */
export async function readManifestRaw(slug: string, coursesDir?: string): Promise<string> {
	return readFile(manifestPathFor(slug, coursesDir), 'utf8');
}

export async function writeManifestRaw(slug: string, contents: string, coursesDir?: string): Promise<void> {
	await writeFile(manifestPathFor(slug, coursesDir), contents);
}

/**
 * List + parse every section file under `course/courses/<slug>/sections/`,
 * sorted by filename (matches the seed pipeline's traversal order). Each
 * record carries the original filename so write-back can target the same
 * file.
 */
export async function readSections(slug: string, coursesDir?: string): Promise<SectionFileRecord[]> {
	const dir = sectionsDirFor(slug, coursesDir);
	if (!existsSync(dir)) return [];

	const filenames = readdirSync(dir)
		.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
		.sort();

	const out: SectionFileRecord[] = [];
	for (const filename of filenames) {
		const raw = await readFile(resolve(dir, filename), 'utf8');
		const parsed = parse(raw);
		const section = courseSectionSchema.parse(parsed);
		out.push({ filename, section });
	}
	return out;
}

/**
 * Read one section file by filename. Returns null when the file does
 * not exist (the route loader can 404).
 */
export async function readSectionByFilename(
	slug: string,
	filename: string,
	coursesDir?: string,
): Promise<CourseSection | null> {
	const path = sectionPathFor(slug, filename, coursesDir);
	if (!existsSync(path)) return null;
	const raw = await readFile(path, 'utf8');
	return courseSectionSchema.parse(parse(raw));
}

/**
 * Read one section by its `code` (the field inside the YAML). Used by
 * the section editor route which addresses sections by code, not file.
 * Returns null when no section file matches.
 */
export async function readSectionByCode(
	slug: string,
	code: string,
	coursesDir?: string,
): Promise<SectionFileRecord | null> {
	const records = await readSections(slug, coursesDir);
	return records.find((r) => r.section.code === code) ?? null;
}

export async function readSectionRaw(slug: string, filename: string, coursesDir?: string): Promise<string> {
	return readFile(sectionPathFor(slug, filename, coursesDir), 'utf8');
}

export async function writeSectionRaw(
	slug: string,
	filename: string,
	contents: string,
	coursesDir?: string,
): Promise<void> {
	await writeFile(sectionPathFor(slug, filename, coursesDir), contents);
}

/**
 * Build a stable section filename from `code` + `title`. Mirrors the
 * shape of the seed-smoke fixture (`s1-airmass-character.yaml`) -- code
 * + dash + slugified title + `.yaml`.
 */
export function buildSectionFilename(code: string, title: string): string {
	const slugTitle = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return slugTitle === '' ? `${code}.yaml` : `${code}-${slugTitle}.yaml`;
}
