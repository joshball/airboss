/**
 * Tests for the rolling archive planner. We exercise `planArchive` against a
 * synthetic git repo created in tmp, since the planner reads `git log -1` for
 * each file. Touching `last commit date` requires real commits.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planArchive } from './archive';

let tempRoot: string;

function gitInit(root: string): void {
	const cmd = (...args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
	cmd('init', '-q', '-b', 'main');
	cmd('config', 'user.email', 'test@example.com');
	cmd('config', 'user.name', 'Test');
	cmd('config', 'commit.gpgsign', 'false');
}

function commitFile(root: string, relPath: string, content: string, dateIso: string): void {
	const abs = join(root, relPath);
	mkdirSync(join(root, relPath, '..'), { recursive: true });
	writeFileSync(abs, content);
	const env = {
		...process.env,
		GIT_AUTHOR_DATE: `${dateIso}T12:00:00Z`,
		GIT_COMMITTER_DATE: `${dateIso}T12:00:00Z`,
	};
	const cmd = (...args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8', env });
	cmd('add', relPath);
	cmd('commit', '-q', '-m', `add ${relPath}`);
}

beforeEach(() => {
	tempRoot = mkdtempSync(join(tmpdir(), 'airboss-archive-'));
	gitInit(tempRoot);
});

afterEach(() => {
	rmSync(tempRoot, { recursive: true, force: true });
});

describe('planArchive', () => {
	it('returns empty when no files exist', () => {
		const out = planArchive(tempRoot, 60);
		expect(out).toEqual([]);
	});

	it('archives files older than threshold', () => {
		commitFile(tempRoot, 'docs/work/handoffs/old.md', '# old', '2025-01-01');
		commitFile(tempRoot, 'docs/work/handoffs/new.md', '# new', '2026-05-08');

		const now = new Date('2026-05-08T12:00:00Z');
		const out = planArchive(tempRoot, 60, now);

		expect(out).toHaveLength(1);
		expect(out[0].src).toContain('old.md');
		expect(out[0].dest).toContain('docs/.archive/handoffs/2025/old.md');
		expect(out[0].lastCommitDate).toBe('2025-01-01');
	});

	it('preserves files newer than threshold', () => {
		commitFile(tempRoot, 'docs/work/reviews/recent.md', '# recent', '2026-04-01');

		const now = new Date('2026-05-08T12:00:00Z');
		const out = planArchive(tempRoot, 60, now);

		expect(out).toEqual([]);
	});

	it('skips _template.md and INDEX.md and README.md', () => {
		commitFile(tempRoot, 'docs/work/walkthroughs/_template.md', '# template', '2025-01-01');
		commitFile(tempRoot, 'docs/work/walkthroughs/INDEX.md', '# index', '2025-01-01');
		commitFile(tempRoot, 'docs/work/walkthroughs/README.md', '# readme', '2025-01-01');
		commitFile(tempRoot, 'docs/work/walkthroughs/old-walk.md', '# old', '2025-01-01');

		const now = new Date('2026-05-08T12:00:00Z');
		const out = planArchive(tempRoot, 60, now);

		expect(out).toHaveLength(1);
		expect(out[0].src).toContain('old-walk.md');
	});

	it('descends one level into subdirs (e.g. dated walkthroughs)', () => {
		commitFile(tempRoot, 'docs/work/walkthroughs/20250101/notes.md', '# notes', '2025-01-01');

		const now = new Date('2026-05-08T12:00:00Z');
		const out = planArchive(tempRoot, 60, now);

		expect(out).toHaveLength(1);
		expect(out[0].src).toContain('20250101/notes.md');
		expect(out[0].dest).toContain('docs/.archive/walkthroughs/2025/20250101/notes.md');
	});

	it('routes year subdirectory based on last commit date', () => {
		commitFile(tempRoot, 'docs/work/handoffs/x.md', '# x', '2024-06-15');

		const now = new Date('2026-05-08T12:00:00Z');
		const out = planArchive(tempRoot, 60, now);

		expect(out[0].dest).toContain('/.archive/handoffs/2024/x.md');
	});

	it('honors a custom days threshold', () => {
		commitFile(tempRoot, 'docs/work/handoffs/x.md', '# x', '2026-04-15');

		const now = new Date('2026-05-08T12:00:00Z');
		// 23 days old; default 60 keeps it
		expect(planArchive(tempRoot, 60, now)).toEqual([]);
		// 14 days threshold archives it
		const aggressive = planArchive(tempRoot, 14, now);
		expect(aggressive).toHaveLength(1);
	});
});
