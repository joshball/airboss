/**
 * Path-traversal + symlink defence tests for `GET /handbook-asset/[...path]`.
 *
 * Pins three guards on the streamer:
 *
 * 1. Lexical-prefix rejection -- `../` segments that escape the corpus throw
 *    404 before any fs syscall runs.
 * 2. Real, in-tree files stream successfully -- regression guard so the
 *    canonicalization step doesn't inadvertently reject the happy path.
 * 3. Symlink escape rejection -- a symlink dropped inside `handbooks/` that
 *    points outside the corpus must be rejected on the canonical-prefix
 *    re-check (chunk-1 correctness MINOR closed by this commit).
 *
 * Real fs throughout: the symlink test creates an actual symlink under
 * `handbooks/.test-symlink-defence/` pointing at a real file in `os.tmpdir`,
 * exercises the endpoint against it, and tears the artifacts down in
 * `afterAll`. No mocks; the goal is to pin the on-disk behavior the review
 * called out.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHttpError } from '@sveltejs/kit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET } from './+server';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..');
const HANDBOOKS_DIR = resolve(REPO_ROOT, 'handbooks');

// Drop the test symlink + scratch fixture under a clearly-named subtree so
// a partial run can't pollute the actual corpus. Cleaned up in `afterAll`.
const SCRATCH_SUBDIR = '.test-symlink-defence';
const SCRATCH_DIR = join(HANDBOOKS_DIR, SCRATCH_SUBDIR);
const SYMLINK_NAME = 'escape.txt';
const SYMLINK_PATH = join(SCRATCH_DIR, SYMLINK_NAME);
const SYMLINK_REL = `${SCRATCH_SUBDIR}/${SYMLINK_NAME}`;

let externalTmpDir: string;
let externalTargetPath: string;

beforeAll(() => {
	// Real file outside the corpus; the symlink will point at it.
	externalTmpDir = mkdtempSync(join(tmpdir(), 'handbook-asset-escape-'));
	externalTargetPath = join(externalTmpDir, 'secret.txt');
	writeFileSync(externalTargetPath, 'should-never-be-readable-via-handbook-asset', 'utf8');

	mkdirSync(SCRATCH_DIR, { recursive: true });
	// Best-effort symlink creation. Some sandboxes / CI matrices disallow
	// symlinks; the symlink-defence test guards on existence and skips if
	// the platform refused to create one rather than throwing here.
	try {
		symlinkSync(externalTargetPath, SYMLINK_PATH);
	} catch {
		// fall through; the test below detects the missing fixture and skips
	}
});

afterAll(() => {
	rmSync(SCRATCH_DIR, { recursive: true, force: true });
	rmSync(externalTmpDir, { recursive: true, force: true });
});

interface FakeEvent {
	params: { path: string };
}

function makeEvent(path: string): FakeEvent {
	return { params: { path } };
}

function isHttp404(value: unknown): value is { status: 404 } {
	return isHttpError(value) && value.status === 404;
}

describe('GET /handbook-asset/[...path]', () => {
	it('rejects ../ traversal that escapes the corpus root with 404', async () => {
		// `path.resolve(HANDBOOKS_DIR, '../etc/passwd')` collapses to
		// `<repoRoot>/etc/passwd`, which fails the lexical-prefix check.
		await expect(
			(async () => {
				// `GET` is a SvelteKit RequestHandler; the only field it reads
				// from the event is `params.path`. The cast keeps the test
				// minimal without dragging in the full RequestEvent shape.
				await GET(makeEvent('../package.json') as unknown as Parameters<typeof GET>[0]);
			})(),
		).rejects.toSatisfy(isHttp404);
	});

	it('rejects an absolute /etc/passwd attempt with 404', async () => {
		// `path.resolve(HANDBOOKS_DIR, '/etc/passwd')` returns `/etc/passwd`,
		// which fails the lexical-prefix check before any fs work.
		await expect(
			(async () => {
				await GET(makeEvent('/etc/passwd') as unknown as Parameters<typeof GET>[0]);
			})(),
		).rejects.toSatisfy(isHttp404);
	});

	it('rejects a symlink inside handbooks/ that points outside the corpus with 404', async () => {
		// Skip if the platform refused to create the symlink in beforeAll.
		const { existsSync } = await import('node:fs');
		if (!existsSync(SYMLINK_PATH)) {
			// CI / sandbox without symlink permission; the route's defence is
			// untestable on this platform but the lexical guard above still
			// pins the primary case.
			return;
		}

		// existsSync follows symlinks, so the lexical check passes; only the
		// realpath re-check can catch the escape. This pins the chunk-1
		// correctness MINOR fix.
		await expect(
			(async () => {
				await GET(makeEvent(SYMLINK_REL) as unknown as Parameters<typeof GET>[0]);
			})(),
		).rejects.toSatisfy(isHttp404);
	});

	it('serves a real in-tree handbook file with 200 (regression guard on the realpath path)', async () => {
		// Plant a tiny .png inside the scratch subtree so the test owns its
		// fixture and doesn't depend on which figures the local checkout has.
		// The real corpus uses the same content type via the same code path.
		const inTreeFile = join(SCRATCH_DIR, 'tiny.png');
		// 1x1 transparent PNG (78 bytes)
		const pngBytes = Buffer.from(
			'89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6300010000000500010d0a2db40000000049454e44ae426082',
			'hex',
		);
		writeFileSync(inTreeFile, pngBytes);
		try {
			const response = await GET(makeEvent(`${SCRATCH_SUBDIR}/tiny.png`) as unknown as Parameters<typeof GET>[0]);
			expect(response.status).toBe(200);
			expect(response.headers.get('Content-Type')).toBe('image/png');
			// Drain the body before the finally-block unlinks the file. The
			// response wraps a `createReadStream` that reads asynchronously;
			// removing the file mid-read raises ENOENT in vitest's unhandled-
			// error tracker. `arrayBuffer()` consumes the stream synchronously
			// from the test's perspective and ties the read to a real assertion.
			const bytes = new Uint8Array(await response.arrayBuffer());
			expect(bytes.length).toBe(pngBytes.length);
		} finally {
			rmSync(inTreeFile, { force: true });
		}
	});
});
