/**
 * WCAG 2.x contrast-ratio helpers.
 *
 * Used by the emit pipeline (and package #3's contrast tests) to verify
 * every role-token combination a theme emits meets WCAG AA/AAA on the
 * surface it targets. Callers pass sRGB or hex; OKLCH inputs are converted
 * via the CSS parser at build time and stored as hex in the test fixtures,
 * so this helper stays tiny (no OKLCH -> sRGB math here).
 *
 * Formulae from WCAG 2.1 §1.4.3:
 *   relative luminance L = 0.2126 R + 0.7152 G + 0.0722 B
 *   where each channel c is linearized as
 *     c <= 0.03928   -> c / 12.92
 *     c  > 0.03928   -> ((c + 0.055) / 1.055) ** 2.4
 *   contrast ratio   = (L1 + 0.05) / (L2 + 0.05)
 */

export function relativeLuminance(hex: string): number {
	const rgb = hexToRgb(hex);
	if (!rgb) return 0;
	const [r, g, b] = rgb.map(channelLuminance) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
	const l1 = relativeLuminance(foregroundHex);
	const l2 = relativeLuminance(backgroundHex);
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

function channelLuminance(channel255: number): number {
	const c = channel255 / 255;
	return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: string): [number, number, number] | null {
	const trimmed = hex.trim().replace(/^#/, '');
	if (trimmed.length === 3) {
		const r = Number.parseInt(trimmed[0] + trimmed[0], 16);
		const g = Number.parseInt(trimmed[1] + trimmed[1], 16);
		const b = Number.parseInt(trimmed[2] + trimmed[2], 16);
		if ([r, g, b].some(Number.isNaN)) return null;
		return [r, g, b];
	}
	if (trimmed.length === 6) {
		const r = Number.parseInt(trimmed.slice(0, 2), 16);
		const g = Number.parseInt(trimmed.slice(2, 4), 16);
		const b = Number.parseInt(trimmed.slice(4, 6), 16);
		if ([r, g, b].some(Number.isNaN)) return null;
		return [r, g, b];
	}
	return null;
}
