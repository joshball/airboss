/**
 * `<ReadableScope>` emits the five `--reader-*` CSS variables on a wrapper
 * div from its props. Components downstream consume those variables with
 * fallbacks to the platform tokens.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ReadableScopeHarness from './harnesses/ReadableScopeHarness.svelte';

afterEach(() => {
	cleanup();
});

function getScopeRoot(): HTMLElement {
	const child = screen.getByTestId('scope-child');
	const parent = child.parentElement;
	if (!parent) throw new Error('ReadableScope root not found');
	return parent;
}

describe('<ReadableScope>', () => {
	it('emits all five `--reader-*` variables for the default props', () => {
		render(ReadableScopeHarness, {});
		const root = getScopeRoot();
		const style = root.getAttribute('style') ?? '';
		expect(style).toContain('--reader-body-font-family: var(--font-family-serif)');
		expect(style).toContain('--reader-body-font-size: calc(var(--font-size-base) * 1)');
		expect(style).toContain('--reader-body-line-height: 1.65');
		expect(style).toContain('--reader-measure-ch: 72ch');
		expect(style).toContain('--reader-heading-scale: 1');
	});

	it('maps font family to the matching CSS variable', () => {
		render(ReadableScopeHarness, { fontFamily: 'sans' });
		const root = getScopeRoot();
		expect(root.getAttribute('style')).toContain('--reader-body-font-family: var(--font-family-sans)');
	});

	it('maps mono font family to the mono variable', () => {
		render(ReadableScopeHarness, { fontFamily: 'mono' });
		const root = getScopeRoot();
		expect(root.getAttribute('style')).toContain('--reader-body-font-family: var(--font-family-mono)');
	});

	it('maps font scale through the calc() expression', () => {
		render(ReadableScopeHarness, { fontScale: 1.25 });
		const root = getScopeRoot();
		expect(root.getAttribute('style')).toContain('--reader-body-font-size: calc(var(--font-size-base) * 1.25)');
	});

	it('maps each density to the matching line-height', () => {
		const cases: Array<['compact' | 'comfortable' | 'spacious', string]> = [
			['compact', '1.45'],
			['comfortable', '1.65'],
			['spacious', '1.85'],
		];
		for (const [density, expected] of cases) {
			cleanup();
			render(ReadableScopeHarness, { density });
			const root = getScopeRoot();
			expect(root.getAttribute('style')).toContain(`--reader-body-line-height: ${expected}`);
		}
	});

	it('maps each measure to the matching ch value', () => {
		const cases: Array<['narrow' | 'normal' | 'wide', string]> = [
			['narrow', '60ch'],
			['normal', '72ch'],
			['wide', '84ch'],
		];
		for (const [measure, expected] of cases) {
			cleanup();
			render(ReadableScopeHarness, { measure });
			const root = getScopeRoot();
			expect(root.getAttribute('style')).toContain(`--reader-measure-ch: ${expected}`);
		}
	});

	it('emits the heading scale as a unit-less number', () => {
		render(ReadableScopeHarness, { headingScale: 1.15 });
		const root = getScopeRoot();
		expect(root.getAttribute('style')).toContain('--reader-heading-scale: 1.15');
	});
});
