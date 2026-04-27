import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry, withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { latestEditionPair, latestTwoEditionsForCorpus, walkEditionPairs } from './pair-walker.ts';

const ENTRY_A: SourceEntry = {
	id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
	corpus: 'regs',
	canonical_short: '§91.103',
	canonical_formal: '14 CFR § 91.103',
	canonical_title: 'Preflight action',
	last_amended_date: new Date('2026-01-01'),
	lifecycle: 'accepted',
};

const ENTRY_B: SourceEntry = {
	id: 'airboss-ref:regs/cfr-14/61/3' as SourceId,
	corpus: 'regs',
	canonical_short: '§61.3',
	canonical_formal: '14 CFR § 61.3',
	canonical_title: 'Requirement',
	last_amended_date: new Date('2026-01-01'),
	lifecycle: 'accepted',
};

const ENTRY_C: SourceEntry = {
	id: 'airboss-ref:handbooks/phak/3' as SourceId,
	corpus: 'handbooks',
	canonical_short: 'PHAK ch.3',
	canonical_formal: 'PHAK Chapter 3',
	canonical_title: 'Aerodynamics',
	last_amended_date: new Date('2026-01-01'),
	lifecycle: 'accepted',
};

const ED_2025: Edition = { id: '2025', published_date: new Date('2025-01-01'), source_url: 'https://x' };
const ED_2026: Edition = { id: '2026', published_date: new Date('2026-01-01'), source_url: 'https://x' };
const ED_2027: Edition = { id: '2027', published_date: new Date('2027-01-01'), source_url: 'https://x' };

beforeEach(() => {
	resetRegistry();
});

afterEach(() => {
	resetRegistry();
});

describe('walkEditionPairs', () => {
	it('returns empty list when registry has no entries', () => {
		expect(walkEditionPairs('regs')).toEqual([]);
	});

	it('skips entries with only one edition', () => {
		withTestEntries({ [ENTRY_A.id]: ENTRY_A }, () => {
			withTestEditions(new Map([[ENTRY_A.id, [ED_2026]]]), () => {
				expect(walkEditionPairs('regs')).toEqual([]);
			});
		});
	});

	it('emits one pair for two-edition entries', () => {
		withTestEntries({ [ENTRY_A.id]: ENTRY_A }, () => {
			withTestEditions(new Map([[ENTRY_A.id, [ED_2026, ED_2027]]]), () => {
				const pairs = walkEditionPairs('regs');
				expect(pairs).toHaveLength(1);
				expect(pairs[0]?.id).toBe(ENTRY_A.id);
				expect(pairs[0]?.oldEdition).toBe('2026');
				expect(pairs[0]?.newEdition).toBe('2027');
			});
		});
	});

	it('emits cumulative pairs for three-edition entries', () => {
		withTestEntries({ [ENTRY_A.id]: ENTRY_A }, () => {
			withTestEditions(new Map([[ENTRY_A.id, [ED_2025, ED_2026, ED_2027]]]), () => {
				const pairs = walkEditionPairs('regs');
				expect(pairs).toHaveLength(3);
				const slugs = pairs.map((p) => `${p.oldEdition}->${p.newEdition}`);
				expect(slugs).toContain('2025->2026');
				expect(slugs).toContain('2026->2027');
				expect(slugs).toContain('2025->2027');
			});
		});
	});

	it('respects corpus filter', () => {
		withTestEntries({ [ENTRY_A.id]: ENTRY_A, [ENTRY_C.id]: ENTRY_C }, () => {
			withTestEditions(
				new Map<SourceId, readonly Edition[]>([
					[ENTRY_A.id, [ED_2026, ED_2027]],
					[ENTRY_C.id, [ED_2026, ED_2027]],
				]),
				() => {
					expect(walkEditionPairs('regs')).toHaveLength(1);
					expect(walkEditionPairs('handbooks')).toHaveLength(1);
				},
			);
		});
	});

	it('emits one pair per entry across multiple entries', () => {
		withTestEntries({ [ENTRY_A.id]: ENTRY_A, [ENTRY_B.id]: ENTRY_B }, () => {
			withTestEditions(
				new Map<SourceId, readonly Edition[]>([
					[ENTRY_A.id, [ED_2026, ED_2027]],
					[ENTRY_B.id, [ED_2026, ED_2027]],
				]),
				() => {
					expect(walkEditionPairs('regs')).toHaveLength(2);
				},
			);
		});
	});
});

describe('latestEditionPair', () => {
	it('returns null when no entry has two editions', () => {
		withTestEntries({ [ENTRY_A.id]: ENTRY_A }, () => {
			withTestEditions(new Map([[ENTRY_A.id, [ED_2026]]]), () => {
				expect(latestEditionPair('regs')).toBeNull();
			});
		});
	});

	it('returns the latest pair across the corpus', () => {
		withTestEntries({ [ENTRY_A.id]: ENTRY_A }, () => {
			withTestEditions(new Map([[ENTRY_A.id, [ED_2025, ED_2026, ED_2027]]]), () => {
				const pair = latestEditionPair('regs');
				expect(pair?.newEdition).toBe('2027');
				expect(pair?.oldEdition).toBe('2026');
			});
		});
	});
});

describe('latestTwoEditionsForCorpus', () => {
	it('returns null when corpus has fewer than two distinct editions', () => {
		withTestEntries({ [ENTRY_A.id]: ENTRY_A }, () => {
			withTestEditions(new Map([[ENTRY_A.id, [ED_2026]]]), () => {
				expect(latestTwoEditionsForCorpus('regs')).toBeNull();
			});
		});
	});

	it('returns the two most-recent edition slugs', () => {
		withTestEntries({ [ENTRY_A.id]: ENTRY_A }, () => {
			withTestEditions(new Map([[ENTRY_A.id, [ED_2025, ED_2026, ED_2027]]]), () => {
				const result = latestTwoEditionsForCorpus('regs');
				expect(result).toEqual({ old: '2026', new: '2027' });
			});
		});
	});
});
