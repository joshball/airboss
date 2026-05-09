/**
 * Preview ONE station model at a known position with a known METAR, so
 * the symbology can be eyeballed before the full grid renders.
 *
 * Usage: bun spikes/wx-charts/03-metar-plot-grid/src/preview-station.ts
 *
 * Writes spikes/wx-charts/03-metar-plot-grid/preview-station.svg.
 *
 * The METARs picked exercise the visual cases:
 *   KORD: -SN, OVC, snow + low cloud + west wind 12kt
 *   KJFK: 1/8SM FG VV, fog with vertical visibility (X glyph)
 *   KMIA: clear/scattered, light wind from S
 *   KFAR: blowing snow + VV + strong wind w/ gust
 *   KGTF: very cold, calm
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderStationModel } from './station-model';
import { parseMetar } from './metar';

interface Sample {
	label: string;
	raw: string;
}

const SAMPLES: Sample[] = [
	{ label: 'KORD (snow, OVC, west wind 12kt)', raw: 'KORD 131251Z 29012G23KT 3SM -SN BLSN FEW012 OVC018 M03/M05 A2937 RMK AO2' },
	{ label: 'KJFK (fog, VV002, 1/8SM)', raw: 'KJFK 131204Z 18018KT 1/8SM FG VV002 11/11 A2924 RMK AO2' },
	{ label: 'KMIA (sct, calm)', raw: 'KMIA 131153Z 19008KT 9SM FEW020 24/22 A2991 RMK AO2' },
	{ label: 'KFAR (blowing snow, gust, VV009)', raw: 'KFAR 131203Z 30019G28KT 1SM -SN VV009 M19/M23 A3002 RMK AO2' },
	{ label: 'KGTF (very cold, calm, clear)', raw: 'KGTF 131153Z 00000KT 10SM CLR M37/M40 A3017 RMK AO2' },
	{ label: 'KMIA (south wind 8kt SM)', raw: 'KMIA 131253Z 18045KT 5SM TS BKN025 OVC050 22/19 A2992 RMK AO2' },
	{ label: 'High wind (45 KT, north)', raw: 'TEST 131253Z 36045KT 5SM RA OVC020 05/03 A2992 RMK AO2' },
	{ label: 'High wind (65 KT, east)', raw: 'TEST 131253Z 09065KT 5SM SN OVC020 M02/M04 A2992 RMK AO2' },
];

const W = 800;
const ROW_H = 110;
const COL_W = 240;
const COLS = 3;
const ROWS = Math.ceil(SAMPLES.length / COLS);
const H = ROWS * ROW_H + 80;

const fragments: string[] = [];
fragments.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fafaf7" />`);
fragments.push(`<text x="20" y="28" font-size="16" font-weight="700" fill="#3d3a32">Station Model preview -- one glyph per cell</text>`);
fragments.push(`<text x="20" y="48" font-size="11" fill="#7a7568">Each cell shows the parsed METAR rendered at 1.5x scale. Validates wind direction, barb side, cloud-cover fill, weather glyph, temperature/dewpoint colors.</text>`);

for (let i = 0; i < SAMPLES.length; i += 1) {
	const s = SAMPLES[i];
	const col = i % COLS;
	const row = Math.floor(i / COLS);
	const cx = col * COL_W + 100;
	const cy = 80 + row * ROW_H + 50;
	fragments.push(`<g class="cell">`);
	fragments.push(`<rect x="${col * COL_W + 10}" y="${80 + row * ROW_H}" width="${COL_W - 20}" height="${ROW_H - 10}" fill="white" stroke="#e0ddd2" stroke-width="0.6" />`);
	fragments.push(`<text x="${col * COL_W + 18}" y="${80 + row * ROW_H + 16}" font-size="9" font-weight="600" fill="#3d3a32">${s.label}</text>`);
	try {
		const parsed = parseMetar(s.raw);
		// Draw inside cell at 1.5x scale via a transform group so the
		// text doesn't crowd. Just translate (no scale) for the spike --
		// the production glyph is meant for ~12px scale.
		fragments.push(`<g transform="translate(0 0)">`);
		fragments.push(renderStationModel({ parsed, cx, cy }));
		fragments.push(`</g>`);
	} catch (err) {
		fragments.push(`<text x="${cx}" y="${cy}" text-anchor="middle" font-size="10" fill="red">PARSE FAIL: ${(err as Error).message}</text>`);
	}
	fragments.push(`</g>`);
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, system-ui, sans-serif">
${fragments.join('\n')}
</svg>`;

const root = resolve(import.meta.dir, '..');
writeFileSync(resolve(root, 'preview-station.svg'), svg);
writeFileSync(
	resolve(root, 'preview-station.html'),
	`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Station Preview</title></head><body style="background:#2a2a2a;padding:20px;">${svg.replace(/^<\?xml.*?\?>\s*/, '')}</body></html>`,
);
console.log(`Wrote preview-station.svg`);

// Also -- silence unused-import warnings the bundler doesn't know about
void readFileSync;
