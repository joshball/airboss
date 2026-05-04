/**
 * MapPanel a11y contract -- pins the labels + role fix landed in the
 * 2026-05-04 chunk-1 a11y CRITICAL close-out.
 *
 * Pre-fix the panel rendered each filled cell as `<a role="cell" title=...>`
 * which mis-applied table semantics to the link and used `title` (an
 * unreliable affordance for SR + keyboard-only users) for the cell label.
 * Post-fix:
 *
 *   - The grid region exposes a state-aware `aria-label` so AT users hear
 *     how populated the matrix is, not a fixed string.
 *   - `role="cell"` lives on a wrapper span; the anchor inside is a real
 *     link with `aria-label` (no `role` override, no `title`).
 *   - Empty cells use `aria-label` matching the visible dash.
 *
 * Runs under happy-dom via the `unit-dom` vitest project.
 */

import type { DomainCertRow } from '@ab/bc-study';
import { CERT_VALUES, DOMAIN_VALUES } from '@ab/constants';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import MapPanel from './MapPanel.svelte';

afterEach(() => {
	cleanup();
});

const TOTAL_CELLS = DOMAIN_VALUES.length * CERT_VALUES.length;

function emptyMatrix(): DomainCertRow[] {
	return [];
}

function singleCellMatrix(): DomainCertRow[] {
	const domain = DOMAIN_VALUES[0];
	const cert = CERT_VALUES[0];
	if (!domain || !cert) throw new Error('test setup: empty enums');
	return [
		{
			domain,
			cells: [
				{ cert, total: 10, mastered: 4, percent: 0.4 },
				...CERT_VALUES.slice(1).map((c) => ({ cert: c, total: 0, mastered: 0, percent: null })),
			],
		},
	];
}

describe('MapPanel -- a11y region label', () => {
	it('aria-label on the grid region reflects the populated-cell count for empty payload', () => {
		render(MapPanel, { domainCertMatrix: { value: emptyMatrix() } });
		const grid = screen.getByTestId('map-panel-grid');
		expect(grid.getAttribute('aria-label')).toBe(`Domain by cert mastery grid -- 0 of ${TOTAL_CELLS} cells populated`);
	});

	it('aria-label updates when payload contains populated cells', () => {
		render(MapPanel, { domainCertMatrix: { value: singleCellMatrix() } });
		const grid = screen.getByTestId('map-panel-grid');
		expect(grid.getAttribute('aria-label')).toBe(`Domain by cert mastery grid -- 1 of ${TOTAL_CELLS} cells populated`);
	});

	it('errored payload routes to PanelShell alert, suppressing the grid body', () => {
		// PanelShell hides the body when `error` is set and surfaces a single
		// `role=alert` paragraph. Pinning the contract here so a future regress
		// that leaks both the alert and the grid is caught.
		render(MapPanel, { domainCertMatrix: { error: 'boom' } });
		expect(screen.queryByTestId('map-panel-grid')).toBeNull();
		const alert = document.querySelector('[role="alert"]');
		expect(alert).not.toBeNull();
	});
});

describe('MapPanel -- a11y per-cell labels', () => {
	it('filled cells expose an aria-label with the verbose mastery summary, not a title', () => {
		render(MapPanel, { domainCertMatrix: { value: singleCellMatrix() } });
		const filled = document.querySelector<HTMLAnchorElement>('a.cell.filled');
		expect(filled).not.toBeNull();
		expect(filled?.getAttribute('aria-label')).toMatch(/mastered \(40%\)/);
		// Pre-fix regression guards: the anchor must NOT carry role=cell or
		// rely on title=, both of which the chunk-1 review flagged.
		expect(filled?.getAttribute('role')).toBeNull();
		expect(filled?.getAttribute('title')).toBeNull();
	});

	it('role="cell" wraps the anchor/span instead of overriding the link role', () => {
		render(MapPanel, { domainCertMatrix: { value: singleCellMatrix() } });
		const cellWrappers = document.querySelectorAll('[role="cell"]');
		// Every (domain, cert) pair gets one wrapper, regardless of fill state.
		expect(cellWrappers.length).toBe(TOTAL_CELLS);
		// The first wrapper hosts the populated anchor; assert the structure
		// so the contract is pinned end-to-end.
		const firstWrap = cellWrappers[0];
		expect(firstWrap?.querySelector('a.cell.filled')).not.toBeNull();
	});

	it('empty cells expose an aria-label including "no nodes" so SR users hear the gap', () => {
		render(MapPanel, { domainCertMatrix: { value: emptyMatrix() } });
		const empty = document.querySelector<HTMLSpanElement>('span.cell.empty');
		expect(empty).not.toBeNull();
		expect(empty?.getAttribute('aria-label')).toMatch(/no nodes$/);
	});
});
