/**
 * Path-traversal guard tests (course-reader-and-editor WP -- security
 * review fixes).
 *
 * The hangar course editor's `[slug]` route param + the `filename` / `code`
 * form fields flow into `node:path` `resolve()` + `fs` write/delete calls.
 * These tests prove a `../` slug / filename / code is rejected before any
 * path is built, and that `assertResolvedUnder` catches a path that escaped
 * the courses directory.
 */

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertResolvedUnder, assertSafeSlug, isSafeCode, isSafeSectionFilename } from '../course-path-safety';

describe('assertSafeSlug', () => {
	it('accepts a canonical kebab-case slug', () => {
		expect(() => assertSafeSlug('weather-comprehensive')).not.toThrow();
		expect(() => assertSafeSlug('seed-smoke')).not.toThrow();
	});

	it('rejects a traversal slug', () => {
		expect(() => assertSafeSlug('../../../../etc/passwd')).toThrow();
		expect(() => assertSafeSlug('..')).toThrow();
		expect(() => assertSafeSlug('foo/../bar')).toThrow();
	});

	it('rejects a slug with a slash, leading dash, or uppercase', () => {
		expect(() => assertSafeSlug('foo/bar')).toThrow();
		expect(() => assertSafeSlug('-leading')).toThrow();
		expect(() => assertSafeSlug('Weather')).toThrow();
		expect(() => assertSafeSlug('')).toThrow();
	});

	it('rejects a URL-encoded traversal segment', () => {
		// `%2e%2e%2f` decoded is `../`; SvelteKit does not decode route
		// params for the matcher, so the raw value reaches the guard.
		expect(() => assertSafeSlug('%2e%2e%2fsecret')).toThrow();
	});
});

describe('isSafeSectionFilename', () => {
	it('accepts a bare .yaml basename', () => {
		expect(isSafeSectionFilename('s1-intro.yaml')).toBe(true);
		expect(isSafeSectionFilename('s1.yaml')).toBe(true);
	});

	it('rejects a traversal filename', () => {
		expect(isSafeSectionFilename('../../../../etc/cron.d/evil.yaml')).toBe(false);
		expect(isSafeSectionFilename('../s1.yaml')).toBe(false);
		expect(isSafeSectionFilename('sub/dir/s1.yaml')).toBe(false);
	});

	it('rejects a non-.yaml extension or empty input', () => {
		expect(isSafeSectionFilename('s1.txt')).toBe(false);
		expect(isSafeSectionFilename('s1')).toBe(false);
		expect(isSafeSectionFilename('')).toBe(false);
		expect(isSafeSectionFilename('.yaml')).toBe(false);
	});
});

describe('isSafeCode', () => {
	it('accepts a course-step code shape', () => {
		expect(isSafeCode('s1')).toBe(true);
		expect(isSafeCode('s1.3')).toBe(true);
		expect(isSafeCode('s1-intro')).toBe(true);
	});

	it('rejects a traversal / slash / empty code', () => {
		expect(isSafeCode('../../evil')).toBe(false);
		expect(isSafeCode('a/b')).toBe(false);
		expect(isSafeCode('..')).toBe(false);
		expect(isSafeCode('')).toBe(false);
		expect(isSafeCode('.hidden')).toBe(false);
	});
});

describe('assertResolvedUnder', () => {
	const base = '/repo/course/courses';

	it('accepts a path inside the base directory', () => {
		expect(() => assertResolvedUnder(base, resolve(base, 'wx', 'manifest.yaml'))).not.toThrow();
		expect(() => assertResolvedUnder(base, base)).not.toThrow();
	});

	it('rejects a path that escapes the base directory', () => {
		expect(() => assertResolvedUnder(base, resolve(base, '..', '..', 'etc', 'passwd'))).toThrow();
		expect(() => assertResolvedUnder(base, '/etc/passwd')).toThrow();
	});

	it('rejects a sibling directory with a shared prefix', () => {
		// `/repo/course/courses-evil` shares the `courses` prefix but is NOT
		// under `/repo/course/courses/`.
		expect(() => assertResolvedUnder(base, '/repo/course/courses-evil/x')).toThrow();
	});
});
