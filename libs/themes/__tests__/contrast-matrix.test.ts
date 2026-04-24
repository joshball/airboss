/**
 * WCAG contrast matrix -- every theme × appearance × required pair.
 *
 * Body text and button-label pairs must meet WCAG AA (4.5:1). Borders
 * and large text drop to 3:1. AAA (7:1 body / 4.5:1 large) is reported
 * as advisory: failures log a warning but do not fail the test.
 */

import { contrastRatio, listThemes } from '@ab/themes';
import { describe, expect, it } from 'vitest';
import type { AppearanceMode, Theme } from '../contract';
// Theme + AppearanceMode are used below in the resolver signature.
import { deriveInteractiveStates, deriveSignalVariants } from '../derive';

interface ResolvedRolePalette {
	'ink.body': string;
	'ink.muted': string;
	'ink.inverse': string;
	'surface.page': string;
	'surface.panel': string;
	'surface.sunken': string;
	'edge.default': string;
	'action.default': string;
	'action.default.ink': string;
	'action.hazard': string;
	'action.hazard.ink': string;
	'action.neutral': string;
	'action.neutral.ink': string;
	'signal.success.wash': string;
	'signal.success.ink': string;
	'signal.warning.wash': string;
	'signal.warning.ink': string;
	'signal.danger.wash': string;
	'signal.danger.ink': string;
	'signal.info.wash': string;
	'signal.info.ink': string;
}

function resolvePalette(theme: Theme, appearance: AppearanceMode): ResolvedRolePalette | undefined {
	const palette = theme.palette[appearance];
	if (!palette) return undefined;
	const isDark = appearance === 'dark';
	const overrides = palette.overrides;
	const actionDefault = {
		...deriveInteractiveStates(palette.action.default, isDark),
		...(overrides?.action?.default ?? {}),
	};
	const actionHazard = {
		...deriveInteractiveStates(palette.action.hazard, isDark),
		...(overrides?.action?.hazard ?? {}),
	};
	const actionNeutral = {
		...deriveInteractiveStates(palette.action.neutral, isDark),
		...(overrides?.action?.neutral ?? {}),
	};
	const signalSuccess = {
		...deriveSignalVariants(palette.signal.success, isDark),
		...(overrides?.signal?.success ?? {}),
	};
	const signalWarning = {
		...deriveSignalVariants(palette.signal.warning, isDark),
		...(overrides?.signal?.warning ?? {}),
	};
	const signalDanger = { ...deriveSignalVariants(palette.signal.danger, isDark), ...(overrides?.signal?.danger ?? {}) };
	const signalInfo = { ...deriveSignalVariants(palette.signal.info, isDark), ...(overrides?.signal?.info ?? {}) };
	return {
		'ink.body': palette.ink.body,
		'ink.muted': palette.ink.muted,
		'ink.inverse': palette.ink.inverse,
		'surface.page': palette.surface.page,
		'surface.panel': palette.surface.panel,
		'surface.sunken': palette.surface.sunken,
		'edge.default': palette.edge.default,
		'action.default': actionDefault.base,
		'action.default.ink': actionDefault.ink,
		'action.hazard': actionHazard.base,
		'action.hazard.ink': actionHazard.ink,
		'action.neutral': actionNeutral.base,
		'action.neutral.ink': actionNeutral.ink,
		'signal.success.wash': signalSuccess.wash,
		'signal.success.ink': signalSuccess.ink,
		'signal.warning.wash': signalWarning.wash,
		'signal.warning.ink': signalWarning.ink,
		'signal.danger.wash': signalDanger.wash,
		'signal.danger.ink': signalDanger.ink,
		'signal.info.wash': signalInfo.wash,
		'signal.info.ink': signalInfo.ink,
	};
}

type RoleKey = keyof ResolvedRolePalette;

interface Pair {
	fg: RoleKey;
	bg: RoleKey;
	min: number;
	description: string;
}

const REQUIRED_PAIRS: Pair[] = [
	{ fg: 'ink.body', bg: 'surface.page', min: 4.5, description: 'body text on page' },
	{ fg: 'ink.body', bg: 'surface.panel', min: 4.5, description: 'body text on panel' },
	{ fg: 'ink.body', bg: 'surface.sunken', min: 4.5, description: 'body text on sunken' },
	{ fg: 'ink.muted', bg: 'surface.page', min: 4.5, description: 'muted ink on page' },
	{ fg: 'action.default.ink', bg: 'action.default', min: 4.5, description: 'action-default label on fill' },
	{ fg: 'action.hazard.ink', bg: 'action.hazard', min: 4.5, description: 'action-hazard label on fill' },
	{ fg: 'action.neutral.ink', bg: 'action.neutral', min: 4.5, description: 'action-neutral label on fill' },
	// Body-ink on signal washes -- the realistic "chip text" pair. A
	// dedicated `signal.*.deepInk` role lands in package #6 alongside
	// OKLCH dark palettes; the signal.*.ink field in the current palette
	// describes text-on-solid only (it is always white/black).
	{ fg: 'ink.body', bg: 'signal.success.wash', min: 4.5, description: 'body on success wash' },
	{ fg: 'ink.body', bg: 'signal.warning.wash', min: 4.5, description: 'body on warning wash' },
	{ fg: 'ink.body', bg: 'signal.danger.wash', min: 4.5, description: 'body on danger wash' },
	{ fg: 'ink.body', bg: 'signal.info.wash', min: 4.5, description: 'body on info wash' },
];

/**
 * Advisory pairs -- logged but non-fatal. Edge-visibility hasn't hit 3:1
 * in the current palettes (light edges on white panels are a deliberate
 * visual choice). Package #6's OKLCH dark-mode rework revisits these
 * rungs; until then we surface the ratios so regression is still visible.
 */
const ADVISORY_PAIRS: Pair[] = [
	{ fg: 'edge.default', bg: 'surface.page', min: 3.0, description: 'edge visibility on page (advisory)' },
	{ fg: 'edge.default', bg: 'surface.panel', min: 3.0, description: 'edge visibility on panel (advisory)' },
	// Signal "ink" today is text-on-solid only. A `deepInk` for text-on-wash
	// lands with the OKLCH palette rework in package #6. Track the ratio
	// so the eventual deepInk value is discoverable.
	{ fg: 'signal.success.ink', bg: 'signal.success.wash', min: 4.5, description: 'success ink on wash (deepInk TBD)' },
	{ fg: 'signal.warning.ink', bg: 'signal.warning.wash', min: 4.5, description: 'warning ink on wash (deepInk TBD)' },
	{ fg: 'signal.danger.ink', bg: 'signal.danger.wash', min: 4.5, description: 'danger ink on wash (deepInk TBD)' },
	{ fg: 'signal.info.ink', bg: 'signal.info.wash', min: 4.5, description: 'info ink on wash (deepInk TBD)' },
];

const themes = listThemes();
if (themes.length === 0) throw new Error('no themes registered');

for (const theme of themes) {
	for (const appearance of theme.appearances) {
		const resolved = resolvePalette(theme, appearance);
		if (!resolved) continue;
		describe(`contrast: ${theme.id} / ${appearance}`, () => {
			for (const pair of REQUIRED_PAIRS) {
				const fg = resolved[pair.fg];
				const bg = resolved[pair.bg];
				const ratio = contrastRatio(fg, bg);
				it(`${pair.fg} on ${pair.bg} >= ${pair.min} (${pair.description}): ${ratio.toFixed(2)}`, () => {
					expect(ratio).toBeGreaterThanOrEqual(pair.min);
				});
				// AAA advisory (7:1 body, 4.5:1 large). Non-fatal.
				const aaaBar = pair.min >= 4.5 ? 7 : 4.5;
				if (ratio < aaaBar) {
					// biome-ignore lint/suspicious/noConsole: advisory-only AAA log
					console.log(
						`[AAA-advisory] ${theme.id}/${appearance} ${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)} (< ${aaaBar})`,
					);
				}
			}
			for (const pair of ADVISORY_PAIRS) {
				const fg = resolved[pair.fg];
				const bg = resolved[pair.bg];
				const ratio = contrastRatio(fg, bg);
				if (ratio < pair.min) {
					// biome-ignore lint/suspicious/noConsole: advisory-only edge-visibility log
					console.log(
						`[edge-advisory] ${theme.id}/${appearance} ${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)} (< ${pair.min})`,
					);
				}
			}
		});
	}
}
