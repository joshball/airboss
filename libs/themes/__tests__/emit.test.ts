import { describe, expect, it } from 'vitest';
import { emitAllThemes, LEGACY_ALIAS_NAMES } from '../index';

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
});
