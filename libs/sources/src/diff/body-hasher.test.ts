import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry, withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { clearBodyHashCache, hashEditionBody, readNormalizedBody } from './body-hasher.ts';

const ENTRY: SourceEntry = {
	id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
	corpus: 'regs',
	canonical_short: '§91.103',
	canonical_formal: '14 CFR § 91.103',
	canonical_title: 'Preflight action',
	last_amended_date: new Date('2026-01-01'),
	lifecycle: 'accepted',
};

const ED_2026: Edition = { id: '2026', published_date: new Date('2026-01-01'), source_url: 'https://x' };
const ED_2027: Edition = { id: '2027', published_date: new Date('2027-01-01'), source_url: 'https://x' };

let tmpRoot: string;

beforeEach(() => {
	resetRegistry();
	clearBodyHashCache();
	tmpRoot = mkdtempSync(join(tmpdir(), 'body-hasher-'));
});

afterEach(() => {
	rmSync(tmpRoot, { recursive: true, force: true });
	resetRegistry();
	clearBodyHashCache();
});

function writeBody(edition: '2026-01-01' | '2027-01-01', content: string): void {
	const dir = join(tmpRoot, 'cfr-14', edition, '91');
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, '91-103.md'), content);
}

describe('hashEditionBody', () => {
	it('returns null when the file is missing', () => {
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026]]]), () => {
				expect(hashEditionBody(ENTRY.id, '2026', { outRoot: tmpRoot })).toBeNull();
			});
		});
	});

	it('returns equal hashes for byte-identical bodies', () => {
		writeBody('2026-01-01', '# §91.103 Preflight action\n\nEach pilot in command...\n');
		writeBody('2027-01-01', '# §91.103 Preflight action\n\nEach pilot in command...\n');
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026, ED_2027]]]), () => {
				const h1 = hashEditionBody(ENTRY.id, '2026', { outRoot: tmpRoot });
				const h2 = hashEditionBody(ENTRY.id, '2027', { outRoot: tmpRoot });
				expect(h1).not.toBeNull();
				expect(h1).toBe(h2);
			});
		});
	});

	it('returns equal hashes for CRLF vs LF', () => {
		writeBody('2026-01-01', '# §91.103 Preflight action\n\nEach pilot in command...\n');
		writeBody('2027-01-01', '# §91.103 Preflight action\r\n\r\nEach pilot in command...\r\n');
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026, ED_2027]]]), () => {
				const h1 = hashEditionBody(ENTRY.id, '2026', { outRoot: tmpRoot });
				const h2 = hashEditionBody(ENTRY.id, '2027', { outRoot: tmpRoot });
				expect(h1).toBe(h2);
			});
		});
	});

	it('returns different hashes for content change', () => {
		writeBody('2026-01-01', '# §91.103 Preflight action\n\nOriginal text.\n');
		writeBody('2027-01-01', '# §91.103 Preflight action\n\nAmended text 2027.\n');
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026, ED_2027]]]), () => {
				const h1 = hashEditionBody(ENTRY.id, '2026', { outRoot: tmpRoot });
				const h2 = hashEditionBody(ENTRY.id, '2027', { outRoot: tmpRoot });
				expect(h1).not.toBe(h2);
			});
		});
	});

	it('caches by (id, edition, outRoot)', () => {
		writeBody('2026-01-01', '# §91.103 Preflight action\n\nBody.\n');
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026]]]), () => {
				const first = hashEditionBody(ENTRY.id, '2026', { outRoot: tmpRoot });
				// Modify file; cache must hold the original hash.
				writeBody('2026-01-01', '# §91.103 Preflight action\n\nDIFFERENT.\n');
				const second = hashEditionBody(ENTRY.id, '2026', { outRoot: tmpRoot });
				expect(second).toBe(first);
				clearBodyHashCache();
				const third = hashEditionBody(ENTRY.id, '2026', { outRoot: tmpRoot });
				expect(third).not.toBe(first);
			});
		});
	});
});

describe('readNormalizedBody', () => {
	it('reads body without the heading', () => {
		writeBody('2026-01-01', '# §91.103 Preflight action\n\nBody text here.\n');
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026]]]), () => {
				const body = readNormalizedBody(ENTRY.id, '2026', { outRoot: tmpRoot });
				expect(body).toBe('Body text here.');
			});
		});
	});

	it('returns null when the file is missing', () => {
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026]]]), () => {
				expect(readNormalizedBody(ENTRY.id, '2026', { outRoot: tmpRoot })).toBeNull();
			});
		});
	});
});
