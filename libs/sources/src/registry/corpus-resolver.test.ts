import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { SourceEntry, SourceId } from '../types.ts';
import type { CorpusResolver } from './corpus-resolver.ts';
import {
	__corpus_resolver_internal__,
	ENUMERATED_CORPORA,
	getCorpusResolver,
	isEnumeratedCorpus,
	makeDefaultResolver,
	registerCorpusResolver,
} from './corpus-resolver.ts';

// This file exercises the no-op default behavior of the registry, including
// CR-04 which calls `registerCorpusResolver` (which updates the production
// snapshot). To keep the snapshot clean for other files in the same bun-test
// process, save it before each test and restore it afterwards.
let restoreProductionSnapshot: (() => void) | null = null;

beforeEach(() => {
	restoreProductionSnapshot = __corpus_resolver_internal__.saveProductionSnapshot();
	__corpus_resolver_internal__.wipeToNoOpDefaults();
});

afterEach(() => {
	restoreProductionSnapshot?.();
	restoreProductionSnapshot = null;
	__corpus_resolver_internal__.resetToDefaults();
});

describe('corpus-resolver registration', () => {
	test('CR-01: every enumerated corpus has a default no-op resolver at module load', () => {
		for (const corpus of ENUMERATED_CORPORA) {
			const resolver = getCorpusResolver(corpus);
			expect(resolver).not.toBeNull();
			expect(resolver?.corpus).toBe(corpus);
			expect(resolver?.getCurrentEdition()).toBeNull();
		}
	});

	test('CR-02: isEnumeratedCorpus returns true for every enumerated corpus', () => {
		for (const corpus of ENUMERATED_CORPORA) {
			expect(isEnumeratedCorpus(corpus)).toBe(true);
		}
	});

	test('CR-03: isEnumeratedCorpus returns false for non-enumerated', () => {
		expect(isEnumeratedCorpus('not-a-corpus')).toBe(false);
		expect(isEnumeratedCorpus('unknown')).toBe(false); // unknown is the magic prefix, NOT enumerated
		expect(isEnumeratedCorpus('')).toBe(false);
	});

	test('CR-04: registerCorpusResolver replaces the default', () => {
		const real: CorpusResolver = {
			corpus: 'regs',
			parseLocator: (_locator) => ({ kind: 'ok', segments: ['cfr-14'] }),
			formatCitation: (_e, _s) => 'real-citation',
			getCurrentEdition: () => '2026',
			getEditions: async () => [],
			getLiveUrl: () => null,
			getDerivativeContent: () => null,
			getIndexedContent: async () => null,
		};
		registerCorpusResolver(real);
		const resolver = getCorpusResolver('regs');
		expect(resolver).toBe(real);
		expect(resolver?.getCurrentEdition()).toBe('2026');
	});

	test('CR-05: default resolver parseLocator returns segmented opaque shape', () => {
		const resolver = getCorpusResolver('regs');
		const result = resolver?.parseLocator('cfr-14/91/103');
		expect(result?.kind).toBe('ok');
		if (result?.kind === 'ok') {
			expect(result.segments).toEqual(['cfr-14', '91', '103']);
		}
	});

	test('CR-05b: default resolver parseLocator rejects empty', () => {
		const resolver = getCorpusResolver('regs');
		const result = resolver?.parseLocator('');
		expect(result?.kind).toBe('error');
	});

	test('CR-06: default resolver formatCitation returns canonical fields', () => {
		const resolver = getCorpusResolver('regs');
		const entry: SourceEntry = {
			id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
			corpus: 'regs',
			canonical_short: '§91.103',
			canonical_formal: '14 CFR § 91.103',
			canonical_title: 'Preflight action',
			last_amended_date: new Date('2026-01-01'),
			lifecycle: 'accepted',
		};
		expect(resolver?.formatCitation(entry, 'short')).toBe('§91.103');
		expect(resolver?.formatCitation(entry, 'formal')).toBe('14 CFR § 91.103');
		expect(resolver?.formatCitation(entry, 'title')).toBe('Preflight action');
	});

	test('CR-07: default resolver getEditions returns empty (Phase 2 EDITIONS empty)', async () => {
		const resolver = getCorpusResolver('regs');
		const eds = await resolver?.getEditions('airboss-ref:regs/cfr-14/91/103' as SourceId);
		expect(eds).toEqual([]);
	});

	test('makeDefaultResolver builds a fresh resolver per corpus', () => {
		const a = makeDefaultResolver('regs');
		const b = makeDefaultResolver('aim');
		expect(a.corpus).toBe('regs');
		expect(b.corpus).toBe('aim');
		expect(a).not.toBe(b);
	});

	test('listRegistered returns every enumerated corpus before Phase 3+ replacement', () => {
		const registered = __corpus_resolver_internal__.listRegistered();
		for (const corpus of ENUMERATED_CORPORA) {
			expect(registered).toContain(corpus);
		}
	});
});
