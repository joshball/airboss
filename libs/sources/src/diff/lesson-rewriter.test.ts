import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { RewriterError, runRewrite } from './lesson-rewriter.ts';
import type { EditionPair } from './pair-walker.ts';
import type { DiffOutcome, DiffOutcomeKind, DiffReport } from './types.ts';

let tmpRoot: string;
let lessonRoot: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'lesson-rewriter-'));
	lessonRoot = join(tmpRoot, 'course/regulations');
	mkdirSync(lessonRoot, { recursive: true });
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
});

function buildOutcome(id: SourceId, kind: DiffOutcomeKind): DiffOutcome {
	const pair: EditionPair = { id, corpus: 'regs', oldEdition: '2026', newEdition: '2027' };
	return { pair, kind, oldHash: 'a', newHash: kind === 'auto-advance' ? 'a' : 'b' };
}

function buildReport(outcomes: readonly DiffOutcome[]): DiffReport {
	return {
		schemaVersion: 1,
		corpus: 'regs',
		editionPair: { old: '2026', new: '2027' },
		generatedAt: new Date().toISOString(),
		counts: {
			'auto-advance': 0,
			'needs-review': 0,
			'alias-silent': 0,
			'alias-content': 0,
			'alias-cross': 0,
			'alias-split': 0,
			'alias-merge': 0,
			'missing-old': 0,
			'missing-new': 0,
		},
		outcomes,
	};
}

describe('runRewrite', () => {
	it('rewrites a single occurrence whose pin matches the report old', () => {
		const lesson = join(lessonRoot, 'lesson-a.md');
		const url = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		writeFileSync(lesson, `---\ntitle: Test\n---\n\nSee [@cite](${url}) for preflight action.\n`);
		const report = buildReport([buildOutcome('airboss-ref:regs/cfr-14/91/103' as SourceId, 'auto-advance')]);
		const result = runRewrite(report, { cwd: tmpRoot, skipGitCheck: true });
		expect(result.filesRewritten).toBe(1);
		expect(result.occurrencesAdvanced).toBe(1);
		expect(readFileSync(lesson, 'utf-8')).toContain('?at=2027');
		expect(readFileSync(lesson, 'utf-8')).not.toContain('?at=2026');
	});

	it('does not rewrite occurrences whose pin does not match the report old', () => {
		const lesson = join(lessonRoot, 'lesson-b.md');
		const url = 'airboss-ref:regs/cfr-14/91/103?at=2024';
		writeFileSync(lesson, `---\ntitle: Test\n---\n\n[@cite](${url}).\n`);
		const report = buildReport([buildOutcome('airboss-ref:regs/cfr-14/91/103' as SourceId, 'auto-advance')]);
		const result = runRewrite(report, { cwd: tmpRoot, skipGitCheck: true });
		expect(result.filesRewritten).toBe(0);
	});

	it('handles multiple matching occurrences in one file', () => {
		const lesson = join(lessonRoot, 'lesson-c.md');
		const url = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		writeFileSync(lesson, `---\ntitle: Test\n---\n\nFirst [@cite](${url}).\n\nSecond [@cite](${url}).\n`);
		const report = buildReport([buildOutcome('airboss-ref:regs/cfr-14/91/103' as SourceId, 'auto-advance')]);
		const result = runRewrite(report, { cwd: tmpRoot, skipGitCheck: true });
		expect(result.filesRewritten).toBe(1);
		expect(result.occurrencesAdvanced).toBe(2);
	});

	it('is idempotent', () => {
		const lesson = join(lessonRoot, 'lesson-d.md');
		const url = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		writeFileSync(lesson, `[@cite](${url}).\n`);
		const report = buildReport([buildOutcome('airboss-ref:regs/cfr-14/91/103' as SourceId, 'auto-advance')]);
		const first = runRewrite(report, { cwd: tmpRoot, skipGitCheck: true });
		expect(first.filesRewritten).toBe(1);
		const second = runRewrite(report, { cwd: tmpRoot, skipGitCheck: true });
		expect(second.filesRewritten).toBe(0);
	});

	it('does not rewrite needs-review outcomes', () => {
		const lesson = join(lessonRoot, 'lesson-e.md');
		const url = 'airboss-ref:regs/cfr-14/91/1?at=2026';
		writeFileSync(lesson, `[@cite](${url}).\n`);
		const report = buildReport([buildOutcome('airboss-ref:regs/cfr-14/91/1' as SourceId, 'needs-review')]);
		const result = runRewrite(report, { cwd: tmpRoot, skipGitCheck: true });
		expect(result.filesRewritten).toBe(0);
	});

	it('rewrites alias-silent outcomes to the new id', () => {
		const lesson = join(lessonRoot, 'lesson-f.md');
		const url = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		writeFileSync(lesson, `[@cite](${url}).\n`);
		const outcome: DiffOutcome = {
			pair: {
				id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
				corpus: 'regs',
				oldEdition: '2026',
				newEdition: '2027',
			},
			kind: 'alias-silent',
			oldHash: null,
			newHash: null,
			aliasTo: 'airboss-ref:regs/cfr-14/91/103a' as SourceId,
		};
		const report = buildReport([outcome]);
		const result = runRewrite(report, { cwd: tmpRoot, skipGitCheck: true });
		expect(result.filesRewritten).toBe(1);
		const after = readFileSync(lesson, 'utf-8');
		expect(after).toContain('airboss-ref:regs/cfr-14/91/103a?at=2027');
		expect(after).not.toContain('airboss-ref:regs/cfr-14/91/103?at=2026');
	});

	it('reports zero rewrites for an empty report', () => {
		const lesson = join(lessonRoot, 'lesson-g.md');
		const url = 'airboss-ref:regs/cfr-14/91/103?at=2026';
		writeFileSync(lesson, `[@cite](${url}).\n`);
		const report = buildReport([]);
		const result = runRewrite(report, { cwd: tmpRoot, skipGitCheck: true });
		expect(result.filesRewritten).toBe(0);
	});

	it('refuses to run when git tree is dirty', () => {
		const { execSync } = require('node:child_process');
		// Initialize a git repo so the git status check has a tree to inspect.
		execSync('git init -q', { cwd: tmpRoot });
		execSync('git config user.email t@t.t', { cwd: tmpRoot });
		execSync('git config user.name t', { cwd: tmpRoot });
		// Untracked file is enough to make `git status --porcelain` non-empty.
		writeFileSync(join(lessonRoot, 'lesson-dirty.md'), `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026).\n`);
		const report = buildReport([buildOutcome('airboss-ref:regs/cfr-14/91/103' as SourceId, 'auto-advance')]);
		expect(() => runRewrite(report, { cwd: tmpRoot, skipGitCheck: false })).toThrow(RewriterError);
	});
});
