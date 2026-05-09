/**
 * Ingest archived METARs for 50 CONUS ASOS stations at 2024-01-13 12Z
 * from the Iowa Environmental Mesonet ASOS archive.
 *
 * IEM exposes a /cgi-bin/request/asos.py endpoint that returns CSV of
 * historical observations. We request a 1-hour window (12:00Z..13:00Z)
 * for each station, parse the CSV, and for each station pick the
 * observation with the smallest absolute time delta from 12:00Z.
 *
 * Why a 1-hour window instead of asking for exactly 12:00Z: ASOS
 * routine observations are at ~:53 of every hour, not on the hour.
 * The 12:53Z report is the "12Z observation" in operational use.
 * Special reports (SPECI) can land at any minute; we accept whichever
 * report is closest to 12:00Z.
 *
 * Output: data/metars-2024-01-13-12z.json -- one record per station
 * with the raw METAR string, parsed shape, and lat/lon.
 *
 * To re-run:
 *   bun spikes/wx-charts/03-metar-plot-grid/src/ingest.ts
 *
 * Requires network access to mesonet.agron.iastate.edu.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STATIONS, type StationLocation } from './stations-conus';
import { parseMetar, type ParsedMetar } from './metar';

const TARGET_DATE = '2024-01-13';
const TARGET_HOUR = 12;
const WINDOW_HOURS = 2; // ask for 11Z..13Z and pick closest to 12:00Z

interface StationObservation {
	station: StationLocation;
	raw: string;
	parsed: ParsedMetar;
	observedAt: string; // ISO
	deltaMinutes: number; // |obs - 12:00Z|
}

function buildIemUrl(asosIds: readonly string[]): string {
	const start = new Date(`${TARGET_DATE}T${pad(TARGET_HOUR - 1)}:00:00Z`);
	const end = new Date(`${TARGET_DATE}T${pad(TARGET_HOUR + WINDOW_HOURS - 1)}:00:00Z`);
	const params = new URLSearchParams();
	for (const id of asosIds) params.append('station', id);
	params.set('data', 'metar');
	params.set('year1', String(start.getUTCFullYear()));
	params.set('month1', String(start.getUTCMonth() + 1));
	params.set('day1', String(start.getUTCDate()));
	params.set('hour1', String(start.getUTCHours()));
	params.set('minute1', '0');
	params.set('year2', String(end.getUTCFullYear()));
	params.set('month2', String(end.getUTCMonth() + 1));
	params.set('day2', String(end.getUTCDate()));
	params.set('hour2', String(end.getUTCHours()));
	params.set('minute2', '0');
	params.set('tz', 'Etc/UTC');
	params.set('format', 'onlycomma');
	params.set('latlon', 'no');
	params.set('elev', 'no');
	params.set('missing', 'M');
	params.set('trace', 'T');
	params.set('direct', 'no');
	// report_type accepts multiple values; use append, not set. 3=METAR, 4=SPECI.
	params.append('report_type', '3');
	params.append('report_type', '4');
	return `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?${params.toString()}`;
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

async function fetchAllBulk(stations: readonly StationLocation[]): Promise<Map<string, StationObservation>> {
	// One bulk fetch -- IEM accepts multiple station= params and returns
	// all of them in one CSV. Avoids per-station rate limiting (the
	// per-IP throttle on this endpoint is aggressive).
	const ids = stations.map((s) => s.asos);
	const url = buildIemUrl(ids);
	const resp = await fetch(url, {
		headers: { 'User-Agent': 'airboss-spike-3 (joshua.g.s.ball@gmail.com)' },
	});
	if (!resp.ok) {
		throw new Error(`bulk fetch failed: HTTP ${resp.status}`);
	}
	const csv = await resp.text();
	const lines = csv.split('\n').filter((l) => l.trim().length > 0 && !l.startsWith('#'));
	if (lines.length < 2) throw new Error(`bulk fetch: no data rows. body[0..200]: ${csv.slice(0, 200)}`);

	const header = lines[0].split(',');
	const stationCol = header.indexOf('station');
	const validCol = header.indexOf('valid');
	const metarCol = header.indexOf('metar');
	if (metarCol === -1) throw new Error(`no 'metar' column in header: ${header.join(',')}`);
	if (stationCol === -1) throw new Error(`no 'station' column in header: ${header.join(',')}`);
	if (validCol === -1) throw new Error(`no 'valid' column in header: ${header.join(',')}`);

	const byAsos = new Map<string, StationLocation>();
	for (const s of stations) byAsos.set(s.asos, s);
	const target = new Date(`${TARGET_DATE}T${pad(TARGET_HOUR)}:00:00Z`).getTime();
	const best = new Map<string, StationObservation>();

	for (let i = 1; i < lines.length; i += 1) {
		const cols = parseCsvRow(lines[i]);
		const stationId = cols[stationCol];
		const valid = cols[validCol];
		const metarRaw = cols[metarCol];
		if (!stationId || !valid || !metarRaw || metarRaw === 'M') continue;
		const station = byAsos.get(stationId);
		if (!station) continue;
		const obsDate = new Date(`${valid.replace(' ', 'T')}:00Z`);
		const delta = Math.abs(obsDate.getTime() - target) / 60000;
		try {
			const parsed = parseMetar(metarRaw);
			const candidate: StationObservation = {
				station,
				raw: metarRaw,
				parsed,
				observedAt: obsDate.toISOString(),
				deltaMinutes: Math.round(delta),
			};
			const existing = best.get(stationId);
			if (!existing || candidate.deltaMinutes < existing.deltaMinutes) best.set(stationId, candidate);
		} catch (err) {
			console.warn(`  parse ${stationId} "${metarRaw}": ${(err as Error).message}`);
		}
	}

	return best;
}

function parseCsvRow(line: string): string[] {
	// IEM data doesn't quote METAR strings -- tokens are comma-separated;
	// the METAR field contains spaces but no commas, so a naive split works.
	return line.split(',');
}

async function fetchInBatches(
	stations: readonly StationLocation[],
	batchSize: number,
): Promise<Map<string, StationObservation>> {
	const merged = new Map<string, StationObservation>();
	for (let i = 0; i < stations.length; i += batchSize) {
		const batch = stations.slice(i, i + batchSize);
		console.log(`  batch ${i / batchSize + 1}: ${batch.length} stations`);
		try {
			const got = await fetchAllBulk(batch);
			for (const [k, v] of got) merged.set(k, v);
		} catch (err) {
			console.warn(`  batch failed: ${(err as Error).message}`);
		}
		// Pause between batches to stay under IEM throttling.
		if (i + batchSize < stations.length) await new Promise((r) => setTimeout(r, 2500));
	}
	return merged;
}

async function main(): Promise<void> {
	const root = resolve(import.meta.dir, '..');
	console.log(`bulk fetching ${STATIONS.length} stations from IEM (in batches of 12)...`);
	let byStation = await fetchInBatches(STATIONS, 12);
	const missingFirstPass = STATIONS.filter((s) => !byStation.has(s.asos));
	if (missingFirstPass.length > 0) {
		console.log(`\n${missingFirstPass.length} stations missing after pass 1 -- retrying after 5s pause...`);
		await new Promise((r) => setTimeout(r, 5000));
		const retry = await fetchInBatches(missingFirstPass, 8);
		for (const [k, v] of retry) byStation.set(k, v);
	}
	console.log(`  -> ${byStation.size} stations returned`);

	const out: StationObservation[] = [];
	for (const s of STATIONS) {
		const obs = byStation.get(s.asos);
		if (obs) {
			out.push(obs);
			console.log(`${s.icao}: ${obs.observedAt} (d=${obs.deltaMinutes}m): ${obs.raw.slice(0, 70)}...`);
		} else {
			console.warn(`${s.icao}: NO OBSERVATION`);
		}
	}

	const outPath = resolve(root, 'data', 'metars-2024-01-13-12z.json');
	writeFileSync(
		outPath,
		`${JSON.stringify(
			{
				targetTimestamp: `${TARGET_DATE}T${pad(TARGET_HOUR)}:00:00Z`,
				source: 'IEM ASOS Archive (https://mesonet.agron.iastate.edu)',
				fetchedAt: new Date().toISOString(),
				count: out.length,
				observations: out,
			},
			null,
			'\t',
		)}\n`,
	);
	console.log(`\nWrote ${outPath} -- ${out.length}/${STATIONS.length} stations`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
