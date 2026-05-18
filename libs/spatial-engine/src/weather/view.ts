// @browser-globals: server-only -- never imported by client .svelte
/**
 * Layer-3 (weather) view loader.
 *
 * `loadWeatherForScenario(wxScenarioSlug, validAt)` reads the wx-engine
 * output -- `data/wx-scenarios/<slug>/truth.json` for station coordinates
 * and AIRMET source polygons, plus `products/*.json` for the derived
 * METARs / TAFs / FB winds / AIRMETs -- and projects per-waypoint queries.
 *
 * Projection per waypoint:
 *  - nearest METAR (by great-circle distance to the source station)
 *  - nearest TAF
 *  - interpolated winds aloft (nearest FB station's altitude rows)
 *  - AIRMET membership (point-in-polygon against each AIRMET ring)
 *
 * Note: the `frontal-xc-march` wx scenario is a Midwest XC (KSTL -> KORD);
 * the v1 route is in the Memphis sectional. The viewer composes them per
 * the spec's "nearest station" projection contract -- the geographic
 * offset is an accepted v1 simplification (the killer-feature thesis is
 * "claims are derivable", not "geographically co-located"). The projected
 * METAR / TAF carry their source-station distance so the UI can be honest
 * about the offset.
 *
 * Caches per process by `(slug, validAt)`.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Layer composition
 * contracts" -> "Layer 3".
 */

import { AIRMET_FAMILY_VALUES, type AirmetFamily, type WxScenario } from '@ab/constants';
import { greatCircleNm } from '../flight/geometry';
import type { Waypoint } from '../flight/types';
import { joinPath, listDir, REPO_ROOT, readJson } from '../fs-util';
import { classifyFlightCategory, lowestCeilingFtAgl } from './flight-category';
import type {
	AirmetView,
	ChartRef,
	FlightCategory,
	WaypointMetarView,
	WaypointTafView,
	WaypointWxView,
	WindAtWaypoint,
	WxBundleView,
} from './types';

// --- Shapes of the wx-engine output files (the bits the viewer reads) ---

interface TruthStation {
	icao: string;
	lon: number;
	lat: number;
	elevationFt: number;
	name: string;
}

interface TruthFile {
	validAt: string;
	stations: Record<string, TruthStation>;
}

interface MetarCloud {
	cover: string;
	heightFtAgl: number;
}

interface MetarRecord {
	station: string;
	visibilitySM: number;
	clouds: MetarCloud[];
	raw: string;
}

interface TafPeriod {
	start: string;
	end: string;
	raw: string;
	visibilitySM: number;
	clouds: MetarCloud[];
}

interface TafRecord {
	station: string;
	periods: TafPeriod[];
}

interface FbRow {
	altitudeFt: number;
	directionDeg: number;
	speedKt: number;
	temperatureC: number | null;
}

interface FbStation {
	station: string;
	rows: FbRow[];
}

interface FbBulletin {
	stations: FbStation[];
}

interface AirmetRecord {
	id: string;
	kind: string;
	label: string;
	rings: number[][][];
	validFrom: string;
	validTo: string;
}

const cache = new Map<string, WxBundleView>();

/** The directory holding a wx-engine scenario bundle. */
export function wxScenarioDir(slug: WxScenario): string {
	return joinPath(REPO_ROOT, 'data', 'wx-scenarios', slug);
}

/**
 * Resolve a wx-product station code to a `[lon, lat]` via the truth
 * model's station map. Product stations may be 3- or 4-letter; the truth
 * map keys on the 4-letter ICAO. Returns null when the code does not
 * resolve.
 */
function resolveStationLonLat(
	stations: Record<string, TruthStation>,
	station: string,
): readonly [number, number] | null {
	const direct = stations[station];
	if (direct) return [direct.lon, direct.lat];
	// FB bulletins use the 3-letter code (STL); the truth map uses KSTL.
	const prefixed = stations[`K${station}`];
	if (prefixed) return [prefixed.lon, prefixed.lat];
	return null;
}

/** Standard ray-casting point-in-polygon. `ring` is a closed `[lon, lat]` loop. */
export function pointInRing(point: readonly [number, number], ring: ReadonlyArray<readonly [number, number]>): boolean {
	const [x, y] = point;
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

/** Whether a point sits inside any ring of an AIRMET. */
function pointInAirmet(point: readonly [number, number], airmet: AirmetView): boolean {
	return airmet.rings.some((ring) => pointInRing(point, ring));
}

/** Map a wx-engine AIRMET `kind` discriminator to the `AirmetFamily` enum. */
function toAirmetFamily(kind: string): AirmetFamily {
	if ((AIRMET_FAMILY_VALUES as readonly string[]).includes(kind)) {
		return kind as AirmetFamily;
	}
	// The wx engine emits `airmet-sierra` etc.; default to Sierra if unknown.
	return 'airmet-sierra';
}

/** Compute the flight category of the worst METAR cloud + visibility. */
function metarFlightCategory(metar: MetarRecord): FlightCategory {
	const ceiling = lowestCeilingFtAgl(metar.clouds);
	return classifyFlightCategory(ceiling, metar.visibilitySM);
}

/**
 * Pick the TAF period covering `validAt` (or the last period when the
 * timestamp falls outside) and classify its flight category.
 */
function tafArrivalCategory(taf: TafRecord, validAt: string): { category: FlightCategory; raw: string } {
	const t = Date.parse(validAt);
	const covering =
		taf.periods.find((p) => Date.parse(p.start) <= t && t < Date.parse(p.end)) ?? taf.periods[taf.periods.length - 1];
	const ceiling = lowestCeilingFtAgl(covering?.clouds ?? []);
	return {
		category: classifyFlightCategory(ceiling, covering?.visibilitySM ?? 99),
		raw: taf.periods.map((p) => p.raw).join(' '),
	};
}

/**
 * Load + project the weather view for a wx-engine scenario onto a set of
 * route waypoints.
 */
export function loadWeatherForScenario(
	wxScenarioSlug: WxScenario,
	validAt: string,
	waypoints: ReadonlyArray<Waypoint>,
): WxBundleView {
	const cacheKey = `${wxScenarioSlug}::${validAt}::${waypoints.map((w) => w.id).join(',')}`;
	const cached = cache.get(cacheKey);
	if (cached) return cached;

	const dir = wxScenarioDir(wxScenarioSlug);
	const truth = readJson<TruthFile>(joinPath(dir, 'truth.json'));
	const metars = readJson<MetarRecord[]>(joinPath(dir, 'products', 'metars.json'));
	const tafs = readJson<TafRecord[]>(joinPath(dir, 'products', 'tafs.json'));
	const fb = readJson<FbBulletin>(joinPath(dir, 'products', 'fb-bulletin.json'));
	const airmetRecords = readJson<AirmetRecord[]>(joinPath(dir, 'products', 'airmets.json'));

	const airmets: AirmetView[] = airmetRecords.map((a) => ({
		id: a.id,
		family: toAirmetFamily(a.kind),
		label: a.label,
		rings: a.rings.map((ring) => ring.map((pt) => [pt[0], pt[1]] as const)),
		validFrom: a.validFrom,
		validTo: a.validTo,
	}));

	const byWaypoint: Record<string, WaypointWxView> = {};
	for (const wp of waypoints) {
		const point: readonly [number, number] = [wp.lon, wp.lat];

		// Nearest METAR.
		let metar: WaypointMetarView | null = null;
		let bestMetarDist = Number.POSITIVE_INFINITY;
		for (const m of metars) {
			const coord = resolveStationLonLat(truth.stations, m.station);
			if (!coord) continue;
			const d = greatCircleNm(wp.lon, wp.lat, coord[0], coord[1]);
			if (d < bestMetarDist) {
				bestMetarDist = d;
				metar = {
					station: m.station,
					raw: m.raw,
					flightCategory: metarFlightCategory(m),
					stationDistanceNm: d,
				};
			}
		}

		// Nearest TAF -- only projected for airport waypoints.
		let taf: WaypointTafView | null = null;
		if (wp.kind === 'airport') {
			let bestTafDist = Number.POSITIVE_INFINITY;
			for (const t of tafs) {
				const coord = resolveStationLonLat(truth.stations, t.station);
				if (!coord) continue;
				const d = greatCircleNm(wp.lon, wp.lat, coord[0], coord[1]);
				if (d < bestTafDist) {
					bestTafDist = d;
					const arrival = tafArrivalCategory(t, validAt);
					taf = {
						station: t.station,
						raw: arrival.raw,
						arrivalFlightCategory: arrival.category,
						stationDistanceNm: d,
					};
				}
			}
		}

		// Winds aloft -- nearest FB station's altitude rows.
		let windsAloft: WindAtWaypoint[] = [];
		let bestFbDist = Number.POSITIVE_INFINITY;
		for (const station of fb.stations) {
			const coord = resolveStationLonLat(truth.stations, station.station);
			if (!coord) continue;
			const d = greatCircleNm(wp.lon, wp.lat, coord[0], coord[1]);
			if (d < bestFbDist) {
				bestFbDist = d;
				windsAloft = station.rows.map((r) => ({
					altitudeFtMsl: r.altitudeFt,
					directionDeg: r.directionDeg,
					speedKt: r.speedKt,
					temperatureC: r.temperatureC,
				}));
			}
		}

		// AIRMET membership.
		const airmetIds = airmets.filter((a) => pointInAirmet(point, a)).map((a) => a.id);

		byWaypoint[wp.id] = {
			waypointId: wp.id,
			metar,
			taf,
			windsAloft,
			airmetIds,
		};
	}

	const charts: ChartRef[] = listCharts(dir);

	const view: WxBundleView = {
		wxScenarioSlug,
		truthValidAt: truth.validAt,
		byWaypoint,
		airmets,
		charts,
	};

	cache.set(cacheKey, view);
	return view;
}

/** Enumerate the chart artifacts available in a wx-engine scenario bundle. */
function listCharts(dir: string): ChartRef[] {
	const chartsDir = joinPath(dir, 'charts');
	return listDir(chartsDir)
		.filter((name) => !name.startsWith('.'))
		.map((name) => ({ kind: name.replace(/\.[^.]+$/, ''), slug: name }));
}

/** Clear the per-process weather-view cache. Test-only. */
export function clearWeatherCache(): void {
	cache.clear();
}
