/**
 * WCAG 2.x contrast helpers.
 *
 * Operates on 6-digit hex colors. OKLCH / alpha inputs must be
 * flattened by the caller first (derive.ts does not convert to hex).
 */

function srgbChannel(component: number): number {
	const normalized = component / 255;
	return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: string): [number, number, number] | undefined {
	const match = hex.match(/^#([0-9a-fA-F]{6})$/);
	if (!match) return undefined;
	const rawGroup = match[1];
	if (rawGroup === undefined) return undefined;
	const raw = rawGroup;
	return [
		Number.parseInt(raw.slice(0, 2), 16),
		Number.parseInt(raw.slice(2, 4), 16),
		Number.parseInt(raw.slice(4, 6), 16),
	];
}

/** Relative luminance per WCAG 2.x. */
export function luminance(hex: string): number {
	const rgb = parseHex(hex);
	if (!rgb) return 0;
	const [r, g, b] = rgb;
	return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

/**
 * Contrast ratio between two hex colors per WCAG 2.x
 * `(L1 + 0.05) / (L2 + 0.05)` where L1 is the lighter luminance.
 *
 * Black-on-white is 21:1; identical colors are 1:1.
 */
export function contrastRatio(foreground: string, background: string): number {
	const lum1 = luminance(foreground);
	const lum2 = luminance(background);
	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);
	return (lighter + 0.05) / (darker + 0.05);
}
