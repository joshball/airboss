import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { applyFixes, runFixCli } from './fix.ts';
import { resetRegistry } from './registry/__test_helpers__.ts';
import type { CorpusResolver } from './registry/corpus-resolver.ts';
import { registerCorpusResolver } from './registry/corpus-resolver.ts';
import type { RegistryReader } from './types.ts';

let workDir: string;

beforeEach(() => {
	resetRegistry();
	workDir = `${tmpdir()}/airboss-fix-${process.pid}-${Date.now()}-${Math.random()}`;
	mkdirSync(`${workDir}/course/regulations/sample`, { recursive: true });
});

afterEach(() => {
	rmSync(workDir, { recursive: true, force: true });
	resetRegistry();
});

function makeResolver(corpus: string, edition: string | null): CorpusResolver {
	return {
		corpus,
		parseLocator: (l) => ({ kind: 'ok', segments: l.split('/') }),
		formatCitation: (e) => e.canonical_short,
		getCurrentEdition: () => edition,
		getEditions: async () => [],
		getLiveUrl: () => null,
		getDerivativeContent: () => null,
		getIndexedContent: async () => null,
	};
}

function writeLesson(rel: string, body: string): string {
	const full = join(workDir, rel);
	mkdirSync(join(full, '..'), { recursive: true });
	writeFileSync(full, body, 'utf-8');
	return full;
}

function makeRegistry(currentAccepted: Record<string, string>): RegistryReader {
	return {
		hasEntry: () => false,
		getEntry: () => null,
		hasEdition: () => false,
		getEditionLifecycle: () => null,
		getCurrentAcceptedEdition: (corpus) => currentAccepted[corpus] ?? null,
		getEditionDistance: () => null,
		walkAliases: () => [],
		walkSupersessionChain: () => [],
		isCorpusKnown: () => true,
	};
}

describe('applyFixes', () => {
	test('F-01: stamps unpinned identifier with current accepted edition', () => {
		const file = writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\nSee [@cite](airboss-ref:regs/cfr-14/91/103) for the rule.\n`,
		);
		registerCorpusResolver(makeResolver('regs', '2026'));
		const report = applyFixes({ cwd: workDir, registry: makeRegistry({ regs: '2026' }) });
		expect(report.filesModified).toBe(1);
		expect(report.identifiersStamped).toBe(1);
		const newSource = readFileSync(file, 'utf-8');
		expect(newSource).toContain('airboss-ref:regs/cfr-14/91/103?at=2026');
	});

	test('F-02: leaves already-pinned identifier alone', () => {
		const file = writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\nSee [@cite](airboss-ref:regs/cfr-14/91/103?at=2025) for the rule.\n`,
		);
		const before = readFileSync(file, 'utf-8');
		const report = applyFixes({ cwd: workDir, registry: makeRegistry({ regs: '2026' }) });
		expect(report.filesModified).toBe(0);
		expect(readFileSync(file, 'utf-8')).toBe(before);
	});

	test('F-03: leaves slug-encoded edition alone (no ?at= but pinned via slug)', () => {
		// Note: parser would return pin === null for `airboss-ref:ac/61-65/j`
		// because there's no `?at=` query. The slug-encoded edition is the AC
		// revision letter `j`. The default no-op resolver returns null for
		// `getCurrentEdition('ac')`, so applyFixes leaves it alone. To exercise
		// this scenario explicitly we register a resolver that returns null.
		const file = writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\nSee [@cite](airboss-ref:ac/61-65/j) for the rule.\n`,
		);
		const before = readFileSync(file, 'utf-8');
		// No accepted edition for 'ac' -> applyFixes leaves it alone.
		const report = applyFixes({ cwd: workDir, registry: makeRegistry({}) });
		expect(report.filesModified).toBe(0);
		expect(readFileSync(file, 'utf-8')).toBe(before);
	});

	test('F-04: leaves unknown-corpus alone', () => {
		const file = writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\n[@cite](airboss-ref:unknown/some-future-thing)\n`,
		);
		const before = readFileSync(file, 'utf-8');
		const report = applyFixes({ cwd: workDir, registry: makeRegistry({ regs: '2026' }) });
		expect(report.filesModified).toBe(0);
		expect(readFileSync(file, 'utf-8')).toBe(before);
	});

	test('F-05: leaves malformed identifier alone', () => {
		const file = writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\n[@cite](airboss-ref:/regs/cfr-14/91/103?at=2026)\n`,
		);
		const before = readFileSync(file, 'utf-8');
		const report = applyFixes({ cwd: workDir, registry: makeRegistry({ regs: '2026' }) });
		expect(report.filesModified).toBe(0);
		expect(readFileSync(file, 'utf-8')).toBe(before);
	});

	test('F-06: skips identifier inside fenced code block', () => {
		const file = writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\n\`\`\`\nairboss-ref:regs/cfr-14/91/103\n\`\`\`\n`,
		);
		const before = readFileSync(file, 'utf-8');
		const report = applyFixes({ cwd: workDir, registry: makeRegistry({ regs: '2026' }) });
		expect(report.filesModified).toBe(0);
		expect(readFileSync(file, 'utf-8')).toBe(before);
	});

	test('F-07: stamps multiple unpinned identifiers in one file', () => {
		const file = writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\n[a](airboss-ref:regs/cfr-14/91/103)\n[b](airboss-ref:regs/cfr-14/91/107)\n[c](airboss-ref:regs/cfr-14/91/113)\n`,
		);
		registerCorpusResolver(makeResolver('regs', '2026'));
		const report = applyFixes({ cwd: workDir, registry: makeRegistry({ regs: '2026' }) });
		expect(report.identifiersStamped).toBe(3);
		const newSource = readFileSync(file, 'utf-8');
		expect(newSource).toContain('airboss-ref:regs/cfr-14/91/103?at=2026');
		expect(newSource).toContain('airboss-ref:regs/cfr-14/91/107?at=2026');
		expect(newSource).toContain('airboss-ref:regs/cfr-14/91/113?at=2026');
	});

	test('F-08: idempotent -- second run is a no-op', () => {
		writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\n[@cite](airboss-ref:regs/cfr-14/91/103)\n`,
		);
		registerCorpusResolver(makeResolver('regs', '2026'));
		const reg = makeRegistry({ regs: '2026' });
		const r1 = applyFixes({ cwd: workDir, registry: reg });
		expect(r1.filesModified).toBe(1);
		const r2 = applyFixes({ cwd: workDir, registry: reg });
		expect(r2.filesModified).toBe(0);
	});

	test('F-09: runFixCli refuses to run when CI=true', () => {
		const prev = process.env.CI;
		process.env.CI = 'true';
		try {
			const code = runFixCli({ cwd: workDir });
			expect(code).toBe(2);
		} finally {
			if (prev === undefined) delete process.env.CI;
			else process.env.CI = prev;
		}
	});

	test('F-10: applyFixes succeeds; second-pass validator finds 0 errors after stamping', () => {
		writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\n[@cite](airboss-ref:regs/cfr-14/91/103)\n`,
		);
		// A registry that knows the corpus, has the entry as accepted, and has
		// the 2026 edition. After the stamp, validator should be clean.
		const reg: RegistryReader = {
			hasEntry: (id) => id === ('airboss-ref:regs/cfr-14/91/103' as unknown),
			getEntry: (id) =>
				id === ('airboss-ref:regs/cfr-14/91/103?at=2026' as unknown) ||
				id === ('airboss-ref:regs/cfr-14/91/103' as unknown)
					? {
							id: id as never,
							corpus: 'regs',
							canonical_short: '§91.103',
							canonical_formal: '14 CFR § 91.103',
							canonical_title: 'Preflight action',
							last_amended_date: new Date('2026-01-01'),
							lifecycle: 'accepted',
						}
					: null,
			hasEdition: (_id, ed) => ed === '2026',
			getEditionLifecycle: () => 'accepted',
			getCurrentAcceptedEdition: (c) => (c === 'regs' ? '2026' : null),
			getEditionDistance: () => 0,
			walkAliases: () => [],
			walkSupersessionChain: () => [],
			isCorpusKnown: (c) => c === 'regs',
		};
		const report = applyFixes({ cwd: workDir, registry: reg });
		expect(report.identifiersStamped).toBe(1);
		expect(report.remainingErrors).toHaveLength(0);
	});

	test('F-11: bare URL form unpinned -- stamps in place', () => {
		const file = writeLesson(
			'course/regulations/sample/lesson.md',
			`---\ntitle: x\n---\n\nSee airboss-ref:regs/cfr-14/91/103 for the rule.\n`,
		);
		const report = applyFixes({ cwd: workDir, registry: makeRegistry({ regs: '2026' }) });
		expect(report.identifiersStamped).toBe(1);
		const newSource = readFileSync(file, 'utf-8');
		expect(newSource).toContain('airboss-ref:regs/cfr-14/91/103?at=2026');
	});

	test('runFixCli prints summary and returns 0 on success', () => {
		writeLesson('course/regulations/sample/empty.md', `---\ntitle: x\n---\n\nNo refs.\n`);
		const code = runFixCli({ cwd: workDir, registry: makeRegistry({ regs: '2026' }) });
		expect(code).toBe(0);
	});
});
