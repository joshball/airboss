/**
 * Tests for `parseTestPlan` -- markdown table -> walker step list.
 */

import { describe, expect, it } from 'vitest';
import { parseTestPlan } from './review-test-plan';

const MD_TWO_SECTIONS = `---
title: TP fixture
---

# TP

## 1. First section

| Step | Action            | Expected           |
| ---- | ----------------- | ------------------ |
| 1.1  | Click button A    | Modal opens        |
| 1.2  | Press escape      | Modal closes       |

## 2. Second section

| Step | Action       | Expected      |
| ---- | ------------ | ------------- |
| 2.1  | Submit form  | Toast appears |
`;

describe('parseTestPlan', () => {
	it('parses tables across H2 sections with cumulative stepIndex', () => {
		const steps = parseTestPlan('docs/work-packages/fixture/test-plan.md', MD_TWO_SECTIONS);
		expect(steps).toHaveLength(3);
		expect(steps[0]?.stepIndex).toBe(1);
		expect(steps[0]?.sectionTitle).toBe('1. First section');
		expect(steps[0]?.title).toBe('1.1');
		expect(steps[0]?.action).toBe('Click button A');
		expect(steps[0]?.expected).toBe('Modal opens');
		expect(steps[1]?.sectionTitle).toBe('1. First section');
		expect(steps[2]?.sectionTitle).toBe('2. Second section');
		expect(steps[2]?.stepIndex).toBe(3);
	});

	it('emits stable stepRefs that change when rowIndex moves', () => {
		const file = 'docs/work-packages/foo/test-plan.md';
		const a = parseTestPlan(file, MD_TWO_SECTIONS);
		const b = parseTestPlan(file, MD_TWO_SECTIONS);
		expect(a.map((s) => s.stepRef)).toEqual(b.map((s) => s.stepRef));
		// Insert a row at the top of section 1 and confirm the prior rows'
		// stepRefs change (because their rowIndex moved).
		const mutated = MD_TWO_SECTIONS.replace(
			'| 1.1  | Click button A    | Modal opens        |',
			'| 1.0  | Pre-step          | Sets up state      |\n| 1.1  | Click button A    | Modal opens        |',
		);
		const c = parseTestPlan(file, mutated);
		expect(c.length).toBe(4);
		// The "1.1" row is now at rowIndex 1 (was 0), so its stepRef differs.
		const old11 = a.find((s) => s.title === '1.1');
		const new11 = c.find((s) => s.title === '1.1');
		expect(old11).toBeDefined();
		expect(new11).toBeDefined();
		expect(new11?.stepRef).not.toBe(old11?.stepRef);
	});

	it('produces different stepRefs for different file paths even on identical content', () => {
		const a = parseTestPlan('docs/work-packages/foo/test-plan.md', MD_TWO_SECTIONS);
		const b = parseTestPlan('docs/work-packages/bar/test-plan.md', MD_TWO_SECTIONS);
		expect(a[0]?.stepRef).not.toBe(b[0]?.stepRef);
	});

	it('returns an empty list for a body with no tables', () => {
		const md = '## Just prose\n\nNo tables here.\n';
		expect(parseTestPlan('x.md', md)).toEqual([]);
	});

	it('skips a table whose row has fewer than 3 columns', () => {
		const md = `## section\n\n| a | b |\n| - | - |\n| 1 | 2 |\n`;
		expect(parseTestPlan('x.md', md)).toEqual([]);
	});

	it('strips a leading frontmatter block before parsing', () => {
		const md = `---\nstatus: draft\n---\n\n## s\n\n| a | b | c |\n| - | - | - |\n| 1 | 2 | 3 |\n`;
		const steps = parseTestPlan('x.md', md);
		expect(steps.length).toBe(1);
		expect(steps[0]?.title).toBe('1');
	});

	it('uses an empty sectionTitle for rows before any H2', () => {
		const md = `| a | b | c |\n| - | - | - |\n| 1 | 2 | 3 |\n\n## s\n\n| a | b | c |\n| - | - | - |\n| 4 | 5 | 6 |\n`;
		const steps = parseTestPlan('x.md', md);
		expect(steps[0]?.sectionTitle).toBe('');
		expect(steps[1]?.sectionTitle).toBe('s');
	});

	it('skipping a malformed row does not shift later steps stepRef', () => {
		const file = 'docs/work-packages/foo/test-plan.md';
		const clean = `## s\n\n| a | b | c |\n| - | - | - |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n`;
		const malformed = `## s\n\n| a | b | c |\n| - | - | - |\n| 1 | 2 | 3 |\n| oops |\n| 4 | 5 | 6 |\n`;
		const cleanSteps = parseTestPlan(file, clean);
		const malformedSteps = parseTestPlan(file, malformed);
		expect(cleanSteps.length).toBe(2);
		expect(malformedSteps.length).toBe(2);
		// rowIndex only advances for emitted rows, so the second valid row
		// keeps the same stepRef whether the malformed row is present or not.
		expect(malformedSteps[0]?.stepRef).toBe(cleanSteps[0]?.stepRef);
		expect(malformedSteps[1]?.stepRef).toBe(cleanSteps[1]?.stepRef);
	});
});
