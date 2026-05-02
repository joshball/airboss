/**
 * Unit tests for the canonical cache-root helper.
 *
 * Covers the three behaviours promised by `resolveCacheRoot()`:
 *   1. Honors `ENV_VARS.AIRBOSS_HANDBOOK_CACHE` when set.
 *   2. Expands a leading `~` in the env value to `homedir()`.
 *   3. Falls back to `<homedir>/Documents/airboss-handbook-cache/` when unset.
 *
 * Plus the lighter `defaultCacheRoot()` (same semantics minus `mkdir`) and
 * the `expandHome()` helper directly.
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENV_VARS, SOURCE_CACHE } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultCacheRoot, expandHome, resolveCacheRoot } from './cache.ts';

let originalEnv: string | undefined;
let tmpRoot: string;

beforeEach(() => {
	originalEnv = process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
	tmpRoot = mkdtempSync(join(tmpdir(), 'cache-root-'));
});

afterEach(() => {
	if (originalEnv === undefined) delete process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
	else process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = originalEnv;
	rmSync(tmpRoot, { recursive: true, force: true });
});

describe('expandHome', () => {
	it('expands a leading "~/" prefix to homedir()', () => {
		expect(expandHome('~/foo/bar')).toBe(join(homedir(), 'foo', 'bar'));
	});

	it('expands a bare "~" to homedir()', () => {
		expect(expandHome('~')).toBe(homedir());
	});

	it('passes absolute paths through unchanged', () => {
		expect(expandHome('/var/cache/airboss')).toBe('/var/cache/airboss');
	});

	it('does not expand "~" in the middle of a path', () => {
		expect(expandHome('/etc/~weird')).toBe('/etc/~weird');
	});
});

describe('resolveCacheRoot', () => {
	it('honors ENV_VARS.AIRBOSS_HANDBOOK_CACHE when set', () => {
		process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = tmpRoot;
		expect(resolveCacheRoot()).toBe(tmpRoot);
	});

	it('expands a "~/..." env value to homedir()', () => {
		// Use a tilde path that is guaranteed to exist (homedir itself) so the
		// `mkdir` in resolveCacheRoot is a no-op and the test is hermetic.
		process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = '~';
		expect(resolveCacheRoot()).toBe(homedir());
	});

	it('falls back to <homedir>/Documents/airboss-handbook-cache when unset', () => {
		delete process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
		const expected = join(homedir(), SOURCE_CACHE.DEFAULT_PARENT_DIR, SOURCE_CACHE.DEFAULT_DIR_NAME);
		expect(resolveCacheRoot()).toBe(expected);
	});

	it('treats an empty env value as unset and falls back to the default', () => {
		process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = '';
		const expected = join(homedir(), SOURCE_CACHE.DEFAULT_PARENT_DIR, SOURCE_CACHE.DEFAULT_DIR_NAME);
		expect(resolveCacheRoot()).toBe(expected);
	});

	it('creates the directory tree on demand', () => {
		const nested = join(tmpRoot, 'nested', 'cache');
		process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = nested;
		expect(existsSync(nested)).toBe(false);
		const resolved = resolveCacheRoot();
		expect(resolved).toBe(nested);
		expect(existsSync(nested)).toBe(true);
	});
});

describe('defaultCacheRoot', () => {
	it('honors ENV_VARS.AIRBOSS_HANDBOOK_CACHE when set', () => {
		process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = tmpRoot;
		expect(defaultCacheRoot()).toBe(tmpRoot);
	});

	it('expands "~" in the env value', () => {
		process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = '~/foo';
		expect(defaultCacheRoot()).toBe(join(homedir(), 'foo'));
	});

	it('falls back to <homedir>/Documents/airboss-handbook-cache when unset', () => {
		delete process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
		expect(defaultCacheRoot()).toBe(join(homedir(), SOURCE_CACHE.DEFAULT_PARENT_DIR, SOURCE_CACHE.DEFAULT_DIR_NAME));
	});

	it('does not create the directory (lighter than resolveCacheRoot)', () => {
		const nonExistent = join(tmpRoot, 'never-created');
		process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE] = nonExistent;
		expect(defaultCacheRoot()).toBe(nonExistent);
		expect(existsSync(nonExistent)).toBe(false);
	});
});
