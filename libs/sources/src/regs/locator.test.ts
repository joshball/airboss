import { describe, expect, it } from 'vitest';
import { parseRegsLocator } from './locator.ts';

describe('parseRegsLocator', () => {
	describe('accepts', () => {
		it('a section under cfr-14', () => {
			const result = parseRegsLocator('cfr-14/91/103');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.regs).toEqual({ title: '14', part: '91', section: '103' });
		});

		it('a section with single-letter paragraph', () => {
			const result = parseRegsLocator('cfr-14/91/103/b');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.regs).toEqual({ title: '14', part: '91', section: '103', paragraph: ['b'] });
		});

		it('a section with multi-level paragraph', () => {
			const result = parseRegsLocator('cfr-14/91/103/b/1/i');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.regs).toEqual({ title: '14', part: '91', section: '103', paragraph: ['b', '1', 'i'] });
		});

		it('a subpart', () => {
			const result = parseRegsLocator('cfr-14/91/subpart-b');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.regs).toEqual({ title: '14', part: '91', subpart: 'b' });
		});

		it('a multi-letter subpart', () => {
			const result = parseRegsLocator('cfr-14/91/subpart-aa');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.regs).toEqual({ title: '14', part: '91', subpart: 'aa' });
		});

		it('a whole Part', () => {
			const result = parseRegsLocator('cfr-14/91');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.regs).toEqual({ title: '14', part: '91' });
		});

		it('a section with trailing letter (e.g. 91.151a)', () => {
			const result = parseRegsLocator('cfr-14/91/151a');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.regs).toEqual({ title: '14', part: '91', section: '151a' });
		});

		it('a 49 CFR Part 830 section', () => {
			const result = parseRegsLocator('cfr-49/830/5');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.regs).toEqual({ title: '49', part: '830', section: '5' });
		});

		it('a 49 CFR Part 1552 subpart', () => {
			const result = parseRegsLocator('cfr-49/1552/subpart-a');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.regs).toEqual({ title: '49', part: '1552', subpart: 'a' });
		});
	});

	describe('rejects', () => {
		it('an empty locator', () => {
			const result = parseRegsLocator('');
			expect(result.kind).toBe('error');
		});

		it('a locator without cfr- prefix', () => {
			const result = parseRegsLocator('14/91/103');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/cfr-14|cfr-49/);
		});

		it('an unsupported title', () => {
			const result = parseRegsLocator('cfr-7/91/103');
			expect(result.kind).toBe('error');
		});

		it('a locator missing the part', () => {
			const result = parseRegsLocator('cfr-14');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/part/);
		});

		it('a non-digit part', () => {
			const result = parseRegsLocator('cfr-14/abc/103');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/part/);
		});

		it('a malformed subpart', () => {
			const result = parseRegsLocator('cfr-14/91/subpart-');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/subpart/);
		});

		it('extra segments after a subpart', () => {
			const result = parseRegsLocator('cfr-14/91/subpart-b/extra');
			expect(result.kind).toBe('error');
		});

		it('a malformed section', () => {
			const result = parseRegsLocator('cfr-14/91/abc');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/section/);
		});

		it('a paragraph segment with illegal chars', () => {
			const result = parseRegsLocator('cfr-14/91/103/B!');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/paragraph/);
		});
	});
});
