/**
 * TAF token-walker. Produces one annotation per significant token: header,
 * validity window, then one annotation per period (kind + window + wind
 * + visibility + weather + clouds).
 *
 * The TAF parser produces one `TafPeriod` per change group; we walk those
 * in order. A learner reading a TAF reads it group-by-group, so the
 * annotation list mirrors that traversal.
 */

import type { ParsedTaf, TafPeriod } from '@ab/wx-charts';
import type { TruthModel } from '@ab/wx-engine';
import type { TokenAnnotation } from './types';

const CHANGE_KIND_DECODE: Record<string, string> = {
	INITIAL: 'initial / prevailing forecast',
	FM: 'FM (from) - definite lasting change starting at the marked time',
	BECMG: 'BECMG (becoming) - gradual change over the window',
	TEMPO: 'TEMPO (temporary) - brief fluctuations within the window',
	PROB30: 'PROB30 - 30% probability of the bracketed conditions',
	PROB40: 'PROB40 - 40% probability of the bracketed conditions',
};

function explainPeriod(period: TafPeriod): TokenAnnotation[] {
	const out: TokenAnnotation[] = [];
	out.push({
		token: period.kind,
		family: `taf-${period.kind.toLowerCase()}`,
		decode: CHANGE_KIND_DECODE[period.kind] ?? period.kind,
	});
	if (period.wind && !period.wind.calm) {
		const wind = period.wind;
		const dir = wind.directionDeg === null ? 'VRB' : String(wind.directionDeg).padStart(3, '0');
		const gust = wind.gustKt !== null ? `G${wind.gustKt}` : '';
		out.push({
			token: `${dir}${String(wind.speedKt).padStart(2, '0')}${gust}KT`,
			family: wind.gustKt !== null ? 'wind-gust' : 'wind-steady',
			decode:
				wind.gustKt !== null
					? `wind ${dir === 'VRB' ? 'variable' : `from ${wind.directionDeg} deg true`} at ${wind.speedKt} kt gusting ${wind.gustKt} kt`
					: `wind ${dir === 'VRB' ? 'variable' : `from ${wind.directionDeg} deg true`} at ${wind.speedKt} kt`,
		});
	}
	if (period.visibilitySM !== null) {
		out.push({
			token: period.visibilitySM >= 6 ? 'P6SM' : `${period.visibilitySM}SM`,
			family:
				period.visibilitySM >= 6
					? 'visibility-p6sm'
					: period.visibilitySM < 3
						? 'visibility-fractional'
						: 'visibility-whole',
			decode:
				period.visibilitySM >= 6
					? 'visibility greater than 6 statute miles (TAF prevailing-VFR shorthand)'
					: `visibility ${period.visibilitySM} statute miles`,
		});
	}
	if (period.cavok) {
		out.push({
			token: 'CAVOK',
			family: 'cavok',
			decode: 'CAVOK -- visibility >= 10 km, no cloud below 5,000 ft, no significant weather',
		});
	}
	for (const code of period.weather) {
		out.push({
			token: code,
			family: code.startsWith('+') ? 'wx-heavy' : code.startsWith('-') ? 'wx-light' : 'wx-moderate',
			decode: `forecast weather: ${code}`,
		});
	}
	for (const layer of period.clouds) {
		const tokenText =
			layer.cover === 'SKC' || layer.cover === 'CLR' || layer.cover === 'NSC'
				? layer.cover
				: `${layer.cover}${layer.heightFtAgl !== null ? String(Math.floor(layer.heightFtAgl / 100)).padStart(3, '0') : ''}`;
		out.push({
			token: tokenText,
			family: 'taf-clouds',
			decode:
				layer.heightFtAgl !== null
					? `${layer.cover} layer at ${layer.heightFtAgl} ft AGL`
					: `${layer.cover} (no height)`,
		});
	}
	if (period.probability !== null) {
		out.push({
			token: `PROB${period.probability}`,
			family: 'taf-probability',
			decode: `${period.probability}% probability that the bracketed conditions occur`,
		});
	}
	return out;
}

export function explainTaf(parsed: ParsedTaf, truth?: TruthModel): TokenAnnotation[] {
	const out: TokenAnnotation[] = [];
	out.push({
		token: parsed.station,
		family: 'station',
		decode: `ICAO station identifier ${parsed.station}`,
	});
	if (parsed.amended) {
		out.push({
			token: 'AMD',
			family: 'taf-amd',
			decode: 'amended TAF (off-cycle issuance superseding the prior TAF)',
		});
	}
	if (parsed.corrected) {
		out.push({
			token: 'COR',
			family: 'taf-cor',
			decode: 'corrected TAF (the prior was wrong; this supersedes it)',
		});
	}
	out.push({
		token: `${parsed.validFrom.slice(8, 10)}${parsed.validFrom.slice(11, 13)}/${parsed.validTo.slice(8, 10)}${parsed.validTo.slice(11, 13)}`,
		family: 'taf-validity',
		decode: `validity ${parsed.validFrom} -> ${parsed.validTo}`,
	});
	for (const period of parsed.periods) {
		out.push(...explainPeriod(period));
	}
	// Truth-aware `why` lines for TAFs are deferred to a later phase. The
	// shape is captured (`truth` is accepted); for now annotations are
	// always decode-only.
	void truth;
	return out;
}
