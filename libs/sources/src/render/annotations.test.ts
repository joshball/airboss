import { describe, expect, it } from 'vitest';
import type { LessonAcknowledgment, SourceEntry, SourceId } from '../types.ts';
import { computeAnnotation, findMatchingAcks } from './annotations.ts';

function makeEntry(overrides: Partial<SourceEntry> & Pick<SourceEntry, 'id'>): SourceEntry {
	return {
		corpus: overrides.corpus ?? 'regs',
		canonical_short: overrides.canonical_short ?? '§91.103',
		canonical_formal: overrides.canonical_formal ?? '14 CFR § 91.103',
		canonical_title: overrides.canonical_title ?? 'Preflight action',
		last_amended_date: overrides.last_amended_date ?? new Date('2009-08-21'),
		alternative_names: overrides.alternative_names,
		supersedes: overrides.supersedes,
		superseded_by: overrides.superseded_by,
		lifecycle: overrides.lifecycle ?? 'accepted',
		id: overrides.id,
	};
}

const ENTRY = makeEntry({ id: 'airboss-ref:regs/cfr-14/91/103' as SourceId });
const NULL_WALK = (): readonly SourceEntry[] => [];

describe('computeAnnotation', () => {
	it('returns none when there are no acks and no supersession', () => {
		const out = computeAnnotation({
			entry: ENTRY,
			chain: [ENTRY],
			matchingAcks: [],
			historicalLens: false,
			walkChain: NULL_WALK,
		});
		expect(out).toEqual({ kind: 'none', text: '' });
	});

	it('returns historical when ack has historical: true', () => {
		const ack: LessonAcknowledgment = {
			target: ENTRY.id,
			historical: true,
			note: 'context',
		};
		const out = computeAnnotation({
			entry: ENTRY,
			chain: [ENTRY],
			matchingAcks: [ack],
			historicalLens: false,
			walkChain: NULL_WALK,
		});
		expect(out.kind).toBe('historical');
		expect(out.text).toBe('(historical reference)');
		expect(out.note).toBe('context');
	});

	it('returns historical when historical_lens is true and no per-target ack', () => {
		const out = computeAnnotation({
			entry: ENTRY,
			chain: [ENTRY],
			matchingAcks: [],
			historicalLens: true,
			walkChain: NULL_WALK,
		});
		expect(out.kind).toBe('historical');
	});

	it('per-target ack with historical: false overrides lesson-level historical_lens', () => {
		const target = makeEntry({ id: 'airboss-ref:interp/walker-2017' as SourceId });
		const superseder = makeEntry({
			id: 'airboss-ref:interp/smith-2030' as SourceId,
			canonical_short: 'Smith (2030)',
		});
		const ack: LessonAcknowledgment = {
			target: target.id,
			superseder: superseder.id,
			historical: false,
			reason: 'original-intact',
		};
		const out = computeAnnotation({
			entry: target,
			chain: [target, superseder],
			matchingAcks: [ack],
			historicalLens: true,
			walkChain: () => [superseder],
		});
		// historical_lens: true is OVERRIDDEN by the per-target ack with
		// historical: false; we expect the covered branch instead.
		expect(out.kind).toBe('covered');
	});

	it('returns covered when ack superseder matches chain end', () => {
		const target = makeEntry({ id: 'airboss-ref:interp/walker-2017' as SourceId });
		const superseder = makeEntry({
			id: 'airboss-ref:interp/smith-2030' as SourceId,
			canonical_short: 'Smith (2030)',
		});
		const ack: LessonAcknowledgment = {
			target: target.id,
			superseder: superseder.id,
			historical: false,
			reason: 'original-intact',
			note: 'narrows the active-investigation standard',
		};
		const out = computeAnnotation({
			entry: target,
			chain: [target, superseder],
			matchingAcks: [ack],
			historicalLens: false,
			walkChain: (id) => (id === superseder.id ? [superseder] : []),
		});
		expect(out.kind).toBe('covered');
		expect(out.text).toBe('(acknowledged Smith (2030) supersession; original-intact)');
		expect(out.note).toBe('narrows the active-investigation standard');
	});

	it('returns chain-advanced when chain has advanced past ack superseder', () => {
		const target = makeEntry({ id: 'airboss-ref:interp/walker-2017' as SourceId });
		const superseder = makeEntry({
			id: 'airboss-ref:interp/smith-2030' as SourceId,
			canonical_short: 'Smith (2030)',
		});
		const newSuperseder = makeEntry({
			id: 'airboss-ref:interp/jones-2032' as SourceId,
			canonical_short: 'Jones (2032)',
		});
		const ack: LessonAcknowledgment = {
			target: target.id,
			superseder: superseder.id,
			historical: false,
		};
		const out = computeAnnotation({
			entry: target,
			chain: [target, superseder, newSuperseder],
			matchingAcks: [ack],
			historicalLens: false,
			walkChain: (id) => (id === superseder.id ? [superseder, newSuperseder] : []),
		});
		expect(out.kind).toBe('chain-advanced');
		expect(out.text).toBe('(ack chain advanced; please re-validate)');
	});

	it('returns cross-corpus when chain crosses corpora and no acks present', () => {
		const original = makeEntry({
			id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
			corpus: 'regs',
		});
		const successor = makeEntry({
			id: 'airboss-ref:icao/annex-6/4-3-1' as SourceId,
			corpus: 'icao',
			canonical_short: '4.3.1',
		});
		const out = computeAnnotation({
			entry: original,
			chain: [original, successor],
			matchingAcks: [],
			historicalLens: false,
			walkChain: NULL_WALK,
		});
		expect(out.kind).toBe('cross-corpus');
		expect(out.text).toContain('(via 4.3.1 in icao)');
	});

	it('returns none when chain is single-corpus and no acks (validator handles row 13)', () => {
		const original = makeEntry({ id: 'airboss-ref:regs/cfr-14/91/103' as SourceId });
		const successor = makeEntry({
			id: 'airboss-ref:regs/cfr-14/91/103-new' as SourceId,
		});
		const out = computeAnnotation({
			entry: original,
			chain: [original, successor],
			matchingAcks: [],
			historicalLens: false,
			walkChain: NULL_WALK,
		});
		expect(out.kind).toBe('none');
	});

	it('emits covered without reason when ack omits it', () => {
		const target = makeEntry({ id: 'airboss-ref:interp/walker-2017' as SourceId });
		const superseder = makeEntry({
			id: 'airboss-ref:interp/smith-2030' as SourceId,
			canonical_short: 'Smith (2030)',
		});
		const ack: LessonAcknowledgment = {
			target: target.id,
			superseder: superseder.id,
			historical: false,
		};
		const out = computeAnnotation({
			entry: target,
			chain: [target, superseder],
			matchingAcks: [ack],
			historicalLens: false,
			walkChain: () => [superseder],
		});
		expect(out.text).toBe('(acknowledged Smith (2030) supersession)');
	});
});

describe('findMatchingAcks', () => {
	const ackA: LessonAcknowledgment = {
		id: 'walker-cost-sharing',
		target: 'airboss-ref:interp/walker-2017' as SourceId,
		historical: false,
	};
	const ackB: LessonAcknowledgment = {
		id: 'walker-compensation',
		target: 'airboss-ref:interp/walker-2017' as SourceId,
		historical: false,
	};

	it('matches by reference label', () => {
		const out = findMatchingAcks([ackA, ackB], 'airboss-ref:interp/walker-2017', 'walker-cost-sharing');
		expect(out).toEqual([ackA]);
	});

	it('matches by target when no reference label', () => {
		const out = findMatchingAcks([ackA, ackB], 'airboss-ref:interp/walker-2017', null);
		expect(out.length).toBe(2);
	});

	it('strips pin from raw before comparison', () => {
		const out = findMatchingAcks([ackA, ackB], 'airboss-ref:interp/walker-2017?at=2026', null);
		expect(out.length).toBe(2);
	});

	it('returns [] when nothing matches', () => {
		const out = findMatchingAcks([ackA], 'airboss-ref:regs/cfr-14/91/103?at=2026', null);
		expect(out).toEqual([]);
	});
});
