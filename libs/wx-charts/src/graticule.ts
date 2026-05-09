/**
 * Graticule renderer: dashed lat/lon grid lines for any projection.
 *
 * Defaults match the Phase A surface analysis baseline (10 deg meridians
 * from -130 to -65, 5 deg parallels from 25 to 50; light gray dashed).
 *
 * Browser-safe: pure d3-geo path generation, no Node imports.
 */

import { type GeoProjection, geoPath } from 'd3-geo';

export interface GraticuleOptions {
	lonMin?: number;
	lonMax?: number;
	latMin?: number;
	latMax?: number;
	lonStep?: number;
	latStep?: number;
	stroke?: string;
	strokeWidth?: number;
	dashArray?: string;
}

const DEFAULT_OPTS: Required<GraticuleOptions> = {
	lonMin: -130,
	lonMax: -65,
	latMin: 20,
	latMax: 55,
	lonStep: 10,
	latStep: 5,
	stroke: '#e0ddd2',
	strokeWidth: 0.4,
	dashArray: '2 3',
};

/**
 * Render a CONUS-default lat/lon graticule for the given projection.
 * Returns the inner SVG fragment (no wrapping `<g>`); the caller wraps
 * it inside the `graticule` layer band.
 */
export function renderGraticule(projection: GeoProjection, options: GraticuleOptions = {}): string {
	const opts = { ...DEFAULT_OPTS, ...options };
	const path = geoPath(projection);
	const lines: string[] = [];

	for (let lon = opts.lonMin; lon <= opts.lonMax; lon += opts.lonStep) {
		const coords: [number, number][] = [];
		for (let lat = opts.latMin; lat <= opts.latMax; lat += 1) coords.push([lon, lat]);
		const d = path({ type: 'LineString', coordinates: coords });
		if (d !== null) {
			lines.push(
				`<path d="${d}" fill="none" stroke="${opts.stroke}" stroke-width="${opts.strokeWidth}" stroke-dasharray="${opts.dashArray}" />`,
			);
		}
	}
	for (let lat = Math.ceil(opts.latMin / opts.latStep) * opts.latStep; lat <= opts.latMax; lat += opts.latStep) {
		const coords: [number, number][] = [];
		for (let lon = opts.lonMin; lon <= opts.lonMax; lon += 1) coords.push([lon, lat]);
		const d = path({ type: 'LineString', coordinates: coords });
		if (d !== null) {
			lines.push(
				`<path d="${d}" fill="none" stroke="${opts.stroke}" stroke-width="${opts.strokeWidth}" stroke-dasharray="${opts.dashArray}" />`,
			);
		}
	}

	return lines.join('\n');
}
