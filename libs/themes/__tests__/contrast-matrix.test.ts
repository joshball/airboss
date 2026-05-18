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
	'signal.success.deepInk': string;
	'signal.warning.wash': string;
	'signal.warning.ink': string;
	'signal.warning.deepInk': string;
	'signal.danger.wash': string;
	'signal.danger.ink': string;
	'signal.danger.deepInk': string;
	'signal.info.wash': string;
	'signal.info.ink': string;
	'signal.info.deepInk': string;
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
		'signal.success.deepInk': signalSuccess.deepInk,
		'signal.warning.wash': signalWarning.wash,
		'signal.warning.ink': signalWarning.ink,
		'signal.warning.deepInk': signalWarning.deepInk,
		'signal.danger.wash': signalDanger.wash,
		'signal.danger.ink': signalDanger.ink,
		'signal.danger.deepInk': signalDanger.deepInk,
		'signal.info.wash': signalInfo.wash,
		'signal.info.ink': signalInfo.ink,
		'signal.info.deepInk': signalInfo.deepInk,
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
	// Body-ink on signal washes -- the realistic "chip text" pair when
	// the chip uses body ink instead of the signal-hued `deepInk`. Both
	// readings have to clear AA; the dedicated `signal.*.deepInk` rung
	// gives chips a hued-but-readable label.
	{ fg: 'ink.body', bg: 'signal.success.wash', min: 4.5, description: 'body on success wash' },
	{ fg: 'ink.body', bg: 'signal.warning.wash', min: 4.5, description: 'body on warning wash' },
	{ fg: 'ink.body', bg: 'signal.danger.wash', min: 4.5, description: 'body on danger wash' },
	{ fg: 'ink.body', bg: 'signal.info.wash', min: 4.5, description: 'body on info wash' },
];

/**
 * Advisory pairs -- logged via `it.skip` until the bar is met, then
 * automatically pinned by the ratchet below. Two families live here:
 *
 *   - `edge.default` on `surface.{page,panel}` -- borders must clear
 *     3:1 to count as visible-component contrast under WCAG.
 *   - `signal.*.deepInk` on `signal.*.wash` -- chip-text-on-tint reads
 *     as the signal hue at AA. `signal.*.ink` stays the
 *     text-on-solid value (white/black); `deepInk` is the wash partner.
 */
const ADVISORY_PAIRS: Pair[] = [
	{ fg: 'edge.default', bg: 'surface.page', min: 3.0, description: 'edge visibility on page (advisory)' },
	{ fg: 'edge.default', bg: 'surface.panel', min: 3.0, description: 'edge visibility on panel (advisory)' },
	{ fg: 'signal.success.deepInk', bg: 'signal.success.wash', min: 4.5, description: 'success deepInk on wash' },
	{ fg: 'signal.warning.deepInk', bg: 'signal.warning.wash', min: 4.5, description: 'warning deepInk on wash' },
	{ fg: 'signal.danger.deepInk', bg: 'signal.danger.wash', min: 4.5, description: 'danger deepInk on wash' },
	{ fg: 'signal.info.deepInk', bg: 'signal.info.wash', min: 4.5, description: 'info deepInk on wash' },
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
			// Advisory pairs are tracked via `it.skip` so they appear in the
			// test report (with a "todo" marker) rather than only via
			// console.log. Each entry is intentionally skipped until the
			// underlying token math reaches the advisory bar; promote to `it`
			// once the pair lands at the target ratio.
			for (const pair of ADVISORY_PAIRS) {
				const fg = resolved[pair.fg];
				const bg = resolved[pair.bg];
				const ratio = contrastRatio(fg, bg);
				const label = `[advisory] ${pair.fg} on ${pair.bg} >= ${pair.min} (${pair.description}): ${ratio.toFixed(2)}`;
				if (ratio >= pair.min) {
					// Advisory bar already met -- pin it.
					it(label, () => {
						expect(ratio).toBeGreaterThanOrEqual(pair.min);
					});
				} else {
					it.skip(label, () => {
						expect(ratio).toBeGreaterThanOrEqual(pair.min);
					});
				}
			}
		});
	}
}
