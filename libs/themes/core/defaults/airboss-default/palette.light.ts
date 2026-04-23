/**
 * Airboss default palette -- light.
 *
 * Values are ported verbatim from the pre-overhaul `--ab-*` palette so
 * package #5's page-level sweep can ship pixel-identical to pre-change.
 * Role names replace the legacy names (see the rename table in the
 * package #1 tasks doc) but every concrete hex is unchanged.
 *
 * Because values are hex (not OKLCH), derivation math in `derive.ts`
 * will return inputs unchanged. We therefore ship explicit
 * `overrides` for every action / signal variant so the emitted CSS
 * matches the legacy tokens exactly. When we port to OKLCH in package
 * #6 (dark) we can drop the overrides and let derivation do its job.
 */

import type { Palette } from '../../../contract';

export const palette: Palette = {
	ink: {
		body: '#0f172a',
		muted: '#475569',
		subtle: '#64748b',
		faint: '#94a3b8',
		strong: '#334155',
		inverse: '#ffffff',
	},
	surface: {
		page: '#f8fafc',
		panel: '#ffffff',
		raised: '#ffffff',
		sunken: '#f1f5f9',
		muted: '#f8fafc',
		overlay: '#ffffff',
	},
	edge: {
		default: '#e2e8f0',
		strong: '#cbd5e1',
		subtle: '#f1f5f9',
	},
	action: {
		default: '#2563eb',
		hazard: '#dc2626',
		caution: '#d97706',
		neutral: '#64748b',
		link: '#2563eb',
	},
	signal: {
		success: '#16a34a',
		warning: '#d97706',
		danger: '#dc2626',
		info: '#0284c7',
	},
	focus: '#2563eb',
	accent: {
		code: '#4f46e5',
		reference: '#4f46e5',
		definition: '#4f46e5',
	},
	overrides: {
		action: {
			default: {
				base: '#2563eb',
				hover: '#1d4ed8',
				active: '#1e40af',
				wash: '#eff6ff',
				edge: '#bfdbfe',
				ink: '#ffffff',
				disabled: 'rgba(37, 99, 235, 0.4)',
			},
			hazard: {
				base: '#dc2626',
				hover: '#b91c1c',
				active: '#991b1b',
				wash: '#fef2f2',
				edge: '#fecaca',
				ink: '#ffffff',
				disabled: 'rgba(220, 38, 38, 0.4)',
			},
			caution: {
				base: '#d97706',
				hover: '#b45309',
				active: '#92400e',
				wash: '#fffbeb',
				edge: '#fde68a',
				ink: '#ffffff',
				disabled: 'rgba(217, 119, 6, 0.4)',
			},
			neutral: {
				base: '#64748b',
				hover: '#475569',
				active: '#334155',
				wash: '#f1f5f9',
				edge: '#e2e8f0',
				ink: '#ffffff',
				disabled: 'rgba(100, 116, 139, 0.4)',
			},
			link: {
				base: '#2563eb',
				hover: '#1d4ed8',
				active: '#1e40af',
				wash: '#eff6ff',
				edge: '#bfdbfe',
				ink: '#ffffff',
				disabled: 'rgba(37, 99, 235, 0.4)',
			},
		},
		signal: {
			success: { solid: '#16a34a', wash: '#f0fdf4', edge: '#bbf7d0', ink: '#ffffff' },
			warning: { solid: '#d97706', wash: '#fffbeb', edge: '#fde68a', ink: '#ffffff' },
			danger: { solid: '#dc2626', wash: '#fef2f2', edge: '#fecaca', ink: '#ffffff' },
			info: { solid: '#0284c7', wash: '#f0f9ff', edge: '#bae6fd', ink: '#ffffff' },
		},
		focus: {
			ring: '#2563eb',
			ringStrong: '#2563eb',
			ringShadow: '0 0 0 3px #2563eb',
		},
		overlay: {
			scrim: 'rgba(0, 0, 0, 0.5)',
			tooltipBg: '#0f172a',
			tooltipInk: '#ffffff',
		},
		selection: {
			bg: '#bfdbfe',
			ink: '#0f172a',
		},
		disabled: {
			surface: '#f1f5f9',
			ink: '#94a3b8',
			edge: '#e2e8f0',
		},
		link: {
			default: '#2563eb',
			hover: '#1d4ed8',
			visited: '#1e40af',
		},
	},
};
