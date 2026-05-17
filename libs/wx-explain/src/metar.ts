/**
 * METAR token-walker. Produces one annotation per significant token in a
 * parsed METAR.
 *
 * The decode line is always present. The `why` line is only emitted when
 * a `TruthModel` is supplied and the lib finds a clear synoptic driver
 * (convective cell within reach, post-frontal gust on the cold side,
 * radiation cooling under a high, etc.).
 *
 * Browser-safe -- type-only import of TruthModel from wx-engine.
 */

import type { ParsedMetar } from '@ab/wx-charts';
import type { TruthModel } from '@ab/wx-engine';
import { findConvectionDriver, findFrontDriver, findRadiationCoolingDriver, kmBetween } from './truth-helpers';
import type { TokenAnnotation } from './types';

const SKY_COVER_LABEL: Record<string, string> = {
	SKC: 'sky clear (human observer)',
	CLR: 'sky clear (automated, no clouds below 12,000 ft)',
	NSC: 'no significant cloud (international)',
	FEW: 'few',
	SCT: 'scattered',
	BKN: 'broken',
	OVC: 'overcast',
	VV: 'vertical visibility (sky obscured)',
};

const WEATHER_DECODE: Record<string, string> = {
	'-RA': 'light rain',
	RA: 'moderate rain',
	'+RA': 'heavy rain',
	'-SN': 'light snow',
	SN: 'moderate snow',
	'+SN': 'heavy snow',
	'-SHSN': 'light snow shower',
	SHSN: 'moderate snow shower',
	'-TSRA': 'light thunderstorm with rain',
	TSRA: 'moderate thunderstorm with rain',
	'+TSRA': 'heavy thunderstorm with rain',
	TS: 'thunderstorm',
	'-FZRA': 'light freezing rain',
	FZRA: 'moderate freezing rain',
	'+FZRA': 'heavy freezing rain',
	FZDZ: 'freezing drizzle',
	FZFG: 'freezing fog (visibility < 5/8 SM, subfreezing temp)',
	FG: 'fog (visibility < 5/8 SM)',
	BR: 'mist (visibility 5/8-7 SM)',
	HZ: 'haze',
	BLSN: 'blowing snow',
	BLDU: 'blowing dust',
	VCTS: 'thunderstorm in the vicinity (5-10 SM)',
	VCSH: 'showers in the vicinity (5-10 SM)',
	GR: 'hail',
	GS: 'small hail / snow pellets',
};

function describeWind(parsed: ParsedMetar): TokenAnnotation[] {
	const wind = parsed.wind;
	if (!wind) return [];
	const out: TokenAnnotation[] = [];
	if (wind.calm) {
		out.push({ token: '00000KT', family: 'wind-calm', decode: 'calm (direction zero, speed zero)' });
		return out;
	}
	if (wind.variable) {
		out.push({
			token: `VRB${String(wind.speedKt).padStart(2, '0')}KT`,
			family: 'wind-vrb-low',
			decode: `variable direction at ${wind.speedKt} kt (speed below the 6-kt threshold for resolving direction)`,
		});
		return out;
	}
	const dirStr = wind.directionDeg === null ? 'VRB' : String(wind.directionDeg).padStart(3, '0');
	const baseToken = `${dirStr}${String(wind.speedKt).padStart(2, '0')}${wind.gustKt !== null ? `G${wind.gustKt}` : ''}KT`;
	const directionPart = wind.directionDeg === null ? 'variable' : `from ${wind.directionDeg} deg true`;
	out.push({
		token: baseToken,
		family: wind.gustKt !== null ? 'wind-gust' : 'wind-steady',
		decode:
			wind.gustKt !== null
				? `wind ${directionPart} at ${wind.speedKt} kt gusting ${wind.gustKt} kt (gust factor ${wind.gustKt - wind.speedKt} kt)`
				: `wind ${directionPart} at ${wind.speedKt} kt`,
	});
	return out;
}

function describeVisibility(parsed: ParsedMetar): TokenAnnotation | null {
	if (parsed.visibilitySM === null) return null;
	const sm = parsed.visibilitySM;
	let family = 'visibility-whole';
	if (sm >= 10) family = 'visibility-above-10';
	else if (sm < 3) family = 'visibility-fractional';
	const tokenText = sm >= 10 ? '10SM' : `${formatSm(sm)}SM`;
	return {
		token: tokenText,
		family,
		decode:
			sm >= 10
				? 'visibility 10 statute miles or greater (US METAR ceiling on prevailing visibility)'
				: `visibility ${formatSm(sm)} statute miles`,
	};
}

function formatSm(sm: number): string {
	if (Number.isInteger(sm)) return String(sm);
	// Render common fractions.
	if (Math.abs(sm - 0.25) < 0.01) return '1/4';
	if (Math.abs(sm - 0.5) < 0.01) return '1/2';
	if (Math.abs(sm - 0.75) < 0.01) return '3/4';
	if (Math.abs(sm - 1.5) < 0.01) return '1 1/2';
	if (Math.abs(sm - 2.5) < 0.01) return '2 1/2';
	return sm.toFixed(2);
}

function weatherFamily(code: string): string {
	if (code.startsWith('-')) return 'wx-light';
	if (code.startsWith('+')) return 'wx-heavy';
	if (code.startsWith('VC')) return 'wx-vicinity';
	if (code === 'BR' || code === 'FG' || code === 'FZFG') return 'wx-br-vs-fg';
	if (code.length > 2 && (code.includes('TS') || code.includes('SH') || code.includes('FZ'))) {
		return 'wx-descriptor-combo';
	}
	return 'wx-moderate';
}

function describeWeather(parsed: ParsedMetar): TokenAnnotation[] {
	return parsed.weather.map((code) => ({
		token: code,
		family: weatherFamily(code),
		decode: WEATHER_DECODE[code] ?? `weather code ${code}`,
	}));
}

function describeClouds(parsed: ParsedMetar): TokenAnnotation[] {
	const out: TokenAnnotation[] = [];
	let ceilingFt: number | null = null;
	for (const layer of parsed.clouds) {
		const cover = layer.cover;
		const label = SKY_COVER_LABEL[cover] ?? cover;
		let token: string;
		let decode: string;
		if (cover === 'SKC' || cover === 'CLR' || cover === 'NSC') {
			token = cover;
			decode = label;
		} else if (cover === 'VV') {
			const hundreds =
				layer.heightFtAgl !== null ? String(Math.floor(layer.heightFtAgl / 100)).padStart(3, '0') : 'xxx';
			token = `VV${hundreds}`;
			decode =
				layer.heightFtAgl !== null
					? `${label}: ${layer.heightFtAgl} ft (sky completely obscured)`
					: `${label} (sky completely obscured)`;
		} else {
			const hundreds =
				layer.heightFtAgl !== null ? String(Math.floor(layer.heightFtAgl / 100)).padStart(3, '0') : 'xxx';
			const typeSuffix = layer.cloudType ?? '';
			token = `${cover}${hundreds}${typeSuffix}`;
			const typeNote =
				layer.cloudType === 'CB'
					? ' with cumulonimbus (CB) -- convective cloud, thunderstorm risk'
					: layer.cloudType === 'TCU'
						? ' with towering cumulus (TCU) -- building convective cloud'
						: '';
			decode =
				layer.heightFtAgl !== null
					? `${label} layer at ${layer.heightFtAgl} ft AGL${typeNote}`
					: `${label} layer${typeNote}`;
			if ((cover === 'BKN' || cover === 'OVC') && ceilingFt === null && layer.heightFtAgl !== null) {
				ceilingFt = layer.heightFtAgl;
			}
		}
		// A CB-tagged layer gets the `sky-cb` family so the truth-aware `why`
		// pass can pin the convective driver to it.
		const family =
			layer.cover === 'VV'
				? 'sky-vv'
				: layer.cloudType === 'CB'
					? 'sky-cb'
					: parsed.clouds.length > 1
						? 'sky-multi-layer'
						: 'sky-single-layer';
		out.push({ token, family, decode });
	}
	if (ceilingFt !== null) {
		out.push({
			token: 'ceiling',
			family: 'sky-ceiling',
			decode: `ceiling = ${ceilingFt} ft AGL (lowest BKN/OVC layer)`,
		});
	}
	return out;
}

function describeTemp(parsed: ParsedMetar): TokenAnnotation | null {
	if (parsed.tempC === null || parsed.dewpointC === null) return null;
	const t = parsed.tempC;
	const d = parsed.dewpointC;
	const spread = t - d;
	let family: string;
	if (spread < 2) {
		family = 'temp-narrow-spread';
	} else if (t >= 0 && d >= 0) {
		family = 'temp-positive';
	} else if (t < 0 && d < 0) {
		family = 'temp-negative';
	} else {
		family = 'temp-cross-zero';
	}
	const tokenT = t < 0 ? `M${String(Math.abs(t)).padStart(2, '0')}` : String(t).padStart(2, '0');
	const tokenD = d < 0 ? `M${String(Math.abs(d)).padStart(2, '0')}` : String(d).padStart(2, '0');
	const decodeBase = `temperature ${t} deg C / dew point ${d} deg C (spread ${spread.toFixed(0)} deg)`;
	const decode = spread < 2 ? `${decodeBase}; narrow spread - close to saturation` : decodeBase;
	return { token: `${tokenT}/${tokenD}`, family, decode };
}

function describeAltimeter(parsed: ParsedMetar): TokenAnnotation | null {
	if (parsed.altimeterInHg === null) return null;
	const inHg = parsed.altimeterInHg;
	let family = 'altimeter-standard';
	if (inHg < 29.8) family = 'altimeter-low';
	else if (inHg > 30.1) family = 'altimeter-high';
	const token = `A${(inHg * 100).toFixed(0).padStart(4, '0')}`;
	const note = inHg < 29.8 ? ' (approaching/deepening low)' : inHg > 30.1 ? ' (building/established high)' : '';
	return { token, family, decode: `altimeter ${inHg.toFixed(2)} inHg${note}` };
}

function attachWhy(
	annotations: TokenAnnotation[],
	parsed: ParsedMetar,
	truth: TruthModel,
	stationLon: number | null,
	stationLat: number | null,
): TokenAnnotation[] {
	if (stationLon === null || stationLat === null) return annotations;
	const convective = findConvectionDriver(truth, stationLon, stationLat);
	const frontDriver = findFrontDriver(truth, stationLon, stationLat);
	const radiation = findRadiationCoolingDriver(truth, parsed.tempC, parsed.dewpointC);

	return annotations.map((a) => {
		// Any TS-bearing weather token (light, moderate, or heavy) gets the
		// convective `why` -- the intensity prefix changes the family but not
		// the synoptic driver. Gating on `wx-heavy` alone silently dropped the
		// `why` for moderate `TSRA`.
		const isThunderstormWeather =
			a.token.includes('TS') &&
			(a.family === 'wx-heavy' || a.family === 'wx-light' || a.family === 'wx-descriptor-combo');
		if (isThunderstormWeather && convective) {
			return { ...a, why: 'Convective cell within reach - thunderstorm rain in the cell core' };
		}
		if (a.family === 'sky-cb' && convective) {
			return { ...a, why: 'CB layer marks the convective cell directly over the station' };
		}
		if (a.family === 'wind-gust' && frontDriver && frontDriver.coldSectorSide) {
			return { ...a, why: `Post-frontal cold-sector gusts behind a ${frontDriver.intensity} cold front` };
		}
		if ((a.family === 'temp-narrow-spread' || a.family === 'wx-br-vs-fg') && radiation) {
			return { ...a, why: 'Radiation cooling overnight has driven the temp-dew spread to saturation' };
		}
		return a;
	});
}

function lookupStation(truth: TruthModel, icao: string): { lon: number; lat: number } | null {
	const rec = truth.stations[icao];
	if (!rec) return null;
	return { lon: rec.lon, lat: rec.lat };
}

/**
 * Walk a parsed METAR and produce a per-token annotation array. When
 * `truth` is supplied, each annotation may also carry a `why` line drawn
 * from the synoptic model.
 */
export function explainMetar(parsed: ParsedMetar, truth?: TruthModel): TokenAnnotation[] {
	const annotations: TokenAnnotation[] = [];
	annotations.push({
		token: parsed.station,
		family: 'station',
		decode: `ICAO station identifier ${parsed.station}`,
	});
	annotations.push({
		token: `${String(parsed.day).padStart(2, '0')}${String(parsed.hour).padStart(2, '0')}${String(parsed.minute).padStart(2, '0')}Z`,
		family: 'datetime',
		decode: `day-of-month ${parsed.day}, time ${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')} UTC`,
	});
	annotations.push(...describeWind(parsed));
	const vis = describeVisibility(parsed);
	if (vis) annotations.push(vis);
	if (parsed.cavok) {
		annotations.push({
			token: 'CAVOK',
			family: 'cavok',
			decode:
				'CAVOK -- visibility >= 10 km, no cloud below 5,000 ft (or MSA), no significant weather. International only.',
		});
	}
	annotations.push(...describeWeather(parsed));
	annotations.push(...describeClouds(parsed));
	const t = describeTemp(parsed);
	if (t) annotations.push(t);
	const a = describeAltimeter(parsed);
	if (a) annotations.push(a);

	if (truth) {
		const coords = lookupStation(truth, parsed.station);
		const lon = coords?.lon ?? null;
		const lat = coords?.lat ?? null;
		return attachWhy(annotations, parsed, truth, lon, lat);
	}
	return annotations;
}

export { kmBetween };
