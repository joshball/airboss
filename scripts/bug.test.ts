/**
 * Tests for the Phase 6 bug-tracker surface.
 *
 * Covers:
 *   - bug-loader validates frontmatter (clean files, schema failures,
 *     id/filename mismatch, missing frontmatter).
 *   - generateBugsIndex groups by product + severity, includes only open
 *     bugs, renders the empty case.
 *   - The CLI surface is exercised end-to-end via spawnSync (`bun run bug`)
 *     against a temp repo: list filters, show, new scaffolds, set mutates.
 *
 * Each CLI test mints its own `tmpdir/airboss-bug-test-*` with a synthetic
 * `package.json` (name: airboss) so the loader's repo-root walker resolves
 * to the temp dir, and a `docs/bugs/` subtree the dispatcher mutates.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { BUG_DIR } from '@ab/constants';
import type { Bug, BugFrontmatter } from '@ab/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadAllBugs, loadBugFromFile } from './lib/bug-loader';
import { generateBugsIndex } from './tracking/generate-bugs-index';

const REPO_ROOT = resolve(import.meta.dir, '..');
const BUG_CLI = resolve(REPO_ROOT, 'scripts', 'bug.ts');

interface TempRepo {
	root: string;
	bugsDir: string;
}

function createTempRepo(): TempRepo {
	const root = mkdtempSync(join(tmpdir(), 'airboss-bug-test-'));
	mkdirSync(join(root, BUG_DIR), { recursive: true });
	writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'airboss', private: true }));
	return { root, bugsDir: join(root, BUG_DIR) };
}

function destroyTempRepo(repo: TempRepo): void {
	rmSync(repo.root, { recursive: true, force: true });
}

function writeBug(repo: TempRepo, slug: string, frontmatter: string, body = ''): string {
	const filename = `${slug}.md`;
	const path = join(repo.bugsDir, filename);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `---\n${frontmatter}\n---\n\n${body}`);
	return path;
}

const VALID_FRONTMATTER = `id: bug-sample-finding
title: Sample finding for tests
product: study
severity: minor
status: open
discovered_pr: null
discovered_date: 2026-05-07
fix_pr: null
fix_wp: null
tags: []`;

function frontmatter(fm: BugFrontmatter): Bug {
	return {
		id: fm.id,
		bugPath: `/synthetic/${fm.id}.md`,
		frontmatter: fm,
		rawFrontmatter: fm as unknown as Record<string, unknown>,
		validation_errors: [],
	};
}

describe('bug-loader', () => {
	let repo: TempRepo;
	beforeEach(() => {
		repo = createTempRepo();
	});
	afterEach(() => {
		destroyTempRepo(repo);
	});

	it('parses a clean bug file with no validation errors', () => {
		const path = writeBug(repo, 'bug-sample-finding', VALID_FRONTMATTER);
		const bug = loadBugFromFile(path, 'bug-sample-finding');
		expect(bug.validation_errors).toEqual([]);
		expect(bug.frontmatter).not.toBeNull();
		expect(bug.frontmatter?.title).toBe('Sample finding for tests');
		expect(bug.frontmatter?.severity).toBe('minor');
		expect(bug.frontmatter?.tags).toEqual([]);
	});

	it('flags a missing frontmatter fence', () => {
		const path = join(repo.bugsDir, 'bug-no-fence.md');
		writeFileSync(path, '# bug body, no fence\n');
		const bug = loadBugFromFile(path, 'bug-no-fence');
		expect(bug.frontmatter).toBeNull();
		expect(bug.validation_errors.length).toBeGreaterThan(0);
		const found = bug.validation_errors.some((e) => e.field === '<frontmatter>');
		expect(found).toBe(true);
	});

	it('flags an id that disagrees with the filename', () => {
		const path = writeBug(
			repo,
			'bug-real-id',
			VALID_FRONTMATTER.replace('id: bug-sample-finding', 'id: bug-different-id'),
		);
		const bug = loadBugFromFile(path, 'bug-real-id');
		const idError = bug.validation_errors.find((e) => e.field === 'id');
		expect(idError).toBeDefined();
		expect(idError?.message).toMatch(/does not match filename/);
	});

	it('flags an invalid severity', () => {
		const path = writeBug(repo, 'bug-bad-severity', VALID_FRONTMATTER.replace('severity: minor', 'severity: critical'));
		const bug = loadBugFromFile(path, 'bug-bad-severity');
		expect(bug.frontmatter).toBeNull();
		const sev = bug.validation_errors.find((e) => e.field === 'severity');
		expect(sev).toBeDefined();
	});

	it('loadAllBugs walks docs/bugs and skips non-bug files', () => {
		writeBug(repo, 'bug-one', VALID_FRONTMATTER.replace('id: bug-sample-finding', 'id: bug-one'));
		writeBug(repo, 'bug-two', VALID_FRONTMATTER.replace('id: bug-sample-finding', 'id: bug-two'));
		writeFileSync(join(repo.bugsDir, 'INDEX.md'), '# Bugs index\n');
		writeFileSync(join(repo.bugsDir, 'README.md'), '# Bugs readme\n');
		const all = loadAllBugs(repo.root);
		expect(all.map((b) => b.id).sort()).toEqual(['bug-one', 'bug-two']);
	});
});

describe('generateBugsIndex', () => {
	const open = (id: string, product: BugFrontmatter['product'], severity: BugFrontmatter['severity']): Bug =>
		frontmatter({
			id,
			title: `Title for ${id}`,
			product,
			severity,
			status: 'open',
			discovered_pr: null,
			discovered_date: '2026-05-07',
			fix_pr: null,
			fix_wp: null,
			tags: [],
		});

	const fixed = (id: string): Bug =>
		frontmatter({
			id,
			title: `Closed ${id}`,
			product: 'study',
			severity: 'minor',
			status: 'fixed',
			discovered_pr: null,
			discovered_date: '2026-05-07',
			fix_pr: 1,
			fix_wp: null,
			tags: [],
		});

	it('renders the empty case', () => {
		const md = generateBugsIndex([]);
		expect(md).toMatch(/0 open bugs of 0 total/);
		expect(md).toMatch(/_No open bugs._/);
	});

	it('groups by product and severity, ignoring closed bugs', () => {
		const bugs: Bug[] = [
			open('bug-a', 'study', 'major'),
			open('bug-b', 'study', 'minor'),
			open('bug-c', 'hangar', 'blocking'),
			fixed('bug-d'),
		];
		const md = generateBugsIndex(bugs);
		expect(md).toMatch(/3 open bugs of 4 total/);
		expect(md).toMatch(/### Study \(open: 2\)/);
		expect(md).toMatch(/### Hangar \(open: 1\)/);
		expect(md).toMatch(/#### Major/);
		expect(md).toMatch(/#### Minor/);
		expect(md).toMatch(/#### Blocking/);
		expect(md).toMatch(/\[bug-a\]\(bug-a.md\)/);
		expect(md).not.toMatch(/bug-d/);
	});
});

interface CliResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

function runCli(repo: TempRepo, args: readonly string[]): CliResult {
	const proc = spawnSync('bun', [BUG_CLI, ...args], {
		cwd: repo.root,
		encoding: 'utf8',
		env: { ...process.env },
	});
	return {
		exitCode: proc.status ?? 99,
		stdout: proc.stdout ?? '',
		stderr: proc.stderr ?? '',
	};
}

describe('bun run bug CLI', () => {
	let repo: TempRepo;
	beforeEach(() => {
		repo = createTempRepo();
		// Seed three bugs covering products and statuses.
		writeBug(
			repo,
			'bug-alpha',
			`id: bug-alpha
title: Alpha bug
product: study
severity: major
status: open
discovered_pr: 100
discovered_date: 2026-05-07
fix_pr: null
fix_wp: null
tags: [citations]`,
			'# Alpha bug body',
		);
		writeBug(
			repo,
			'bug-beta',
			`id: bug-beta
title: Beta bug
product: hangar
severity: minor
status: fixed
discovered_pr: null
discovered_date: 2026-05-07
fix_pr: 200
fix_wp: null
tags: []`,
			'# Beta bug body',
		);
		writeBug(
			repo,
			'bug-gamma',
			`id: bug-gamma
title: Gamma bug
product: study
severity: nit
status: open
discovered_pr: null
discovered_date: 2026-05-07
fix_pr: null
fix_wp: null
tags: []`,
			'# Gamma bug body',
		);
	});
	afterEach(() => {
		destroyTempRepo(repo);
	});

	it('list with no filters prints all bugs', () => {
		const r = runCli(repo, ['list']);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toMatch(/bug-alpha/);
		expect(r.stdout).toMatch(/bug-beta/);
		expect(r.stdout).toMatch(/bug-gamma/);
		expect(r.stdout).toMatch(/Total: 3/);
	});

	it('list filters compose with AND (--product study --status open)', () => {
		const r = runCli(repo, ['list', '--product', 'study', '--status', 'open']);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toMatch(/bug-alpha/);
		expect(r.stdout).toMatch(/bug-gamma/);
		expect(r.stdout).not.toMatch(/bug-beta/);
		expect(r.stdout).toMatch(/Total: 2/);
	});

	it('list rejects an invalid filter value', () => {
		const r = runCli(repo, ['list', '--severity', 'enormous']);
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toMatch(/invalid severity/);
	});

	it('show renders the body', () => {
		const r = runCli(repo, ['show', 'bug-alpha']);
		expect(r.exitCode).toBe(0);
		expect(r.stdout).toMatch(/Alpha bug body/);
		expect(r.stdout).toMatch(/title: Alpha bug/);
	});

	it('show on an unknown id exits non-zero', () => {
		const r = runCli(repo, ['show', 'bug-does-not-exist']);
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toMatch(/no bug found/);
	});

	it('new scaffolds a fresh bug with placeholder frontmatter', () => {
		const r = runCli(repo, ['new', 'fresh-issue', '--title', 'Fresh issue', '--product', 'sim', '--severity', 'major']);
		expect(r.exitCode).toBe(0);
		const path = join(repo.bugsDir, 'bug-fresh-issue.md');
		const body = readFileSync(path, 'utf8');
		expect(body).toMatch(/id: bug-fresh-issue/);
		expect(body).toMatch(/title: Fresh issue/);
		expect(body).toMatch(/product: sim/);
		expect(body).toMatch(/severity: major/);
		expect(body).toMatch(/status: open/);
	});

	it('new accepts a slug already prefixed with bug-', () => {
		const r = runCli(repo, ['new', 'bug-pre-prefixed']);
		expect(r.exitCode).toBe(0);
		const body = readFileSync(join(repo.bugsDir, 'bug-pre-prefixed.md'), 'utf8');
		expect(body).toMatch(/id: bug-pre-prefixed/);
	});

	it('set mutates a whitelisted field', () => {
		const r = runCli(repo, ['set', 'bug-alpha', 'status', 'fixed']);
		expect(r.exitCode).toBe(0);
		const after = readFileSync(join(repo.bugsDir, 'bug-alpha.md'), 'utf8');
		expect(after).toMatch(/status: fixed/);
		// Original body preserved.
		expect(after).toMatch(/Alpha bug body/);
	});

	it('set rejects a non-whitelisted field', () => {
		const r = runCli(repo, ['set', 'bug-alpha', 'title', 'New title']);
		expect(r.exitCode).not.toBe(0);
		expect(r.stderr).toMatch(/not in the mutation whitelist/);
	});

	it('set fix_pr accepts an integer or null', () => {
		const r1 = runCli(repo, ['set', 'bug-alpha', 'fix_pr', '321']);
		expect(r1.exitCode).toBe(0);
		const after = readFileSync(join(repo.bugsDir, 'bug-alpha.md'), 'utf8');
		expect(after).toMatch(/fix_pr: 321/);

		const r2 = runCli(repo, ['set', 'bug-alpha', 'fix_pr', 'null']);
		expect(r2.exitCode).toBe(0);
		const after2 = readFileSync(join(repo.bugsDir, 'bug-alpha.md'), 'utf8');
		expect(after2).toMatch(/fix_pr: null/);
	});

	it('set tags accepts a JSON array', () => {
		const r = runCli(repo, ['set', 'bug-alpha', 'tags', '["a","b"]']);
		expect(r.exitCode).toBe(0);
		const after = readFileSync(join(repo.bugsDir, 'bug-alpha.md'), 'utf8');
		expect(after).toMatch(/tags: \["a", "b"\]/);
	});

	it('index command writes docs/bugs/INDEX.md', () => {
		const r = runCli(repo, ['index']);
		expect(r.exitCode).toBe(0);
		const indexBody = readFileSync(join(repo.bugsDir, 'INDEX.md'), 'utf8');
		expect(indexBody).toMatch(/2 open bugs of 3 total/);
		expect(indexBody).toMatch(/bug-alpha/);
		expect(indexBody).toMatch(/bug-gamma/);
		expect(indexBody).not.toMatch(/bug-beta/);
	});
});
