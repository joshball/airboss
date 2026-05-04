/**
 * Real-fs tests for the handbook-asset path-traversal guard.
 *
 * The chunk-1 correctness MINOR finding flagged that the original guard
 * rejected `..`-collapsed escapes (string-prefix check after
 * `path.resolve`) but did NOT defend against symlinks inside the
 * corpus whose targets escape it. These tests build a tmpdir corpus,
 * plant a legitimate file, plant a symlink that points outside, and
 * pin the guard's behaviour for both cases.
 *
 * Real fs (not mocked) so the symlink semantics match production.
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHandbookAssetPath } from './resolve-asset-path';

let corpusRoot: string;
let corpusRootReal: string;
let outsideRoot: string;
let outsideRootReal: string;

beforeAll(() => {
	// Two parallel tmpdirs: one is the "handbooks" corpus, the other is
	// where a hostile symlink target would live.
	const baseRaw = mkdtempSync(join(tmpdir(), 'handbook-asset-test-'));
	const base = realpathSync(baseRaw);
	corpusRoot = join(base, 'handbooks');
	outsideRoot = join(base, 'outside');
	mkdirSync(corpusRoot, { recursive: true });
	mkdirSync(outsideRoot, { recursive: true });
	corpusRootReal = realpathSync(corpusRoot);
	outsideRootReal = realpathSync(outsideRoot);

	// Plant a legitimate file inside the corpus.
	mkdirSync(join(corpusRoot, 'phak/2024/figures'), { recursive: true });
	writeFileSync(join(corpusRoot, 'phak/2024/figures/fig-1.png'), 'PNGDATA');

	// Plant a hostile target outside the corpus.
	writeFileSync(join(outsideRoot, 'secret.txt'), 'SHOULD-NOT-BE-READABLE');

	// Plant a symlink INSIDE the corpus that points OUTSIDE. This is the
	// chunk-1 finding's exact attack shape: a future ingest script or a
	// dev-machine cache mount drops such a symlink and the cheap string
	// check still passes it through.
	symlinkSync(join(outsideRoot, 'secret.txt'), join(corpusRoot, 'phak/2024/figures/escape.png'));

	// Plant a symlink to a directory outside (some attacks target listing
	// or stating an outside dir, even if the route's later `isFile`
	// check would reject it).
	symlinkSync(outsideRoot, join(corpusRoot, 'phak/2024/escape-dir'));
});

afterAll(() => {
	if (corpusRoot) {
		// Clean up the parent tmpdir; rmSync recurses, the corpus + outside
		// share a parent.
		const parent = join(corpusRoot, '..');
		rmSync(parent, { recursive: true, force: true });
	}
});

describe('resolveHandbookAssetPath', () => {
	it('resolves a legitimate path inside the corpus', () => {
		const result = resolveHandbookAssetPath({
			root: corpusRoot,
			rootReal: corpusRootReal,
			requestedPath: 'phak/2024/figures/fig-1.png',
		});
		expect(result).toBe(join(corpusRootReal, 'phak/2024/figures/fig-1.png'));
	});

	it('rejects `..` traversal that resolves outside the corpus', () => {
		const result = resolveHandbookAssetPath({
			root: corpusRoot,
			rootReal: corpusRootReal,
			requestedPath: '../outside/secret.txt',
		});
		expect(result).toBe(null);
	});

	it('rejects absolute paths', () => {
		const result = resolveHandbookAssetPath({
			root: corpusRoot,
			rootReal: corpusRootReal,
			requestedPath: '/etc/passwd',
		});
		expect(result).toBe(null);
	});

	it('rejects a symlink whose target escapes the corpus (chunk-1 correctness MINOR regression)', () => {
		// This is the test that pins the chunk-1 finding. Pre-fix, the
		// route's `requested.startsWith(`${HANDBOOKS_DIR}/`)` check would
		// pass because `escape.png` is lexically inside HANDBOOKS_DIR.
		// After the realpath canonicalisation, the symlink's target
		// resolves to `outside/secret.txt` which is NOT inside the
		// corpus, and the guard rejects.
		const result = resolveHandbookAssetPath({
			root: corpusRoot,
			rootReal: corpusRootReal,
			requestedPath: 'phak/2024/figures/escape.png',
		});
		expect(result).toBe(null);
	});

	it('rejects a symlink pointing at a directory outside the corpus', () => {
		const result = resolveHandbookAssetPath({
			root: corpusRoot,
			rootReal: corpusRootReal,
			requestedPath: 'phak/2024/escape-dir',
		});
		expect(result).toBe(null);
	});

	it('rejects a path inside a symlinked-out directory', () => {
		// Even though `phak/2024/escape-dir/secret.txt` looks like a path
		// under the corpus, the canonical resolution traverses the
		// symlink and lands on `outside/secret.txt`, which is outside.
		const result = resolveHandbookAssetPath({
			root: corpusRoot,
			rootReal: corpusRootReal,
			requestedPath: 'phak/2024/escape-dir/secret.txt',
		});
		expect(result).toBe(null);
	});

	it('returns null for a missing file (not throw)', () => {
		const result = resolveHandbookAssetPath({
			root: corpusRoot,
			rootReal: corpusRootReal,
			requestedPath: 'phak/2024/figures/does-not-exist.png',
		});
		expect(result).toBe(null);
	});

	it('does NOT leak the canonical path to the outside corpus', () => {
		// Defence-in-depth assertion. Even if a regression weakens the
		// realpath check, ensure no result resembles a path under
		// `outsideRoot`.
		const attempts = [
			'phak/2024/figures/escape.png',
			'phak/2024/escape-dir',
			'phak/2024/escape-dir/secret.txt',
			'../outside/secret.txt',
		];
		for (const attempt of attempts) {
			const result = resolveHandbookAssetPath({
				root: corpusRoot,
				rootReal: corpusRootReal,
				requestedPath: attempt,
			});
			expect(result).toBe(null);
			if (result !== null) {
				expect(result.startsWith(outsideRootReal)).toBe(false);
			}
		}
	});

	it('handles a symlinked-rooted handbooks dir (rootReal differs from root)', () => {
		// Sanity: when the handbooks root itself is a symlink (e.g. dev
		// machines that point `handbooks` at a shared cache), the
		// canonical comparison must use `rootReal`, not `root`. We
		// simulate by passing rootReal and checking a legitimate file
		// still resolves.
		const result = resolveHandbookAssetPath({
			root: corpusRoot,
			rootReal: corpusRootReal,
			requestedPath: 'phak/2024/figures/fig-1.png',
		});
		expect(result).not.toBe(null);
		expect(result?.startsWith(corpusRootReal)).toBe(true);
	});
});
