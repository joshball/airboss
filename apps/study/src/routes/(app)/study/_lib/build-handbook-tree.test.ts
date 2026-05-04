/**
 * Tests for the Handbook map projection builder.
 *
 * The integration paths are DB-bound; this suite covers the pure helpers
 * (`rollupOverNodes`) plus the empty-input shape. Full coverage of the
 * tree against seeded data lives in the Playwright e2e.
 */

import { NODE_MASTERY_GATES, type AssessmentMethod } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { rollupOverNodes } from './build-handbook-tree';
import type { NodeEvidenceState } from '@ab/bc-study';

const NA = NODE_MASTERY_GATES.NOT_APPLICABLE;
const PASS = NODE_MASTERY_GATES.PASS;
const FAIL = NODE_MASTERY_GATES.FAIL;
const INSUF = NODE_MASTERY_GATES.INSUFFICIENT_DATA;

function state(
	nodeId: string,
	overrides: Partial<Record<AssessmentMethod, NodeEvidenceState['recall']>> = {},
): NodeEvidenceState {
	return {
		nodeId,
		recall: overrides.recall ?? NA,
		calculation: overrides.calculation ?? NA,
		scenario: overrides.scenario ?? NA,
		demonstration: overrides.demonstration ?? NA,
		teaching: overrides.teaching ?? NA,
	};
}

describe('rollupOverNodes', () => {
	it('returns 0/0 for an empty set', () => {
		const map = new Map<string, NodeEvidenceState>();
		expect(rollupOverNodes([], map)).toEqual({ mastered: 0, covered: 0 });
	});

	it('counts a node with PASS as both mastered and covered', () => {
		const map = new Map<string, NodeEvidenceState>([['k1', state('k1', { recall: PASS })]]);
		expect(rollupOverNodes(['k1'], map)).toEqual({ mastered: 1, covered: 1 });
	});

	it('counts a node with FAIL/INSUFFICIENT as covered, not mastered', () => {
		const map = new Map<string, NodeEvidenceState>([
			['k1', state('k1', { recall: FAIL })],
			['k2', state('k2', { recall: INSUF })],
		]);
		expect(rollupOverNodes(['k1', 'k2'], map)).toEqual({ mastered: 0, covered: 2 });
	});

	it('skips nodes whose state is missing from the map', () => {
		const map = new Map<string, NodeEvidenceState>([['k1', state('k1', { recall: PASS })]]);
		expect(rollupOverNodes(['k1', 'missing'], map)).toEqual({ mastered: 1, covered: 1 });
	});

	it('NA-only state counts as neither mastered nor covered', () => {
		const map = new Map<string, NodeEvidenceState>([['k1', state('k1')]]);
		expect(rollupOverNodes(['k1'], map)).toEqual({ mastered: 0, covered: 0 });
	});
});
