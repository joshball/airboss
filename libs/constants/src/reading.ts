/**
 * Reading-pref tokens (WP-FLIGHTBAG-READER-UX Phase 3).
 *
 * Five user preferences govern long-form-reading typography across the
 * flightbag and study apps. Each lives as a `study.user_pref` row keyed
 * under the `study.reading.*` namespace and validated against one of the
 * closed value sets below. The `<ReadableScope>` component sets the
 * matching `--reader-*` CSS variables on a wrapper div from the user's
 * stored values; reader components (`<RenderedSection>`, `<TOCDrawer>`,
 * `<TOCRender>`, knowledge-node bodies) consume those variables with
 * theme-token fallbacks so anonymous users still see the platform default.
 *
 * Defaults: serif body, scale 1.0, comfortable density (1.65 line-height),
 * normal measure (72ch), heading-scale 1.0. The serif default deliberately
 * differs from the platform's UI font (sans) because long-form prose reads
 * better in serif at body sizes -- the reader is a book first, not a UI.
 */

export const READING_FONT_FAMILIES = {
	SERIF: 'serif',
	SANS: 'sans',
	MONO: 'mono',
} as const;

export type ReadingFontFamily = (typeof READING_FONT_FAMILIES)[keyof typeof READING_FONT_FAMILIES];

export const READING_FONT_FAMILY_VALUES: readonly ReadingFontFamily[] = Object.values(READING_FONT_FAMILIES);

/** Default body font family for reader prose. Serif because long-form prose reads better in serif. */
export const READING_FONT_FAMILY_DEFAULT: ReadingFontFamily = READING_FONT_FAMILIES.SERIF;

/**
 * Discrete font-scale stops, multiplied against `--font-size-base`. Five
 * stops bracket the default 1.0: two smaller, two larger, plus an extra
 * "very large" 1.5 for low-vision users. A continuous slider would be
 * harder to keep grid-aligned across the layout; discrete stops match
 * the design intent better.
 */
export const READING_FONT_SCALES = [0.85, 0.9, 1.0, 1.1, 1.25, 1.5] as const;

export type ReadingFontScale = (typeof READING_FONT_SCALES)[number];

export const READING_FONT_SCALE_VALUES: readonly ReadingFontScale[] = READING_FONT_SCALES;

/** Default font scale (1.0 = base). */
export const READING_FONT_SCALE_DEFAULT: ReadingFontScale = 1.0;

export const READING_DENSITIES = {
	COMPACT: 'compact',
	COMFORTABLE: 'comfortable',
	SPACIOUS: 'spacious',
} as const;

export type ReadingDensity = (typeof READING_DENSITIES)[keyof typeof READING_DENSITIES];

export const READING_DENSITY_VALUES: readonly ReadingDensity[] = Object.values(READING_DENSITIES);

/** Default density (`comfortable` = 1.65 line-height, matches `--type-reading-body-line-height`). */
export const READING_DENSITY_DEFAULT: ReadingDensity = READING_DENSITIES.COMFORTABLE;

/**
 * Line-height per density. `comfortable` matches the platform's existing
 * `--line-height-relaxed` so a user who hasn't expressed a preference
 * sees identical rendering to pre-WP behavior.
 */
export const READING_DENSITY_LINE_HEIGHTS: Record<ReadingDensity, number> = {
	compact: 1.45,
	comfortable: 1.65,
	spacious: 1.85,
};

export const READING_MEASURES = {
	NARROW: 'narrow',
	NORMAL: 'normal',
	WIDE: 'wide',
} as const;

export type ReadingMeasure = (typeof READING_MEASURES)[keyof typeof READING_MEASURES];

export const READING_MEASURE_VALUES: readonly ReadingMeasure[] = Object.values(READING_MEASURES);

/** Default measure (`normal` = 72ch, the typographic sweet spot for prose). */
export const READING_MEASURE_DEFAULT: ReadingMeasure = READING_MEASURES.NORMAL;

/** Maximum body width per measure, in `ch` units (relative to font size). */
export const READING_MEASURE_CH: Record<ReadingMeasure, number> = {
	narrow: 60,
	normal: 72,
	wide: 84,
};

/**
 * Heading-scale multiplier applied on top of each heading level's base
 * scale. `1.0` keeps headings at their per-level ratio against body text;
 * `0.9` shrinks headings (denser layouts); `1.15` enlarges them
 * (skim-friendly).
 */
export const READING_HEADING_SCALES = [0.9, 1.0, 1.15] as const;

export type ReadingHeadingScale = (typeof READING_HEADING_SCALES)[number];

export const READING_HEADING_SCALE_VALUES: readonly ReadingHeadingScale[] = READING_HEADING_SCALES;

/** Default heading scale (1.0 = use the per-level ratio as-is). */
export const READING_HEADING_SCALE_DEFAULT: ReadingHeadingScale = 1.0;
