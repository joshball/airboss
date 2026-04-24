/**
 * WCAG 2.x contrast helpers.
 *
 * Accepts 6-digit hex or OKLCH (`oklch(L C H)`, `oklch(L C H / A)`,
 * `oklch(L% C H)`). Contrast dispatches on input shape so palettes
 * authored in either representation can be measured without a manual
 * pre-conversion step.
 *
 * OKLCH -> linear sRGB uses the CSS Color 4 matrices (OKLab intermediate):
 *   https://www.w3.org/TR/css-color-4/#color-conversion-code
 * rgba() / rgb() inputs are also accepted to cover translucent washes.
 */

const OKLCH_RE = /^oklch\(\s*(\d*\.?\d+%?)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+))?\s*\)$/;
const HEX_LONG_RE = /^#([0-9a-fA-F]{6})$/;
const HEX_SHORT_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;
const RGB_RE = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/;

interface LinearRgb {
	r: number;
	g: number;
	b: number;
}

export interface ParsedOklch {
	l: number;
	c: number;
	h: number;
	a: number;
}

function srgbChannelLinear(component: number): number {
	const normalized = component / 255;
	return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: string): LinearRgb | undefined {
	const long = hex.match(HEX_LONG_RE);
	if (long) {
		const raw = long[1];
		if (raw === undefined) return undefined;
		const r = Number.parseInt(raw.slice(0, 2), 16);
		const g = Number.parseInt(raw.slice(2, 4), 16);
		const b = Number.parseInt(raw.slice(4, 6), 16);
		return { r: srgbChannelLinear(r), g: srgbChannelLinear(g), b: srgbChannelLinear(b) };
	}
	const short = hex.match(HEX_SHORT_RE);
	if (short) {
		const rs = short[1];
		const gs = short[2];
		const bs = short[3];
		if (rs === undefined || gs === undefined || bs === undefined) return undefined;
		const r = Number.parseInt(`${rs}${rs}`, 16);
		const g = Number.parseInt(`${gs}${gs}`, 16);
		const b = Number.parseInt(`${bs}${bs}`, 16);
		return { r: srgbChannelLinear(r), g: srgbChannelLinear(g), b: srgbChannelLinear(b) };
	}
	return undefined;
}

function parseRgb(value: string): LinearRgb | undefined {
	const match = value.match(RGB_RE);
	if (!match) return undefined;
	const rStr = match[1];
	const gStr = match[2];
	const bStr = match[3];
	if (rStr === undefined || gStr === undefined || bStr === undefined) return undefined;
	const r = Number.parseInt(rStr, 10);
	const g = Number.parseInt(gStr, 10);
	const b = Number.parseInt(bStr, 10);
	return { r: srgbChannelLinear(r), g: srgbChannelLinear(g), b: srgbChannelLinear(b) };
}

/**
 * Parse `oklch(L C H)`, `oklch(L C H / A)`, or `oklch(L% C H)`.
 * L is normalized to [0, 1]. Alpha defaults to 1 when omitted.
 */
export function parseOklch(value: string): ParsedOklch | undefined {
	const trimmed = value.trim();
	const match = trimmed.match(OKLCH_RE);
	if (!match) return undefined;
	const lStr = match[1];
	const cStr = match[2];
	const hStr = match[3];
	const aStr = match[4];
	if (lStr === undefined || cStr === undefined || hStr === undefined) return undefined;
	const lRaw = lStr.endsWith('%') ? Number.parseFloat(lStr.slice(0, -1)) / 100 : Number.parseFloat(lStr);
	const c = Number.parseFloat(cStr);
	const h = Number.parseFloat(hStr);
	const a = aStr === undefined ? 1 : Number.parseFloat(aStr);
	if (!Number.isFinite(lRaw) || !Number.isFinite(c) || !Number.isFinite(h) || !Number.isFinite(a)) return undefined;
	return { l: lRaw, c, h, a };
}

/**
 * Convert OKLCH -> linear sRGB per CSS Color 4.
 *
 * Steps:
 *   1. OKLCH -> OKLab (polar to rectangular).
 *   2. OKLab -> LMS (cube-rooted cone responses) via inverse M2.
 *   3. Cube each LMS channel to undo the cube-root.
 *   4. LMS -> linear sRGB via inverse M1.
 *
 * Out-of-gamut values are NOT clamped -- luminance math is defined
 * on the linear values whether or not they fit in sRGB. Callers that
 * want a displayable color should clamp separately.
 */
export function oklchToLinearRgb(oklch: Pick<ParsedOklch, 'l' | 'c' | 'h'>): LinearRgb {
	const { l, c, h } = oklch;
	const hRad = (h * Math.PI) / 180;
	const a = c * Math.cos(hRad);
	const b = c * Math.sin(hRad);

	// OKLab -> LMS^(1/3) (inverse of M2)
	const lp = l + 0.3963377774 * a + 0.2158037573 * b;
	const mp = l - 0.1055613458 * a - 0.0638541728 * b;
	const sp = l - 0.0894841775 * a - 1.291485548 * b;

	// Cube to recover LMS
	const lLms = lp * lp * lp;
	const mLms = mp * mp * mp;
	const sLms = sp * sp * sp;

	// LMS -> linear sRGB (inverse of M1)
	const r = 4.0767416621 * lLms - 3.3077115913 * mLms + 0.2309699292 * sLms;
	const g = -1.2684380046 * lLms + 2.6097574011 * mLms - 0.3413193965 * sLms;
	const bLin = -0.0041960863 * lLms - 0.7034186147 * mLms + 1.707614701 * sLms;
	return { r, g, b: bLin };
}

/**
 * Convert linear sRGB -> OKLCH per CSS Color 4.
 * Inverse of `oklchToLinearRgb`: sRGB -> LMS -> cube-root -> OKLab -> OKLCH.
 */
function linearRgbToOklch(rgb: LinearRgb): ParsedOklch {
	const { r, g, b } = rgb;
	// linear sRGB -> LMS (M1)
	const lLms = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
	const mLms = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
	const sLms = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

	const lp = Math.cbrt(lLms);
	const mp = Math.cbrt(mLms);
	const sp = Math.cbrt(sLms);

	// LMS^(1/3) -> OKLab (M2)
	const l = 0.2104542553 * lp + 0.793617785 * mp - 0.0040720468 * sp;
	const aLab = 1.9779984951 * lp - 2.428592205 * mp + 0.4505937099 * sp;
	const bLab = 0.0259040371 * lp + 0.7827717662 * mp - 0.808675766 * sp;

	const c = Math.sqrt(aLab * aLab + bLab * bLab);
	// Near-zero chroma: hue is undefined; spec says to resolve to 0.
	const hDeg = c < 1e-8 ? 0 : ((Math.atan2(bLab, aLab) * 180) / Math.PI + 360) % 360;
	return { l, c, h: hDeg, a: 1 };
}

/**
 * Convert a 6-digit hex string to an OKLCH string, rounded for
 * palette authorship. Returns `undefined` if the hex is unparseable.
 *
 * Rounding:
 *   L -> 3 decimals (max 0.0005 perceptual error)
 *   C -> 3 decimals (max 0.0005 chroma)
 *   H -> 1 decimal  (max 0.05 degrees)
 *
 * These line up with the CSS Color 4 spec's recommended precision and
 * keep palette files readable.
 */
export function hexToOklch(hex: string): string | undefined {
	const rgb = parseHex(hex);
	if (!rgb) return undefined;
	const { l, c, h } = linearRgbToOklch(rgb);
	const lr = Math.round(l * 1000) / 1000;
	const cr = Math.round(c * 1000) / 1000;
	const hr = Math.round(h * 10) / 10;
	return `oklch(${lr} ${cr} ${hr})`;
}

/**
 * Relative luminance (WCAG 2.x) from a linear-sRGB triplet.
 * Y = 0.2126 R + 0.7152 G + 0.0722 B.
 */
function luminanceLinear(rgb: LinearRgb): number {
	return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

/** Relative luminance from a hex string. Returns 0 if unparseable. */
export function luminanceHex(hex: string): number {
	const rgb = parseHex(hex);
	if (!rgb) return 0;
	return luminanceLinear(rgb);
}

/** Relative luminance from a parsed OKLCH value. */
export function luminanceOklch(oklch: Pick<ParsedOklch, 'l' | 'c' | 'h'>): number {
	return luminanceLinear(oklchToLinearRgb(oklch));
}

/**
 * Resolve any supported color string to relative luminance.
 * Returns 0 for unparseable input (defensive; callers decide whether
 * to treat that as a test failure).
 */
export function luminance(value: string): number {
	const trimmed = value.trim();
	const oklch = parseOklch(trimmed);
	if (oklch) return luminanceOklch(oklch);
	if (HEX_LONG_RE.test(trimmed) || HEX_SHORT_RE.test(trimmed)) return luminanceHex(trimmed);
	const rgb = parseRgb(trimmed);
	if (rgb) return luminanceLinear(rgb);
	return 0;
}

/**
 * Contrast ratio between two colors per WCAG 2.x:
 *   (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter luminance.
 *
 * Accepts hex, OKLCH, or rgb/rgba. Black-on-white is 21:1; identical
 * colors are 1:1. Translucent colors are measured at their own
 * luminance (alpha is ignored for the ratio -- flatten via the caller
 * if compositing math is needed).
 */
export function contrastRatio(foreground: string, background: string): number {
	const lum1 = luminance(foreground);
	const lum2 = luminance(background);
	const lighter = Math.max(lum1, lum2);
	const darker = Math.min(lum1, lum2);
	return (lighter + 0.05) / (darker + 0.05);
}
