/**
 * PIREP token-walker. Produces one annotation per significant field:
 * kind, location, time, altitude, aircraft type, sky cover, weather,
 * temperature, wind, turbulence, icing.
 */

import type { ParsedPirep } from '@ab/wx-charts';
import type { TruthModel } from '@ab/wx-engine';
import type { TokenAnnotation } from './types';

const TURB_DECODE: Record<string, string> = {
	NEG: 'negative turbulence (smooth)',
	LGT: 'light turbulence',
	MOD: 'moderate turbulence',
	SEV: 'severe turbulence',
	EXTM: 'extreme turbulence',
};

const ICE_DECODE: Record<string, string> = {
	NEG: 'negative icing',
	TRC: 'trace icing',
	LGT: 'light icing',
	MOD: 'moderate icing',
	SEV: 'severe icing',
};

const ICE_TYPE_DECODE: Record<string, string> = {
	RIME: 'rime ice',
	CLR: 'clear ice',
	MX: 'mixed ice (rime + clear)',
};

export function explainPirep(parsed: ParsedPirep, truth?: TruthModel): TokenAnnotation[] {
	const out: TokenAnnotation[] = [];
	out.push({
		token: parsed.kind,
		family: `pirep-${parsed.kind.toLowerCase()}`,
		decode:
			parsed.kind === 'UUA'
				? 'UUA (urgent) - severe turbulence/icing, hail, low-level wind shear, volcanic ash, or other urgent hazard'
				: 'UA (routine) - standard pilot report',
	});
	out.push({
		token: parsed.location.raw,
		family: 'pirep-location',
		decode:
			parsed.location.radialDeg !== null && parsed.location.distanceNm !== null
				? `position: ${parsed.location.distanceNm} NM on the ${parsed.location.radialDeg} deg radial from ${parsed.location.station}`
				: `position: ${parsed.location.station ?? parsed.location.raw}`,
	});
	if (parsed.timeHhmmZ !== null) {
		const t = String(parsed.timeHhmmZ).padStart(4, '0');
		out.push({
			token: t,
			family: 'pirep-time',
			decode: `report time: ${t.slice(0, 2)}:${t.slice(2)} UTC`,
		});
	}
	if (parsed.altitudeFt !== null) {
		out.push({
			token: `FL${String(Math.round(parsed.altitudeFt / 100)).padStart(3, '0')}`,
			family: 'pirep-altitude',
			decode: `altitude: ${parsed.altitudeFt} ft MSL`,
		});
	}
	if (parsed.aircraftType !== null) {
		out.push({
			token: parsed.aircraftType,
			family: 'pirep-aircraft',
			decode: `aircraft type: ${parsed.aircraftType}`,
		});
	}
	for (const layer of parsed.skyCover) {
		out.push({
			token: layer.cover,
			family: 'pirep-sky',
			decode:
				layer.baseFt !== null && layer.topFt !== null
					? `${layer.cover} layer ${layer.baseFt}-${layer.topFt} ft`
					: layer.baseFt !== null
						? `${layer.cover} base ${layer.baseFt} ft`
						: layer.cover,
		});
	}
	for (const w of parsed.weather) {
		out.push({ token: w, family: 'pirep-wx', decode: `reported weather: ${w}` });
	}
	if (parsed.temperatureC !== null) {
		out.push({
			token: parsed.temperatureC < 0 ? `M${Math.abs(parsed.temperatureC)}` : String(parsed.temperatureC),
			family: 'pirep-temp',
			decode: `outside air temp: ${parsed.temperatureC} deg C`,
		});
	}
	if (parsed.wind !== null) {
		out.push({
			token: `${String(parsed.wind.directionDeg).padStart(3, '0')}${String(parsed.wind.speedKt).padStart(2, '0')}KT`,
			family: 'pirep-wind',
			decode: `wind: ${parsed.wind.directionDeg} deg true at ${parsed.wind.speedKt} kt`,
		});
	}
	if (parsed.turbulence !== null) {
		out.push({
			token: parsed.turbulence.intensity,
			family: 'pirep-turb',
			decode:
				TURB_DECODE[parsed.turbulence.intensity] ?? `turbulence intensity: ${parsed.turbulence.intensity}`,
		});
	}
	if (parsed.icing !== null) {
		const type = parsed.icing.type ? ` (${ICE_TYPE_DECODE[parsed.icing.type] ?? parsed.icing.type})` : '';
		out.push({
			token: parsed.icing.intensity,
			family: 'pirep-ice',
			decode: `${ICE_DECODE[parsed.icing.intensity] ?? parsed.icing.intensity}${type}`,
		});
	}
	void truth;
	return out;
}
