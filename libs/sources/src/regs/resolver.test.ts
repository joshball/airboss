import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry, withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { REGS_RESOLVER, setRegsDerivativeRoot } from './resolver.ts';

const ENTRY_91_103: SourceEntry = {
	id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
	corpus: 'regs',
	canonical_short: '§91.103',
	canonical_formal: '14 CFR § 91.103',
	canonical_title: 'Preflight action',
	last_amended_date: new Date('2008-09-05'),
	lifecycle: 'accepted',
};

const EDITION_2026: Edition = {
	id: '2026',
	published_date: new Date('2026-01-01'),
	source_url: 'https://www.ecfr.gov/current/title-14/part-91/section-91.103',
};

const EDITION_2024: Edition = {
	id: '2024',
	published_date: new Date('2024-01-01'),
	source_url: 'https://www.ecfr.gov/on/2024-01-01/title-14/part-91/section-91.103',
};

let tmpRoot: string;

beforeEach(() => {
	tmpRoot = mkdtempSync(join(tmpdir(), 'cfr-resolver-'));
	setRegsDerivativeRoot(tmpRoot);
});

afterEach(() => {
	setRegsDerivativeRoot(join(process.cwd(), 'regulations'));
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
});

describe('REGS_RESOLVER', () => {
	it('parseLocator delegates to parseRegsLocator', () => {
		const result = REGS_RESOLVER.parseLocator('cfr-14/91/103');
		expect(result.kind).toBe('ok');
	});

	it('formatCitation returns the right field per style', () => {
		expect(REGS_RESOLVER.formatCitation(ENTRY_91_103, 'short')).toBe('§91.103');
		expect(REGS_RESOLVER.formatCitation(ENTRY_91_103, 'formal')).toBe('14 CFR § 91.103');
		expect(REGS_RESOLVER.formatCitation(ENTRY_91_103, 'title')).toBe('Preflight action');
	});

	it('getCurrentEdition returns the most recent edition slug', () => {
		withTestEntries({ [ENTRY_91_103.id]: ENTRY_91_103 }, () => {
			withTestEditions(new Map([[ENTRY_91_103.id, [EDITION_2024, EDITION_2026]]]), () => {
				expect(REGS_RESOLVER.getCurrentEdition()).toBe('2026');
			});
		});
	});

	it('getCurrentEdition returns null when no entries are loaded', () => {
		expect(REGS_RESOLVER.getCurrentEdition()).toBeNull();
	});

	it('getEditions returns the chronological list', async () => {
		await withTestEditions(new Map([[ENTRY_91_103.id, [EDITION_2024, EDITION_2026]]]), async () => {
			const editions = await REGS_RESOLVER.getEditions(ENTRY_91_103.id);
			expect(editions.map((e) => e.id)).toEqual(['2024', '2026']);
		});
	});

	it('getLiveUrl produces /current/ for the current edition', () => {
		withTestEntries({ [ENTRY_91_103.id]: ENTRY_91_103 }, () => {
			withTestEditions(new Map([[ENTRY_91_103.id, [EDITION_2026]]]), () => {
				expect(REGS_RESOLVER.getLiveUrl(ENTRY_91_103.id, '2026')).toBe(
					'https://www.ecfr.gov/current/title-14/part-91/section-91.103',
				);
			});
		});
	});

	it('getLiveUrl produces /on/<date>/ for past editions', () => {
		withTestEntries({ [ENTRY_91_103.id]: ENTRY_91_103 }, () => {
			withTestEditions(new Map([[ENTRY_91_103.id, [EDITION_2024, EDITION_2026]]]), () => {
				expect(REGS_RESOLVER.getLiveUrl(ENTRY_91_103.id, '2024')).toBe(
					'https://www.ecfr.gov/on/2024-01-01/title-14/part-91/section-91.103',
				);
			});
		});
	});

	it('getDerivativeContent reads the section markdown', () => {
		const editionDir = join(tmpRoot, 'cfr-14/2026-01-01/91');
		mkdirSync(editionDir, { recursive: true });
		writeFileSync(join(editionDir, '91-103.md'), '# §91.103 Preflight action\n\nbody\n');

		withTestEntries({ [ENTRY_91_103.id]: ENTRY_91_103 }, () => {
			withTestEditions(new Map([[ENTRY_91_103.id, [EDITION_2026]]]), () => {
				const content = REGS_RESOLVER.getDerivativeContent(ENTRY_91_103.id, '2026');
				expect(content).toBe('# §91.103 Preflight action\n\nbody\n');
			});
		});
	});

	it('getDerivativeContent returns null when the file is missing', () => {
		withTestEntries({ [ENTRY_91_103.id]: ENTRY_91_103 }, () => {
			withTestEditions(new Map([[ENTRY_91_103.id, [EDITION_2026]]]), () => {
				expect(REGS_RESOLVER.getDerivativeContent(ENTRY_91_103.id, '2026')).toBeNull();
			});
		});
	});

	it('getIndexedContent returns the section record', async () => {
		const editionDir = join(tmpRoot, 'cfr-14/2026-01-01');
		mkdirSync(join(editionDir, '91'), { recursive: true });
		writeFileSync(join(editionDir, '91/91-103.md'), 'body content');
		writeFileSync(
			join(editionDir, 'sections.json'),
			JSON.stringify({
				schemaVersion: 1,
				edition: '2026',
				sectionsByPart: {
					'91': [
						{
							id: 'airboss-ref:regs/cfr-14/91/103',
							canonical_short: '§91.103',
							canonical_title: 'Preflight action',
							last_amended_date: '2008-09-05',
							body_path: '91/91-103.md',
							body_sha256: 'deadbeef',
						},
					],
				},
			}),
		);

		await withTestEditions(new Map([[ENTRY_91_103.id, [EDITION_2026]]]), async () => {
			const content = await REGS_RESOLVER.getIndexedContent(ENTRY_91_103.id, '2026');
			expect(content).not.toBeNull();
			expect(content?.id).toBe(ENTRY_91_103.id);
			expect(content?.edition).toBe('2026');
			expect(content?.normalizedText).toBe('body content');
		});
	});
});
