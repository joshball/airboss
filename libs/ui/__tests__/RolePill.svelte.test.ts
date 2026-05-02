/**
 * RolePill DOM contract -- compact uppercase pill that renders its
 * children as the visible label, optionally hidden from AT.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import RolePillHarness from './harnesses/RolePillHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('RolePill', () => {
	it('renders the children label inside the root span', () => {
		render(RolePillHarness, { label: 'admin' });
		const root = screen.getByTestId('role-pill-root');
		expect(root.textContent ?? '').toContain('admin');
	});

	it('passes ariaLabel through', () => {
		render(RolePillHarness, { label: 'A', ariaLabel: 'Role: admin' });
		expect(screen.getByTestId('role-pill-root').getAttribute('aria-label')).toBe('Role: admin');
	});

	it('omits aria-hidden by default', () => {
		render(RolePillHarness, { label: 'admin' });
		expect(screen.getByTestId('role-pill-root').getAttribute('aria-hidden')).toBeNull();
	});

	it('sets aria-hidden=true when ariaHidden is passed', () => {
		render(RolePillHarness, { label: 'admin', ariaHidden: true });
		expect(screen.getByTestId('role-pill-root').getAttribute('aria-hidden')).toBe('true');
	});
});
