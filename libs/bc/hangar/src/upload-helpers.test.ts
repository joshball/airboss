import { describe, expect, it } from 'vitest';
import {
	archiveFilename,
	archiveFilenameWithChecksum,
	destFilename,
	extensionOf,
	isNoChange,
	pickArchivesToPrune,
	stageFilename,
} from './upload-helpers';

describe('extensionOf', () => {
	it('returns the trailing extension lowercased', () => {
		expect(extensionOf('doc.PDF')).toBe('pdf');
		expect(extensionOf('archive.tar.gz')).toBe('gz');
	});

	it('returns empty for dotfiles and extension-less names', () => {
		expect(extensionOf('.env')).toBe('');
		expect(extensionOf('Makefile')).toBe('');
	});

	it('returns empty when the name ends with a dot', () => {
		expect(extensionOf('a.')).toBe('');
	});

	it('rejects extensions that contain path separators or other unsafe chars', () => {
		// Closes chunk-6 security MIN: a filename like `x.foo/bar` would
		// otherwise produce extension `foo/bar` and `resolve()` would collapse
		// the destination into a real subdirectory under destDir.
		expect(extensionOf('x.foo/bar')).toBe('');
		expect(extensionOf('x.foo bar')).toBe('');
		expect(extensionOf('x.foo-bar')).toBe('');
		expect(extensionOf('x.foo.bar')).toBe('bar');
	});
});

describe('isNoChange', () => {
	it('is true only when both checksums are equal and non-empty', () => {
		expect(isNoChange('abc', 'abc')).toBe(true);
		expect(isNoChange('abc', 'def')).toBe(false);
		expect(isNoChange('', '')).toBe(false);
	});
});

describe('pickArchivesToPrune', () => {
	it('returns empty when under the keep threshold', () => {
		expect(pickArchivesToPrune(['cfr@2024.xml', 'cfr@2025.xml'], 3)).toEqual([]);
	});

	it('returns all but the newest `keep` sorted by version-lex order', () => {
		const archives = ['cfr@2023.xml', 'cfr@2025.xml', 'cfr@2024.xml', 'cfr@2026.xml'];
		expect(pickArchivesToPrune(archives, 2)).toEqual(['cfr@2023.xml', 'cfr@2024.xml']);
	});
});

describe('filename helpers', () => {
	it('archiveFilename uses the <id>@<version>.<ext> shape', () => {
		expect(archiveFilename('cfr-14', '2025', 'xml')).toBe('cfr-14@2025.xml');
	});
	it('destFilename uses the <id>.<ext> shape', () => {
		expect(destFilename('cfr-14', 'xml')).toBe('cfr-14.xml');
	});
	it('archiveFilenameWithChecksum disambiguates same-version uploads via prior sha prefix', () => {
		const sha = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
		expect(archiveFilenameWithChecksum('cfr-14', '2025', sha, 'xml')).toBe('cfr-14@2025-0123456789ab.xml');
	});
	it('archiveFilenameWithChecksum produces a different name from archiveFilename so collision is impossible', () => {
		const sha = 'aaaaaaaaaaaa1234567890';
		const versionOnly = archiveFilename('cfr-14', '2025', 'xml');
		const versionPlusSha = archiveFilenameWithChecksum('cfr-14', '2025', sha, 'xml');
		expect(versionOnly).not.toBe(versionPlusSha);
	});
	it('stageFilename uses the .uploading- shape so the upload-handler archive filter never matches it', () => {
		const name = stageFilename('cfr-14', 'xml', 'deadbeef');
		expect(name).toBe('cfr-14.xml.uploading-deadbeef');
		// The handler's prune step filters readdir results by `<id>@` prefix
		// and `.<ext>` suffix; this stage name does NOT start with `cfr-14@`,
		// so a stage file mid-upload cannot accidentally end up in the
		// archive-prune candidate set.
		expect(name.startsWith('cfr-14@')).toBe(false);
		expect(name.endsWith('.xml')).toBe(false);
	});
});
