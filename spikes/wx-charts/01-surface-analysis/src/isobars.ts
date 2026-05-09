/**
 * Isobar contouring.
 *
 * Approach: build a sparse pressure field on a regular lon/lat grid,
 * anchored on the known H/L centers (Gaussian-ish bumps around each
 * center, modulated to the marked pressure). Then contour with
 * d3-contour at 4-mb intervals. Project the contour rings through the
 * Lambert projection.
 *
 * This is a SPIKE-grade approximation. A production pipeline would
 * ingest a real gridded SLP product (e.g. RAP/HRRR analysis or NDFD).
 * The shape and layout convey the "this is a surface chart" reading;
 * exact lobes between adjacent stations will not match WPC's hand
 * analysis pixel-for-pixel.
 */

import { geoPath, type GeoProjection } from 'd3-geo';
import { contours } from 'd3-contour';
import type { SurfaceAnalysisData, PressureCenter } from './data-load';

// Grid resolution covering CONUS extent.
const GRID_LON_MIN = -130;
const GRID_LON_MAX = -65;
const GRID_LAT_MIN = 22;
const GRID_LAT_MAX = 52;
const GRID_NX = 130; // 0.5 deg lon
const GRID_NY = 60; // 0.5 deg lat

// Background environment SLP (mb). Real fields vary; this is the
// undisturbed baseline that center bumps modulate around.
const BACKGROUND_SLP = 1015;

const ISOBAR_INTERVAL_MB = 4;
const ISOBAR_REFERENCE_MB = 1012; // standard convention: contours at 1012 +/- 4N

export function renderIsobars(projection: GeoProjection, data: SurfaceAnalysisData): string {
	const grid = buildPressureField(data.centers);
	const path = geoPath(projection);

	// Determine contour levels to draw. Span from min to max in 4-mb
	// steps anchored on 1012.
	let minVal = Number.POSITIVE_INFINITY;
	let maxVal = Number.NEGATIVE_INFINITY;
	for (const v of grid) {
		if (v < minVal) minVal = v;
		if (v > maxVal) maxVal = v;
	}
	const lowestLevel = Math.ceil((minVal - ISOBAR_REFERENCE_MB) / ISOBAR_INTERVAL_MB) * ISOBAR_INTERVAL_MB + ISOBAR_REFERENCE_MB;
	const highestLevel = Math.floor((maxVal - ISOBAR_REFERENCE_MB) / ISOBAR_INTERVAL_MB) * ISOBAR_INTERVAL_MB + ISOBAR_REFERENCE_MB;
	const levels: number[] = [];
	for (let lvl = lowestLevel; lvl <= highestLevel; lvl += ISOBAR_INTERVAL_MB) {
		levels.push(lvl);
	}

	const contourGen = contours().size([GRID_NX, GRID_NY]).thresholds(levels);
	const polys = contourGen(grid);

	const elements: string[] = [];
	const labelElements: string[] = [];

	for (const poly of polys) {
		// poly.coordinates are in grid index space [0..NX-1, 0..NY-1].
		// Convert to lon/lat then project. d3-contour returns
		// MultiPolygon coordinates -- nested rings.
		const lonLatRings = poly.coordinates.map((polygon) =>
			polygon.map((ring) =>
				ring.map(([gx, gy]) => gridToLonLat(gx, gy)),
			),
		);
		const projectedPaths = lonLatRings
			.map((polygon) => {
				const d = path({
					type: 'MultiLineString',
					coordinates: polygon.map((ring) => ring as [number, number][]),
				});
				return d ?? '';
			})
			.filter(Boolean);
		if (projectedPaths.length === 0) continue;

		const isMain = poly.value % 8 === 0; // emphasize every 8 mb
		const stroke = isMain ? '#5a5750' : '#9a9587';
		const width = isMain ? 1.0 : 0.7;
		for (const d of projectedPaths) {
			elements.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" />`);
		}

		// Place a label for this isobar at a sensible location: take the
		// outermost ring's first long-enough segment, project the midpoint.
		for (const polygon of lonLatRings) {
			for (const ring of polygon) {
				if (ring.length < 4) continue;
				const midIdx = Math.floor(ring.length / 2);
				const [lon, lat] = ring[midIdx];
				if (lon < GRID_LON_MIN + 2 || lon > GRID_LON_MAX - 2) continue;
				if (lat < GRID_LAT_MIN + 2 || lat > GRID_LAT_MAX - 2) continue;
				const pos = projection([lon, lat]);
				if (!pos) continue;
				labelElements.push(
					`<g class="isobar-label"><rect x="${(pos[0] - 11).toFixed(1)}" y="${(pos[1] - 6).toFixed(1)}" width="22" height="12" fill="#fafaf7" stroke="none" /><text x="${pos[0].toFixed(1)}" y="${(pos[1] + 3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="600" fill="#5a5750">${poly.value}</text></g>`,
				);
				break;
			}
			break;
		}
	}

	return `<g class="isobars">${elements.join('\n')}</g>\n<g class="isobar-labels">${labelElements.join('\n')}</g>`;
}

function gridToLonLat(gx: number, gy: number): [number, number] {
	const lon = GRID_LON_MIN + (gx / (GRID_NX - 1)) * (GRID_LON_MAX - GRID_LON_MIN);
	// d3-contour Y axis is image-style (top = 0). Our grid was filled
	// with lat decreasing per row index, so to invert: lat = LAT_MAX -
	// (gy/(NY-1)) * (LAT_MAX - LAT_MIN).
	const lat = GRID_LAT_MAX - (gy / (GRID_NY - 1)) * (GRID_LAT_MAX - GRID_LAT_MIN);
	return [lon, lat];
}

function buildPressureField(centers: PressureCenter[]): Float64Array {
	const grid = new Float64Array(GRID_NX * GRID_NY);
	for (let iy = 0; iy < GRID_NY; iy++) {
		const lat = GRID_LAT_MAX - (iy / (GRID_NY - 1)) * (GRID_LAT_MAX - GRID_LAT_MIN);
		for (let ix = 0; ix < GRID_NX; ix++) {
			const lon = GRID_LON_MIN + (ix / (GRID_NX - 1)) * (GRID_LON_MAX - GRID_LON_MIN);
			let p = BACKGROUND_SLP;
			for (const c of centers) {
				p += centerInfluence(c, lon, lat);
			}
			grid[iy * GRID_NX + ix] = p;
		}
	}
	return grid;
}

/**
 * Each center contributes a Gaussian bump. Magnitude = (centerPressure - BG).
 * Sigma chosen to give a roughly 1500 km half-width, comparable to a
 * synoptic-scale system. We use simple haversine-ish degree distance
 * with cos(lat) correction; exact metric distance not needed for spike.
 */
function centerInfluence(c: PressureCenter, lon: number, lat: number): number {
	const dLon = (lon - c.lon) * Math.cos((c.lat * Math.PI) / 180);
	const dLat = lat - c.lat;
	const distDeg = Math.hypot(dLon, dLat);
	const sigma = 7; // ~7 deg ~ 770 km
	const amp = c.pressureMb - BACKGROUND_SLP;
	return amp * Math.exp(-(distDeg * distDeg) / (2 * sigma * sigma));
}
