/**
 * Color derivation utilities.
 *
 * Ported from peepfood-mono `libs/design-system/src/themes/utils.ts`
 * (commit pre-2026-04). Core OKLCH math is unchanged. The
 * interactive-state shape is extended here with `wash` / `edge` /
 * `disabled` to match airboss's action-token contract.
 *
 * Why OKLCH: lightness shifts behave predictably across hues. HSL
 * makes derived hovers inconsistent between blue / red / yellow.
 *
 * A theme declares a *base* color per role; hover / active / wash /
 * edge / ink / disabled are derived by this file. Themes can override
 * any derived value explicitly via `palette.overrides` when the math
 * produces the wrong result (rare).
 */

import type { InteractiveStates, SignalStates } from './contract';

const OKLCH_RE = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

interface ParsedOklch {
	l: number;
	c: number;
	h: number;
}

function parseOklch(color: string): ParsedOklch | undefined {
	const match = color.match(OKLCH_RE);
	if (!match) return undefined;
	const lStr = match[1];
	const cStr = match[2];
	const hStr = match[3];
	if (lStr === undefined || cStr === undefined || hStr === undefined) return undefined;
	return { l: Number.parseFloat(lStr), c: Number.parseFloat(cStr), h: Number.parseFloat(hStr) };
}

function roundLightness(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/**
 * Append an alpha channel to an OKLCH color.
 * Returns the input unchanged if parsing fails.
 */
export function alpha(color: string, opacity: number): string {
	const parsed = parseOklch(color);
	if (!parsed) return color;
	return `oklch(${parsed.l} ${parsed.c} ${parsed.h} / ${opacity})`;
}

/**
 * Shift lightness by `amount` while preserving chroma and hue.
 * Clamps to [0, 1].
 */
export function adjustBrightness(color: string, amount: number): string {
	const parsed = parseOklch(color);
	if (!parsed) return color;
	const clamped = Math.max(0, Math.min(1, parsed.l + amount));
	const l = roundLightness(clamped);
	return `oklch(${l} ${parsed.c} ${parsed.h})`;
}

/**
 * Return `#000000` for lightness > 0.5, otherwise `#ffffff`.
 * The 0.5 threshold is a simple heuristic; explicit overrides in
 * `palette.overrides` should be used when the result is wrong for a
 * specific brand color.
 */
export function getContrastingTextColor(bgColor: string): string {
	const parsed = parseOklch(bgColor);
	if (!parsed) return '#ffffff';
	return parsed.l > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Derive the full interactive-state bundle for an action color.
 *
 * Light themes go darker on hover / active; dark themes go lighter.
 * Wash = low-opacity tint for chips / subtle buttons.
 * Edge = slightly stronger tint for subtle-variant borders.
 * Ink = contrasting text color on the solid base.
 * Disabled = 40% alpha of the base.
 */
export function deriveInteractiveStates(base: string, isDark: boolean): InteractiveStates {
	return {
		base,
		hover: adjustBrightness(base, isDark ? 0.1 : -0.1),
		active: adjustBrightness(base, isDark ? 0.2 : -0.2),
		wash: alpha(base, isDark ? 0.18 : 0.08),
		edge: alpha(base, isDark ? 0.4 : 0.24),
		ink: getContrastingTextColor(base),
		disabled: alpha(base, 0.4),
	};
}

/**
 * Derive the status/feedback bundle for a signal color.
 */
export function deriveSignalVariants(base: string, isDark: boolean): SignalStates {
	return {
		solid: base,
		wash: alpha(base, isDark ? 0.15 : 0.1),
		edge: alpha(base, isDark ? 0.3 : 0.2),
		ink: getContrastingTextColor(base),
	};
}
