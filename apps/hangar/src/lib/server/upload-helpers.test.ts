import { describe, expect, it } from 'vitest';
import { archiveFilename, destFilename, extensionOf, isNoChange, pickArchivesToPrune } from './upload-helpers';

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
});
