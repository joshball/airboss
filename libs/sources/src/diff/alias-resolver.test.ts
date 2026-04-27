import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetRegistry, withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type { AliasEntry, Edition, SourceEntry, SourceId } from '../types.ts';
import { resolveAliasOutcome } from './alias-resolver.ts';
import type { EditionPair } from './pair-walker.ts';

const ENTRY: SourceEntry = {
	id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
	corpus: 'regs',
	canonical_short: '§91.103',
	canonical_formal: '14 CFR § 91.103',
	canonical_title: 'Preflight action',
	last_amended_date: new Date('2027-01-01'),
	lifecycle: 'accepted',
};

const ED_2026: Edition = { id: '2026', published_date: new Date('2026-01-01'), source_url: 'https://x' };

function buildEd2027(aliases: readonly AliasEntry[]): Edition {
	return {
		id: '2027',
		published_date: new Date('2027-01-01'),
		source_url: 'https://x',
		aliases,
	};
}

const PAIR: EditionPair = {
	id: ENTRY.id,
	corpus: 'regs',
	oldEdition: '2026',
	newEdition: '2027',
};

beforeEach(() => {
	resetRegistry();
});

afterEach(() => {
	resetRegistry();
});

describe('resolveAliasOutcome', () => {
	it('returns null when no alias targets the pair', () => {
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026, buildEd2027([])]]]), () => {
				expect(resolveAliasOutcome(PAIR)).toBeNull();
			});
		});
	});

	it('classifies a silent alias', () => {
		const alias: AliasEntry = {
			from: ENTRY.id,
			to: 'airboss-ref:regs/cfr-14/91/103a' as SourceId,
			kind: 'silent',
		};
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026, buildEd2027([alias])]]]), () => {
				const outcome = resolveAliasOutcome(PAIR);
				expect(outcome?.kind).toBe('silent');
				expect(outcome?.to).toBe(alias.to);
			});
		});
	});

	it('classifies a content-change alias', () => {
		const alias: AliasEntry = {
			from: ENTRY.id,
			to: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
			kind: 'content-change',
		};
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026, buildEd2027([alias])]]]), () => {
				expect(resolveAliasOutcome(PAIR)?.kind).toBe('content-change');
			});
		});
	});

	it('classifies a cross-section alias', () => {
		const alias: AliasEntry = {
			from: ENTRY.id,
			to: 'airboss-ref:regs/cfr-14/61/103' as SourceId,
			kind: 'cross-section',
		};
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026, buildEd2027([alias])]]]), () => {
				expect(resolveAliasOutcome(PAIR)?.kind).toBe('cross-section');
			});
		});
	});

	it('classifies a split alias', () => {
		const alias: AliasEntry = {
			from: ENTRY.id,
			to: ['airboss-ref:regs/cfr-14/91/103a' as SourceId, 'airboss-ref:regs/cfr-14/91/103b' as SourceId],
			kind: 'split',
		};
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026, buildEd2027([alias])]]]), () => {
				const outcome = resolveAliasOutcome(PAIR);
				expect(outcome?.kind).toBe('split');
				expect(Array.isArray(outcome?.to)).toBe(true);
			});
		});
	});

	it('classifies a merge alias', () => {
		const alias: AliasEntry = {
			from: ENTRY.id,
			to: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
			kind: 'merge',
		};
		withTestEntries({ [ENTRY.id]: ENTRY }, () => {
			withTestEditions(new Map([[ENTRY.id, [ED_2026, buildEd2027([alias])]]]), () => {
				expect(resolveAliasOutcome(PAIR)?.kind).toBe('merge');
			});
		});
	});
});
