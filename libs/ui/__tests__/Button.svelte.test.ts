/**
 * Button DOM contract.
 *
 * Pins the variant/size/state attributes other code relies on for styling
 * and a11y, the disabled-blocks-click rule for both <button> and <a> forms,
 * and the loading label swap.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ButtonHarness from './harnesses/ButtonHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('Button -- rendering', () => {
	it('renders a <button> by default with the children label', () => {
		render(ButtonHarness, { label: 'Save' });
		const root = screen.getByTestId('button-root');
		expect(root.tagName).toBe('BUTTON');
		expect(root.textContent?.trim()).toBe('Save');
	});

	it('renders an <a> when href is provided', () => {
		render(ButtonHarness, { label: 'Open', href: '/x' });
		const root = screen.getByTestId('button-root');
		expect(root.tagName).toBe('A');
		expect(root.getAttribute('href')).toBe('/x');
	});
});

describe('Button -- variants and sizes reflect on the DOM', () => {
	it('default variant + size are primary + md', () => {
		render(ButtonHarness, { label: 'Save' });
		const root = screen.getByTestId('button-root');
		expect(root.getAttribute('data-variant')).toBe('primary');
		expect(root.getAttribute('data-size')).toBe('md');
		expect(root.classList.contains('v-primary')).toBe(true);
		expect(root.classList.contains('s-md')).toBe(true);
	});

	it('variant=danger + size=lg show through to data attributes and classes', () => {
		render(ButtonHarness, { label: 'Delete', variant: 'danger', size: 'lg' });
		const root = screen.getByTestId('button-root');
		expect(root.getAttribute('data-variant')).toBe('danger');
		expect(root.getAttribute('data-size')).toBe('lg');
		expect(root.classList.contains('v-danger')).toBe(true);
		expect(root.classList.contains('s-lg')).toBe(true);
	});
});

describe('Button -- click behavior', () => {
	it('fires onclick when enabled', async () => {
		const onclick = vi.fn();
		const user = userEvent.setup();
		render(ButtonHarness, { label: 'Save', onclick });
		await user.click(screen.getByTestId('button-root'));
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('does not fire onclick when disabled', async () => {
		const onclick = vi.fn();
		const user = userEvent.setup();
		render(ButtonHarness, { label: 'Save', disabled: true, onclick });
		await user.click(screen.getByTestId('button-root'));
		expect(onclick).not.toHaveBeenCalled();
	});

	it('does not fire onclick when loading', async () => {
		const onclick = vi.fn();
		const user = userEvent.setup();
		render(ButtonHarness, { label: 'Save', loading: true, onclick });
		await user.click(screen.getByTestId('button-root'));
		expect(onclick).not.toHaveBeenCalled();
	});
});

describe('Button -- anchor disabled', () => {
	it('anchor with disabled has aria-disabled=true and tabindex=-1', () => {
		render(ButtonHarness, { label: 'Open', href: '/x', disabled: true });
		const root = screen.getByTestId('button-root');
		expect(root.getAttribute('aria-disabled')).toBe('true');
		expect(root.getAttribute('tabindex')).toBe('-1');
	});

	it('disabled anchor does not call onclick', async () => {
		const onclick = vi.fn();
		const user = userEvent.setup();
		render(ButtonHarness, { label: 'Open', href: '/x', disabled: true, onclick });
		await user.click(screen.getByTestId('button-root'));
		expect(onclick).not.toHaveBeenCalled();
	});
});

describe('Button -- loading state', () => {
	it('replaces label with loadingLabel while loading', () => {
		render(ButtonHarness, { label: 'Save', loading: true, loadingLabel: 'Saving...' });
		expect(screen.getByTestId('button-root').textContent?.trim()).toBe('Saving...');
	});

	it('reports state=loading on data-state', () => {
		render(ButtonHarness, { label: 'Save', loading: true });
		expect(screen.getByTestId('button-root').getAttribute('data-state')).toBe('loading');
	});

	it('reports state=disabled on data-state when disabled but not loading', () => {
		render(ButtonHarness, { label: 'Save', disabled: true });
		expect(screen.getByTestId('button-root').getAttribute('data-state')).toBe('disabled');
	});
});

describe('Button -- a11y plumbing', () => {
	it('passes ariaLabel through to aria-label', () => {
		render(ButtonHarness, { label: 'X', ariaLabel: 'Close dialog' });
		expect(screen.getByTestId('button-root').getAttribute('aria-label')).toBe('Close dialog');
	});

	it('keyboard Enter activates a button', async () => {
		const onclick = vi.fn();
		const user = userEvent.setup();
		render(ButtonHarness, { label: 'Go', onclick });
		const root = screen.getByTestId('button-root');
		(root as HTMLButtonElement).focus();
		await user.keyboard('{Enter}');
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('keyboard Space activates a button', async () => {
		const onclick = vi.fn();
		const user = userEvent.setup();
		render(ButtonHarness, { label: 'Go', onclick });
		const root = screen.getByTestId('button-root');
		(root as HTMLButtonElement).focus();
		await user.keyboard(' ');
		expect(onclick).toHaveBeenCalledTimes(1);
	});
});
