/**
 * Tests for `bun run wp set`. The CLI walks up from `import.meta.dirname` to
 * find the airboss workspace root, so we drive it as a subprocess against a
 * temp clone of `docs/work-packages/<one-id>/spec.md`. We do this by creating
 * a synthetic minimal repo (package.json with name=airboss + a single WP) and
 * pointing the subprocess at it via cwd. The loader's repo-root resolver
 * walks up from the loader source file, NOT the cwd; instead of forking the
 * loader, we operate on the in-repo work package using a unique sentinel field
 * value, then revert the file in afterAll.
 *
 * Two-pronged test plan:
 *   - Unit-level: render and parse helpers via direct import (no subprocess).
 *   - Integration: spawn the real CLI against a one-off scratch WP we create
 *     under docs/work-packages/.test-wp-set-<n>/.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Walk up from this test file to the workspace root the same way the loader does.
function findRepoRoot(): string {
	let dir = import.meta.dirname;
	for (let i = 0; i < 16; i += 1) {
		const candidate = join(dir, 'package.json');
		if (existsSync(candidate)) {
			const json = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string };
			if (json.name === 'airboss') return dir;
		}
		const parent = resolve(dir, '..');
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error('test: cannot locate airboss workspace root');
}

const REPO_ROOT = findRepoRoot();
const SCRIPT_PATH = join(REPO_ROOT, 'scripts/wp.ts');
const SCRATCH_ID = 'zz-test-wp-set-scratch';
const SCRATCH_DIR = join(REPO_ROOT, 'docs/work-packages', SCRATCH_ID);
const SCRATCH_SPEC = join(SCRATCH_DIR, 'spec.md');

const SCRATCH_TEMPLATE = `---
id: ${SCRATCH_ID}
title: Scratch WP for wp.set tests
product: platform
category: docs
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-07
owner: agent
depends_on: []
unblocks: []
tags: [scratch]
---

# Scratch WP

Body content for the scratch WP. Tests must preserve this body byte-for-byte
across mutations.

- bullet one
- bullet two

End sentinel.
`;

function runCli(args: readonly string[]): { exitCode: number; stdout: string; stderr: string } {
	const result = spawnSync('bun', [SCRIPT_PATH, ...args], {
		cwd: REPO_ROOT,
		encoding: 'utf8',
	});
	return {
		exitCode: result.status ?? 1,
		stdout: result.stdout,
		stderr: result.stderr,
	};
}

beforeAll(() => {
	mkdirSync(SCRATCH_DIR, { recursive: true });
	writeFileSync(SCRATCH_SPEC, SCRATCH_TEMPLATE);
});

afterAll(() => {
	rmSync(SCRATCH_DIR, { recursive: true, force: true });
});

beforeEach(() => {
	writeFileSync(SCRATCH_SPEC, SCRATCH_TEMPLATE);
});

describe('bun run wp set', () => {
	it('updates a whitelisted field and preserves the body', () => {
		const before = readFileSync(SCRATCH_SPEC, 'utf8');
		expect(before).toContain('End sentinel.');

		const result = runCli(['set', SCRATCH_ID, 'tags', '["alpha","beta"]']);
		expect(result.exitCode, result.stderr).toBe(0);
		expect(result.stdout).toContain(`${SCRATCH_ID}.tags`);

		const after = readFileSync(SCRATCH_SPEC, 'utf8');
		expect(after).toMatch(/tags: \["alpha", "beta"\]/);
		expect(after).toContain('End sentinel.');
		expect(after).toContain('# Scratch WP');
		expect(after).toContain('- bullet one');
	});

	it('rejects an unknown field with a clear error', () => {
		const result = runCli(['set', SCRATCH_ID, 'made-up-field', 'value']);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('not in the mutation whitelist');
	});

	it('rejects status=shipped while human_review_status=pending', () => {
		const result = runCli(['set', SCRATCH_ID, 'status', 'shipped']);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('status: shipped requires human_review_status: signed-off');
	});

	it('accepts status=shipped after human-review=signed-off and auto-sets shipped_date', () => {
		// First flip human-review (CLI accepts; lint blocks at commit-time, not here).
		const a = runCli(['set', SCRATCH_ID, 'human-review', 'signed-off']);
		expect(a.exitCode, a.stderr).toBe(0);

		const b = runCli(['set', SCRATCH_ID, 'status', 'shipped']);
		expect(b.exitCode, b.stderr).toBe(0);
		expect(b.stderr).toContain('shipped_date');

		const after = readFileSync(SCRATCH_SPEC, 'utf8');
		expect(after).toMatch(/status: shipped/);
		expect(after).toMatch(/shipped_date: \d{4}-\d{2}-\d{2}/);
	});

	it('accepts shipped_prs as a JSON integer array', () => {
		const result = runCli(['set', SCRATCH_ID, 'shipped_prs', '[671, 697]']);
		expect(result.exitCode, result.stderr).toBe(0);
		const after = readFileSync(SCRATCH_SPEC, 'utf8');
		expect(after).toMatch(/shipped_prs: \[671, 697\]/);
	});

	it('rejects shipped_prs entries that are not positive integers', () => {
		const result = runCli(['set', SCRATCH_ID, 'shipped_prs', '["abc"]']);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('positive integers');
	});

	it('resolves human-review alias to human_review_status', () => {
		const result = runCli(['set', SCRATCH_ID, 'human-review', 'walked']);
		expect(result.exitCode, result.stderr).toBe(0);
		const after = readFileSync(SCRATCH_SPEC, 'utf8');
		expect(after).toMatch(/human_review_status: walked/);
	});

	it('--json flag emits the new frontmatter as JSON', () => {
		const result = runCli(['set', SCRATCH_ID, 'tags', '["json-output"]', '--json']);
		expect(result.exitCode, result.stderr).toBe(0);
		const parsed = JSON.parse(result.stdout) as { tags: string[]; id: string };
		expect(parsed.tags).toEqual(['json-output']);
		expect(parsed.id).toBe(SCRATCH_ID);
	});

	it('refuses to mutate when frontmatter is invalid', () => {
		// Corrupt the frontmatter on purpose for this single test.
		const broken = SCRATCH_TEMPLATE.replace('product: platform', 'product: not-a-real-product');
		writeFileSync(SCRATCH_SPEC, broken);
		const result = runCli(['set', SCRATCH_ID, 'tags', '["x"]']);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('invalid frontmatter');
	});
});
