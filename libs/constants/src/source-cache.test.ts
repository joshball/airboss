/**
 * Tests for source-cache root resolution.
 *
 * Guards against regression of the consolidated cache-root helper that
 * replaces five legacy `defaultCacheRoot()` re-implementations and the
 * original four-of-five tilde-expansion bug (per cluster B fix on
 * `2026-05-01-sources-content-pipeline-*`).
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ENV_VARS } from './env';
import { defaultCacheRoot, expandHome, resolveCacheRoot, SOURCE_CACHE } from './source-cache';

const ENV_KEY = ENV_VARS.AIRBOSS_HANDBOOK_CACHE;

describe('SOURCE_CACHE', () => {
	it('exposes the env var name + default directory pieces', () => {
		expect(SOURCE_CACHE.ENV_VAR).toBe('AIRBOSS_HANDBOOK_CACHE');
		expect(SOURCE_CACHE.DEFAULT_PARENT_DIR).toBe('Documents');
		expect(SOURCE_CACHE.DEFAULT_DIR_NAME).toBe('airboss-handbook-cache');
	});

	it('routes through ENV_VARS so the env-var name has one canonical source', () => {
		expect(SOURCE_CACHE.ENV_VAR).toBe(ENV_VARS.AIRBOSS_HANDBOOK_CACHE);
	});
});

describe('expandHome', () => {
	it('expands a leading `~/`', () => {
		expect(expandHome('~/cache')).toBe(join(homedir(), 'cache'));
	});

	it('expands a bare `~`', () => {
		expect(expandHome('~')).toBe(homedir());
	});

	it('leaves absolute paths alone', () => {
		expect(expandHome('/tmp/cache')).toBe('/tmp/cache');
	});

	it('does not expand `~name` (only `~` and `~/`)', () => {
		expect(expandHome('~user/cache')).toBe('~user/cache');
	});

	it('leaves the empty string alone', () => {
		expect(expandHome('')).toBe('');
	});
});

describe('defaultCacheRoot', () => {
	it('joins homedir with the default parent + dir name', () => {
		expect(defaultCacheRoot()).toBe(join(homedir(), SOURCE_CACHE.DEFAULT_PARENT_DIR, SOURCE_CACHE.DEFAULT_DIR_NAME));
	});
});

describe('resolveCacheRoot', () => {
	let originalEnv: string | undefined;
	let tempRoot: string;

	beforeEach(() => {
		originalEnv = process.env[ENV_KEY];
		tempRoot = mkdtempSync(join(tmpdir(), 'airboss-cache-test-'));
	});

	afterEach(() => {
		if (originalEnv === undefined) delete process.env[ENV_KEY];
		else process.env[ENV_KEY] = originalEnv;
		rmSync(tempRoot, { recursive: true, force: true });
	});

	it('falls back to the default when the env var is unset', () => {
		delete process.env[ENV_KEY];
		expect(resolveCacheRoot({ ensureExists: false })).toBe(defaultCacheRoot());
	});

	it('falls back to the default when the env var is empty', () => {
		process.env[ENV_KEY] = '';
		expect(resolveCacheRoot({ ensureExists: false })).toBe(defaultCacheRoot());
	});

	it('honors an absolute env-var override', () => {
		process.env[ENV_KEY] = tempRoot;
		expect(resolveCacheRoot({ ensureExists: false })).toBe(tempRoot);
	});

	it('expands `~/` in the env-var value (regression: 4-of-5 helpers used to skip this)', () => {
		process.env[ENV_KEY] = '~/airboss-cache-tilde';
		expect(resolveCacheRoot({ ensureExists: false })).toBe(join(homedir(), 'airboss-cache-tilde'));
	});

	it('expands a bare `~` in the env-var value', () => {
		process.env[ENV_KEY] = '~';
		expect(resolveCacheRoot({ ensureExists: false })).toBe(homedir());
	});

	it('creates the directory on demand when ensureExists is true', () => {
		const target = join(tempRoot, 'created');
		process.env[ENV_KEY] = target;
		expect(existsSync(target)).toBe(false);
		const resolved = resolveCacheRoot({ ensureExists: true });
		expect(resolved).toBe(target);
		expect(existsSync(target)).toBe(true);
	});

	it('does not create the directory when ensureExists is false', () => {
		const target = join(tempRoot, 'never-created');
		process.env[ENV_KEY] = target;
		expect(existsSync(target)).toBe(false);
		resolveCacheRoot({ ensureExists: false });
		expect(existsSync(target)).toBe(false);
	});
});
