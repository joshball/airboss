/**
 * Station model rendering. Simplified vs the full FAA station model
 * (FMH-1 chapter 12), but follows the canonical layout:
 *
 *     Tmp .  Pres
 *         O    -- center: sky cover circle, with wind shaft
 *     Dew
 *
 * Center O = sky cover (open=clear, partially filled by coverage octants).
 * Wind shaft extends from O in the direction wind is FROM, with barbs
 * on the left side encoding speed (full barb = 10 kt, half = 5 kt).
 * Tmp / Dew shown in deg F. Pressure: last 3 digits of mb * 10 (FAA
 * convention: 1024.7 mb -> "247"). For spike clarity, show full mb int.
 */

import type { GeoProjection } from 'd3-geo';
import type { StationOb } from './data-load';

const STATION_RADIUS = 4;
const WIND_SHAFT_LEN = 22;
const BARB_LEN = 9;

export function renderStations(projection: GeoProjection, stations: StationOb[]): string {
	if (stations.length === 0) return '';
	return `<g class="stations">${stations.map((s) => renderStation(projection, s)).join('\n')}</g>`;
}

function renderStation(projection: GeoProjection, s: StationOb): string {
	const pos = projection([s.lon, s.lat]);
	if (!pos) return '';
	const [x, y] = pos;
	return `<g class="station" data-id="${s.id}">
  ${renderSkyCircle(x, y, s.skyCover)}
  ${renderWindBarb(x, y, s.windDir, s.windKt)}
  <text x="${x - 8}" y="${y - 6}" text-anchor="end" font-size="9" font-weight="600" fill="#3d3a32">${s.tempF}</text>
  <text x="${x - 8}" y="${y + 12}" text-anchor="end" font-size="9" font-weight="600" fill="#1f4ea8">${s.dewF}</text>
  <text x="${x + 8}" y="${y - 6}" text-anchor="start" font-size="9" font-weight="600" fill="#3d3a32">${s.pressureMb.toFixed(0)}</text>
</g>`;
}

function renderSkyCircle(x: number, y: number, sky: StationOb['skyCover']): string {
	const fill = skyFill(sky);
	const radius = STATION_RADIUS;
	if (sky === 'CLR') {
		return `<circle cx="${x}" cy="${y}" r="${radius}" fill="white" stroke="#3d3a32" stroke-width="1" />`;
	}
	if (sky === 'OVC') {
		return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#3d3a32" stroke="#3d3a32" stroke-width="1" />`;
	}
	// Partial fills: draw a clipped pie. For simplicity, render two arcs.
	const fraction = fill;
	const endAngle = -Math.PI / 2 + fraction * 2 * Math.PI;
	const ex = x + radius * Math.cos(endAngle);
	const ey = y + radius * Math.sin(endAngle);
	const largeArc = fraction > 0.5 ? 1 : 0;
	return `<g>
    <circle cx="${x}" cy="${y}" r="${radius}" fill="white" stroke="#3d3a32" stroke-width="1" />
    <path d="M ${x} ${y} L ${x} ${y - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z" fill="#3d3a32" stroke="none" />
  </g>`;
}

function skyFill(sky: StationOb['skyCover']): number {
	switch (sky) {
		case 'CLR':
			return 0;
		case 'FEW':
			return 0.25;
		case 'SCT':
			return 0.5;
		case 'BKN':
			return 0.75;
		case 'OVC':
			return 1;
	}
}

function renderWindBarb(x: number, y: number, dirDeg: number, kt: number): string {
	if (kt === 0) {
		// Calm: extra ring around the station circle.
		return `<circle cx="${x}" cy="${y}" r="${STATION_RADIUS + 3}" fill="none" stroke="#3d3a32" stroke-width="0.6" />`;
	}
	// Wind direction is FROM. Shaft points in the direction the wind is from.
	// Convert meteorological deg (N=0, clockwise) to math angle.
	const mathRad = ((90 - dirDeg) * Math.PI) / 180;
	const sx = x + STATION_RADIUS * Math.cos(mathRad);
	const sy = y - STATION_RADIUS * Math.sin(mathRad);
	const ex = x + (STATION_RADIUS + WIND_SHAFT_LEN) * Math.cos(mathRad);
	const ey = y - (STATION_RADIUS + WIND_SHAFT_LEN) * Math.sin(mathRad);

	// Barbs: full=10kt, half=5kt, pennant=50kt. Place from the outer
	// end of the shaft (away from station), perpendicular on the LEFT
	// side of the shaft direction (looking along it FROM station).
	const elements: string[] = [
		`<line x1="${sx.toFixed(2)}" y1="${sy.toFixed(2)}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}" stroke="#3d3a32" stroke-width="1" stroke-linecap="round" />`,
	];

	// Perpendicular to shaft, pointing "left" of direction-from-station.
	const px = -Math.sin(mathRad);
	const py = -Math.cos(mathRad); // negate because screen Y inverted

	let remaining = Math.round(kt / 5) * 5;
	let dist = WIND_SHAFT_LEN;
	const stepInner = 5; // px between barbs
	while (remaining > 0 && dist > 4) {
		const px0 = x + (STATION_RADIUS + dist) * Math.cos(mathRad);
		const py0 = y - (STATION_RADIUS + dist) * Math.sin(mathRad);
		if (remaining >= 50) {
			// Pennant (filled triangle) -- not rendered for the spike's
			// modest wind speeds; approximate as full barb.
			const bx = px0 + BARB_LEN * px;
			const by = py0 + BARB_LEN * py;
			const px1 = x + (STATION_RADIUS + dist - stepInner) * Math.cos(mathRad);
			const py1 = y - (STATION_RADIUS + dist - stepInner) * Math.sin(mathRad);
			elements.push(
				`<path d="M ${px0.toFixed(2)} ${py0.toFixed(2)} L ${bx.toFixed(2)} ${by.toFixed(2)} L ${px1.toFixed(2)} ${py1.toFixed(2)} Z" fill="#3d3a32" stroke="#3d3a32" stroke-width="0.5" />`,
			);
			remaining -= 50;
			dist -= stepInner;
		} else if (remaining >= 10) {
			const bx = px0 + BARB_LEN * px;
			const by = py0 + BARB_LEN * py;
			elements.push(
				`<line x1="${px0.toFixed(2)}" y1="${py0.toFixed(2)}" x2="${bx.toFixed(2)}" y2="${by.toFixed(2)}" stroke="#3d3a32" stroke-width="1" stroke-linecap="round" />`,
			);
			remaining -= 10;
			dist -= stepInner;
		} else {
			// half barb (5kt)
			const bx = px0 + (BARB_LEN / 2) * px;
			const by = py0 + (BARB_LEN / 2) * py;
			elements.push(
				`<line x1="${px0.toFixed(2)}" y1="${py0.toFixed(2)}" x2="${bx.toFixed(2)}" y2="${by.toFixed(2)}" stroke="#3d3a32" stroke-width="1" stroke-linecap="round" />`,
			);
			remaining -= 5;
			dist -= stepInner;
		}
	}

	return elements.join('\n');
}
