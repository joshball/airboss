// @browser-globals: server-only -- never imported by client .svelte
/**
 * Path-traversal guards for the hangar course editor's filesystem-write
 * surface (course-reader-and-editor WP -- security review fixes).
 *
 * The `[slug]` route param, the section `filename` form field, and the
 * step `code` form field are all attacker-controllable inputs that flow
 * into `node:path` `resolve()` + `fs` write/delete calls. `resolve()`
 * collapses `../` segments, so an unvalidated value escapes
 * `course/courses/`. An authenticated authoring-role account is privilege
 * containment, not input validation -- these guards are the validation.
 *
 * Every hangar course action/loader that takes one of these inputs calls
 * the matching assert at the top, before any path construction. The
 * `assertResolvedUnder` belt-and-braces check confirms a built path still
 * sits inside the courses directory after `resolve()`.
 */

import { resolve, sep } from 'node:path';
import { COURSE_SLUG_REGEX } from '@ab/constants';
import { error } from '@sveltejs/kit';

// Section codes / step codes: lowercase alphanumeric, may contain dots and
// hyphens as internal separators, must start with an alphanumeric. No
// slashes, no leading dot, no `..`. Mirrors the course-step code shape the
// seed validator accepts (`s1`, `s1.3`, `s1-intro`).
const COURSE_CODE_REGEX = /^[a-z0-9][a-z0-9.-]*$/;

/**
 * Reject a `[slug]` route param that is not a canonical course slug.
 * Throws a 400 `error` -- the loader / action never reaches path
 * construction with a traversal value.
 */
export function assertSafeSlug(slug: string): void {
	if (!COURSE_SLUG_REGEX.test(slug)) {
		throw error(400, 'Invalid course slug.');
	}
}

/**
 * Validate a section `filename` form value: a bare `.yaml` basename, no
 * directory separators, no `..`. Returns the filename when valid; the
 * caller throws / fails on a falsy result.
 */
export function isSafeSectionFilename(filename: string): boolean {
	if (filename === '' || filename.includes('/') || filename.includes('\\')) return false;
	if (filename.includes('..')) return false;
	if (!filename.endsWith('.yaml')) return false;
	// The portion before `.yaml` must be a non-empty course-code shape.
	return COURSE_CODE_REGEX.test(filename.slice(0, -'.yaml'.length));
}

/**
 * Validate a step / section `code` form value against the course-code
 * shape (no slashes, no dots-only segments, alphanumeric start).
 */
export function isSafeCode(code: string): boolean {
	if (code === '' || code.includes('/') || code.includes('\\')) return false;
	if (code.includes('..')) return false;
	return COURSE_CODE_REGEX.test(code);
}

/**
 * Belt-and-braces: assert `resolvedPath` sits inside `baseDir` after
 * `node:path` `resolve()` has collapsed any `../` segments. Throws a 400
 * `error` when the path escaped. Use after building a path from a value
 * that has already passed `assertSafeSlug` / `isSafe*` as a defence in
 * depth against a guard regression.
 */
export function assertResolvedUnder(baseDir: string, resolvedPath: string): void {
	const base = resolve(baseDir);
	const target = resolve(resolvedPath);
	if (target !== base && !target.startsWith(base + sep)) {
		throw error(400, 'Resolved path escapes the courses directory.');
	}
}
