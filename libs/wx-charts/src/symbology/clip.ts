/**
 * SVG clip-path helper for the CONUS-projection chart family.
 *
 * Scalar-field renderers (isobars, filled altitude bands, severity
 * contours, GTG tiers) compute over the full pressure / scalar grid
 * extent (typically lon -130..-65, lat 22..52), which crosses the
 * Canada / Mexico border. Drawing those contours unmasked produces the
 * "hunchback" arc above the US-Canada border first surfaced in
 * surface-analysis output. The fix is structural rather than data-side:
 * compute contours over the full grid (so isobars stay continuous along
 * the border), then clip the SVG fragment to the CONUS union polygon.
 *
 * `buildConusClipPath` projects the polygon once per chart, emits a
 * `<defs><clipPath /></defs>` block with a unique id, and returns the
 * matching `clip-path="url(#id)"` attribute string the renderer wraps
 * around its vector-symbology / raster-overlay layer band content.
 *
 * Browser-safe: pure d3-geo + string templating, no Node imports.
 */

import { type GeoProjection, geoPath } from 'd3-geo';
import type { Feature, MultiPolygon } from 'geojson';

export interface BuildConusClipPathOptions {
	/** Unique id for the clipPath element. Caller must namespace per chart. */
	id: string;
	/** Closed CONUS union polygon. Use `BasemapData.conusPolygon`. */
	conusPolygon: Feature<MultiPolygon>;
	/** Projection currently used to draw the basemap + symbology. */
	projection: GeoProjection;
}

export interface ConusClipPath {
	/** `<defs><clipPath><path /></clipPath></defs>` fragment. */
	defs: string;
	/** SVG attribute string: `clip-path="url(#id)"`. */
	clipAttr: string;
}

/**
 * Sanitize a chart slug for safe use as an SVG id. SVG ids must not
 * contain whitespace and should avoid characters that bleed into URL
 * parsing of `url(#...)`. Strip everything outside ASCII letters,
 * digits, underscore, and hyphen.
 */
export function sanitizeClipId(raw: string): string {
	return raw.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * Build the `<defs>` block + clip-path attribute for the supplied CONUS
 * polygon, projected with the supplied projection. When the projection
 * fails to serialize the polygon (returns `null`), the defs fragment is
 * empty and the clip attribute is the empty string -- the renderer's
 * output remains valid SVG, just unclipped.
 */
export function buildConusClipPath(opts: BuildConusClipPathOptions): ConusClipPath {
	const { id, conusPolygon, projection } = opts;
	const path = geoPath(projection);
	const d = path(conusPolygon);
	if (d === null || d.length === 0) {
		return { defs: '', clipAttr: '' };
	}
	const defs = `<defs><clipPath id="${id}"><path d="${d}" /></clipPath></defs>`;
	const clipAttr = `clip-path="url(#${id})"`;
	return { defs, clipAttr };
}
