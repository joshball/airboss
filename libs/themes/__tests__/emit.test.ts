import { describe, expect, it } from 'vitest';
import { emitAllThemes, LEGACY_ALIAS_NAMES, listThemes } from '../index';

describe('emitAllThemes', () => {
	it('is deterministic: two runs produce identical output', () => {
		const a = emitAllThemes();
		const b = emitAllThemes();
		expect(a).toBe(b);
	});

	it('emits a selector block for each registered (theme, appearance) pair', () => {
		const css = emitAllThemes();
		expect(css).toContain('[data-theme="airboss/default"][data-appearance="light"]');
		expect(css).toContain('[data-theme="airboss/default"][data-appearance="dark"]');
		expect(css).toContain('[data-theme="study/sectional"][data-appearance="light"]');
		expect(css).toContain('[data-theme="study/flightdeck"][data-appearance="light"]');
	});

	it('emits a :root fallback block', () => {
		expect(emitAllThemes()).toContain(':root {');
	});

	it('exposes every legacy --ab-* name as a compatibility alias', () => {
		const css = emitAllThemes();
		for (const name of LEGACY_ALIAS_NAMES) {
			expect(css).toContain(`${name}:`);
		}
	});

	it('declares every core role token', () => {
		const css = emitAllThemes();
		const required = [
			'--ink-body',
			'--surface-page',
			'--edge-default',
			'--action-default',
			'--action-default-hover',
			'--action-default-ink',
			'--signal-success',
			'--signal-warning',
			'--focus-ring',
			'--focus-ring-strong',
			'--focus-ring-shadow',
			'--space-md',
			'--radius-md',
			'--shadow-sm',
			'--motion-normal',
			'--layout-container-max',
		];
		for (const name of required) {
			expect(css).toContain(`${name}:`);
		}
	});

	it('wraps every action role with its full state set', () => {
		const css = emitAllThemes();
		const roles = ['default', 'hazard', 'caution', 'neutral', 'link'];
		const states = ['', '-hover', '-active', '-wash', '-edge', '-ink', '-disabled'];
		for (const role of roles) {
			for (const state of states) {
				expect(css).toContain(`--action-${role}${state}:`);
			}
		}
	});

	it('emits typography bundle role tokens for every (role, variant) pair', () => {
		const css = emitAllThemes();
		const matrix: Array<[string, readonly string[]]> = [
			['reading', ['body', 'lead', 'caption', 'quote']],
			['heading', ['1', '2', '3', '4', '5', '6']],
			['ui', ['control', 'label', 'caption', 'badge']],
			['code', ['inline', 'block']],
			['definition', ['term', 'body']],
		];
		const fields = ['family', 'size', 'weight', 'line-height', 'tracking'];
		for (const [role, variants] of matrix) {
			for (const variant of variants) {
				for (const field of fields) {
					expect(css).toContain(`--type-${role}-${variant}-${field}:`);
				}
			}
		}
	});

	it('emits per-variant button + input control role tokens', () => {
		const css = emitAllThemes();
		const buttonVariants = ['default', 'primary', 'hazard', 'neutral', 'ghost'];
		const inputVariants = ['default', 'error'];
		const slots = [
			'-bg',
			'-ink',
			'-border',
			'-hover-bg',
			'-hover-ink',
			'-active-bg',
			'-disabled-bg',
			'-disabled-ink',
			'-ring',
		];
		for (const variant of buttonVariants) {
			for (const slot of slots) {
				expect(css).toContain(`--button-${variant}${slot}:`);
			}
		}
		for (const variant of inputVariants) {
			for (const slot of slots) {
				expect(css).toContain(`--input-${variant}${slot}:`);
			}
		}
	});

	it('does not emit --sim-* role tokens when no theme populates sim', () => {
		const anySim = listThemes().some((t) => t.sim !== undefined);
		if (!anySim) {
			const css = emitAllThemes();
			expect(css).not.toMatch(/^\s*--sim-/m);
		}
	});

	it('exposes every --ab-sim-* legacy name as a compatibility alias (TODO sentinels OK)', () => {
		const simNames = LEGACY_ALIAS_NAMES.filter((n) => n.startsWith('--ab-sim-'));
		// Block ships non-empty so apps/sim keeps resolving.
		expect(simNames.length).toBeGreaterThan(0);
		const css = emitAllThemes();
		for (const name of simNames) {
			expect(css).toContain(`${name}:`);
		}
	});

	it('registered themes declare typography bundles + control slots', () => {
		for (const theme of listThemes()) {
			expect(theme.typography.bundles).toBeDefined();
			expect(theme.typography.bundles.reading.body).toBeDefined();
			expect(theme.typography.bundles.heading[1]).toBeDefined();
			expect(theme.typography.bundles.ui.control).toBeDefined();
			expect(theme.control.button.primary).toBeDefined();
			expect(theme.control.input.default).toBeDefined();
		}
	});
});
