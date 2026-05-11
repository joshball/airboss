/**
 * Phase D test plan -- knowledge-node resolver (WXENG-32).
 *
 * - `resolveKnowledgeNodeId` returns true for real corpus ids.
 * - `resolveKnowledgeNodeId` returns false for ids that strip the wx- prefix
 *   to a non-existent directory under course/knowledge/weather/.
 * - `resolveKnowledgeNodeId` returns false for ids that lack the wx- prefix.
 * - `validateAllKnowledgeNodes` reports every unresolved id with the
 *   originating callout id.
 */

import { describe, expect, it } from 'vitest';
import { resolveKnowledgeNodeId, validateAllKnowledgeNodes } from '../commentary/knowledge-link';
import type { CommentaryCallout } from '../commentary/types';

describe('resolveKnowledgeNodeId', () => {
	it('returns true for an existing weather knowledge node', () => {
		expect(resolveKnowledgeNodeId('wx-airmasses-and-fronts')).toBe(true);
	});

	it('returns true for a sample of distinct weather knowledge nodes', () => {
		const ids = [
			'wx-wind-systems',
			'wx-stability-and-instability',
			'wx-clouds-and-precipitation',
			'wx-go-nogo-decision',
			'wx-icing-types-and-avoidance',
			'wx-thunderstorm-hazards',
			'wx-fog-and-visibility-obstructions',
			'wx-turbulence-types',
			'wx-freezing-level',
			'wx-product-airmets-sigmets',
			'wx-product-pireps',
			'wx-product-winds-aloft',
			'wx-reading-metars-tafs',
			'wx-product-surface-analysis-and-cva',
			'wx-chart-type-surface-analysis',
		];
		for (const id of ids) {
			expect(resolveKnowledgeNodeId(id)).toBe(true);
		}
	});

	it('returns false for an id whose directory does not exist', () => {
		expect(resolveKnowledgeNodeId('wx-nonexistent-node-xyz')).toBe(false);
	});

	it('returns false for an id missing the wx- prefix', () => {
		expect(resolveKnowledgeNodeId('airmasses-and-fronts')).toBe(false);
	});

	it('returns false for an empty id after stripping the prefix', () => {
		expect(resolveKnowledgeNodeId('wx-')).toBe(false);
	});
});

describe('validateAllKnowledgeNodes', () => {
	it('returns empty unresolved + empty callout-id list when every id resolves', () => {
		const callouts: CommentaryCallout[] = [
			{
				id: 'c1',
				target: { kind: 'metar', elementId: 'KSTL' },
				mode: 'socratic',
				question: 'Why?',
				observation: 'Look.',
				reason: 'Because.',
				knowledgeNodeIds: ['wx-airmasses-and-fronts', 'wx-wind-systems'],
			},
		];
		const report = validateAllKnowledgeNodes(callouts);
		expect(report.unresolved).toEqual([]);
		expect(report.calloutIds).toEqual([]);
	});

	it('reports the bad id and originating callout when one entry misses', () => {
		const callouts: CommentaryCallout[] = [
			{
				id: 'c1',
				target: { kind: 'metar', elementId: 'KSTL' },
				mode: 'socratic',
				question: 'Why?',
				observation: 'Look.',
				reason: 'Because.',
				knowledgeNodeIds: ['wx-airmasses-and-fronts', 'wx-bogus-node-zzz'],
			},
		];
		const report = validateAllKnowledgeNodes(callouts);
		expect(report.unresolved).toEqual(['wx-bogus-node-zzz']);
		expect(report.calloutIds).toEqual(['c1']);
	});

	it('deduplicates unresolved ids across multiple callouts', () => {
		const mkCallout = (id: string, refs: string[]): CommentaryCallout => ({
			id,
			target: { kind: 'metar', elementId: 'KSTL' },
			mode: 'socratic',
			question: 'Why?',
			observation: 'Look.',
			reason: 'Because.',
			knowledgeNodeIds: refs,
		});
		const callouts: CommentaryCallout[] = [
			mkCallout('c1', ['wx-bogus-node-a']),
			mkCallout('c2', ['wx-bogus-node-a', 'wx-bogus-node-b']),
		];
		const report = validateAllKnowledgeNodes(callouts);
		expect(report.unresolved).toEqual(['wx-bogus-node-a', 'wx-bogus-node-b']);
		expect(report.calloutIds).toEqual(['c1', 'c2']);
	});
});
