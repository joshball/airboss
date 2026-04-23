/**
 * OKLCH color derivation.
 *
 * Ported from peepfood-mono's `themes/utils.ts` (2026-04 snapshot). Core
 * primitives (`alpha`, `adjustBrightness`, `getContrastingTextColor`) are
 * identical. `deriveInteractiveStates` and `deriveSignalVariants` are
 * airboss-flavored with the wash/edge/disabled variants our primitives
 * already consume (peepfood's matching functions stopped at
 * base/hover/active/text and base/bg/border).
 *
 * Keep these pure -- no DOM, no window, no globals. The emit pipeline runs
 * inside `bun scripts/themes/emit.ts` where there is no browser.
 */

import type { InteractiveStates, SignalStates } from './contract';

const OKLCH_RE = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

/**
 * Add an alpha channel to an OKLCH color. The color is parsed structurally
 * so downstream composites (tints, strokes, scrims) keep the exact
 * lightness and chroma of the source.
 */
export function alpha(color: string, opacity: number): string {
	const match = OKLCH_RE.exec(color.trim());
	if (match?.[1] && match[2] && match[3]) {
		return `oklch(${match[1]} ${match[2]} ${match[3]} / ${opacity})`;
	}
	return color;
}

/**
 * Shift OKLCH lightness by `amount` while preserving chroma and hue. `amount`
 * is on the same 0..1 scale as `L` itself. Result is clamped to [0, 1] and
 * rounded to three decimals to keep emission deterministic.
 */
export function adjustBrightness(color: string, amount: number): string {
	const match = OKLCH_RE.exec(color.trim());
	if (match?.[1] && match[2] && match[3]) {
		const l = Number.parseFloat(match[1]);
		const c = match[2];
		const h = match[3];
		const raw = l + amount;
		const clamped = Math.max(0, Math.min(1, raw));
		const rounded = Math.round(clamped * 1000) / 1000;
		return `oklch(${rounded} ${c} ${h})`;
	}
	return color;
}

/**
 * Black-or-white pick for text on top of `bgColor`. Uses OKLCH perceptual
 * lightness, so the 0.5 boundary is a good approximation of "is this color
 * perceived as light or dark" across hues -- unlike YIQ/HSL math.
 */
export function getContrastingTextColor(bgColor: string): string {
	const match = OKLCH_RE.exec(bgColor.trim());
	if (match?.[1]) {
		const l = Number.parseFloat(match[1]);
		return l > 0.5 ? '#000000' : '#ffffff';
	}
	return '#ffffff';
}

/**
 * Derive the full interactive-state bundle from a single base OKLCH color.
 *
 * Light theme: hover/active darken the base. Dark theme: they lighten. Wash
 * and edge are alpha composites of the base against whatever surface the
 * component sits on -- stays readable across surface colors without having
 * to retint for every panel variant.
 */
export function deriveInteractiveStates(baseColor: string, isDark: boolean): InteractiveStates {
	return {
		base: baseColor,
		hover: adjustBrightness(baseColor, isDark ? 0.08 : -0.08),
		active: adjustBrightness(baseColor, isDark ? 0.16 : -0.16),
		wash: alpha(baseColor, isDark ? 0.18 : 0.08),
		edge: alpha(baseColor, isDark ? 0.4 : 0.24),
		ink: getContrastingTextColor(baseColor),
		disabled: alpha(baseColor, 0.4),
	};
}

/**
 * Derive the signal (success/warning/danger/info) bundle from a single base
 * OKLCH color. Signals show as solid chips, tinted banners, or thin borders;
 * the `wash`/`edge` opacities are tuned so a banner + border combination
 * stays legible on both light and dark surfaces.
 */
export function deriveSignalVariants(baseColor: string, isDark: boolean): SignalStates {
	return {
		solid: baseColor,
		wash: alpha(baseColor, isDark ? 0.12 : 0.08),
		edge: alpha(baseColor, isDark ? 0.35 : 0.25),
		ink: getContrastingTextColor(baseColor),
	};
}
