/**
 * PanelShell DOM contract -- header / body / action / error.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PanelShellHarness from './harnesses/PanelShellHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('PanelShell -- rendering', () => {
	it('renders title and body by default', () => {
		render(PanelShellHarness, { title: 'Plan', body: 'work' });
		expect(screen.getByTestId('panelshell-title').textContent).toBe('Plan');
		expect(screen.getByTestId('harness-body-content').textContent).toBe('work');
	});

	it('renders subtitle when provided, omits when not', () => {
		const { rerender } = render(PanelShellHarness, { title: 'Plan' });
		expect(screen.queryByTestId('panelshell-subtitle')).toBeNull();
		rerender({ title: 'Plan', subtitle: 'today' });
		expect(screen.getByTestId('panelshell-subtitle').textContent).toBe('today');
	});

	it('renders action snippet when provided', () => {
		render(PanelShellHarness, { title: 'Plan', withAction: true, actionLabel: 'Refresh' });
		expect(screen.getByTestId('panelshell-action')).toBeTruthy();
		expect(screen.getByTestId('harness-action').textContent).toBe('Refresh');
	});
});

describe('PanelShell -- variant + a11y', () => {
	it('default variant is live', () => {
		render(PanelShellHarness, { title: 'Plan' });
		expect(screen.getByTestId('panelshell-root').getAttribute('data-variant')).toBe('live');
	});

	it('variant=gated reflects on data-variant and class', () => {
		render(PanelShellHarness, { title: 'Plan', variant: 'gated' });
		const root = screen.getByTestId('panelshell-root');
		expect(root.getAttribute('data-variant')).toBe('gated');
		expect(root.classList.contains('gated')).toBe(true);
	});

	it('aria-labelledby points at the title h2 id', () => {
		render(PanelShellHarness, { title: 'Plan' });
		const root = screen.getByTestId('panelshell-root');
		const labelledBy = root.getAttribute('aria-labelledby');
		expect(labelledBy).toBe('panel-plan');
		expect(document.getElementById(labelledBy ?? '')).toBe(screen.getByTestId('panelshell-title'));
	});
});

describe('PanelShell -- error', () => {
	it('error truthy + errorMessage renders the message + role=alert + replaces body', () => {
		render(PanelShellHarness, { title: 'Plan', error: 'oh no', errorMessage: 'broken' });
		const err = screen.getByTestId('panelshell-error');
		expect(err.textContent).toBe('broken');
		expect(err.getAttribute('role')).toBe('alert');
		expect(screen.queryByTestId('harness-body-content')).toBeNull();
		expect(screen.getByTestId('panelshell-root').getAttribute('data-state')).toBe('error');
	});

	it('error truthy with no errorMessage falls back to a generic per-title message', () => {
		render(PanelShellHarness, { title: 'Plan', error: 'oh no' });
		expect(screen.getByTestId('panelshell-error').textContent).toBe('Unable to load plan -- try refreshing.');
	});
});
