import { afterEach, describe, expect, test } from 'vitest';
import {
	__git_laundering_internal__,
	getFilesChangedInHead,
	handbooksEditionAdvanceDetector,
	isSentinelLaunderingCandidate,
	registerEditionAdvanceDetector,
} from './git-laundering.ts';

afterEach(() => {
	__git_laundering_internal__.restoreDefaults();
});

describe('handbooksEditionAdvanceDetector', () => {
	test('GL-01: detects manifest.json change under handbooks/<doc>/', () => {
		const files = ['handbooks/phak/FAA-H-8083-25C/manifest.json', 'docs/foo.md'];
		expect(handbooksEditionAdvanceDetector(files, 'phak')).toBe(true);
	});

	test('GL-02: ignores manifest changes for a different doc slug', () => {
		const files = ['handbooks/afh/FAA-H-8083-3C/manifest.json'];
		expect(handbooksEditionAdvanceDetector(files, 'phak')).toBe(false);
	});

	test('GL-03: ignores non-manifest changes under the doc dir', () => {
		const files = ['handbooks/phak/FAA-H-8083-25C/12/some-section.md'];
		expect(handbooksEditionAdvanceDetector(files, 'phak')).toBe(false);
	});
});

describe('isSentinelLaunderingCandidate', () => {
	test('GL-04: returns true when both citing file and edition manifest were modified', () => {
		const files = ['course/knowledge/foo.md', 'handbooks/phak/FAA-H-8083-25C/manifest.json'];
		const result = isSentinelLaunderingCandidate('handbooks', 'phak', 'course/knowledge/foo.md', files);
		expect(result).toBe(true);
	});

	test('GL-05: returns false when citing file is unchanged', () => {
		const files = ['handbooks/phak/FAA-H-8083-25C/manifest.json'];
		const result = isSentinelLaunderingCandidate('handbooks', 'phak', 'course/knowledge/foo.md', files);
		expect(result).toBe(false);
	});

	test('GL-06: returns false when no edition advance for the slug', () => {
		const files = ['course/knowledge/foo.md', 'unrelated/file.md'];
		const result = isSentinelLaunderingCandidate('handbooks', 'phak', 'course/knowledge/foo.md', files);
		expect(result).toBe(false);
	});

	test('GL-07: returns false when corpus has no registered detector', () => {
		const result = isSentinelLaunderingCandidate('no-such-corpus', 'whatever', 'course/knowledge/foo.md', [
			'course/knowledge/foo.md',
		]);
		expect(result).toBe(false);
	});

	test('GL-08: registered custom detector picks up corpus-specific signals', () => {
		registerEditionAdvanceDetector('regs', (files, slug) =>
			files.some((f) => f === `regulations/${slug}/manifest.json`),
		);
		const files = ['course/knowledge/foo.md', 'regulations/cfr-14/manifest.json'];
		expect(isSentinelLaunderingCandidate('regs', 'cfr-14', 'course/knowledge/foo.md', files)).toBe(true);
	});
});

describe('getFilesChangedInHead', () => {
	test('GL-09: returns an array (smoke test; real git invocation depends on env)', () => {
		const result = getFilesChangedInHead(process.cwd());
		expect(Array.isArray(result)).toBe(true);
	});
});
