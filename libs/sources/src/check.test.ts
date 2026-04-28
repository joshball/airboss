import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { LESSON_CONTENT_PATHS, validateReferences } from './check.ts';

let workDir: string;

beforeAll(() => {
	workDir = `${tmpdir()}/airboss-sources-check-${process.pid}-${Date.now()}`;
	mkdirSync(`${workDir}/course/regulations/sample`, { recursive: true });
});

afterAll(() => {
	rmSync(workDir, { recursive: true, force: true });
});

function writeLesson(relPath: string, body: string): void {
	const full = join(workDir, relPath);
	mkdirSync(join(full, '..'), { recursive: true });
	writeFileSync(full, body, 'utf-8');
}

describe('validateReferences (integration)', () => {
	test('C-01: empty corpus -> 0 findings', () => {
		writeLesson('course/regulations/sample/empty.md', `---\ntitle: x\n---\n\nNo references here.\n`);
		const report = validateReferences({ cwd: workDir });
		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toHaveLength(0);
		expect(report.identifiersFound).toBe(0);
	});

	test('C-02: lesson with one ERROR identifier -> errors > 0', () => {
		writeLesson(
			'course/regulations/sample/with-unknown.md',
			`---\ntitle: x\n---\n\n[@cite](airboss-ref:unknown/some-future-thing)\n`,
		);
		const report = validateReferences({ cwd: workDir });
		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.find((f) => f.ruleId === 0)).toBeDefined();
	});

	test('C-03: lesson with WARNING + NOTICE only -> 0 errors', () => {
		// Clean the directory so previous tests' files don't bleed in.
		rmSync(`${workDir}/course/regulations`, { recursive: true, force: true });
		mkdirSync(`${workDir}/course/regulations/sample`, { recursive: true });
		// Write a lesson whose only finding is a NOTICE (bare URL) by using
		// the special unknown: prefix... but unknown: is ERROR. Use a custom
		// fixture registry via opts.registry to absorb the entry-not-found
		// error and leave only the bare-URL NOTICE.
		writeLesson(
			'course/regulations/sample/notice-only.md',
			`---\ntitle: x\n---\n\nSee airboss-ref:regs/cfr-14/91/103?at=2026 inline.\n`,
		);
		const report = validateReferences({
			cwd: workDir,
			registry: {
				hasEntry: () => true,
				getEntry: (id) => ({
					id,
					corpus: 'regs',
					canonical_short: '§91.103',
					canonical_formal: '14 CFR § 91.103',
					canonical_title: 'Preflight action',
					last_amended_date: new Date('2026-01-01'),
					lifecycle: 'accepted',
				}),
				hasEdition: () => true,
				getEditionLifecycle: () => 'accepted',
				getCurrentAcceptedEdition: () => '2026',
				getEditionDistance: () => 0,
				walkAliases: () => [],
				walkSupersessionChain: () => [],
				isCorpusKnown: () => true,
			},
		});
		const errors = report.findings.filter((f) => f.severity === 'error');
		const notices = report.findings.filter((f) => f.severity === 'notice');
		expect(errors).toHaveLength(0);
		expect(notices.length).toBeGreaterThan(0);
	});

	test('C-04: real `course/regulations` walk in the repo -> 0 ERROR findings', () => {
		const report = validateReferences();
		// Phase 9 migrated three lesson links to `airboss-ref:regs/...` URIs;
		// every migrated identifier resolves cleanly via the bootstrap-loaded
		// regs registry, so the validator finds identifiers but produces zero
		// ERRORs.
		const errors = report.findings.filter((f) => f.severity === 'error');
		expect(errors).toHaveLength(0);
	});
});

describe('LESSON_CONTENT_PATHS', () => {
	test('exposes the path list as a constant for future expansion', () => {
		expect(LESSON_CONTENT_PATHS).toContain('course/regulations');
	});
});
