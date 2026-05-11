// @browser-globals: server-only -- never imported by client .svelte
/**
 * Layer-4 Socratic commentary rule set.
 *
 * Pure function: `(truth, products, charts, scenarioId) -> CommentaryCallout[]`.
 * Each rule emits 0 or 1 callout (rule 1, 5, 7 emit one per qualifying
 * element so produce multiple). The rule set is closed at 10 categories:
 *
 *   1. front-crossing       -- per station that crossed a front
 *   2. pre-frontal warm     -- southernmost warm-sector station
 *   3. post-frontal gust    -- deepest cold-sector station
 *   4. TAF FM transition    -- per arrival airport whose TAF has FM
 *   5. AIRMET               -- per AIRMET; Sierra/Tango/Zulu distinct prompts
 *   6. isobar gradient      -- surface-analysis chart feature
 *   7. convective cell      -- per convective cell
 *   8. PIREP corroboration  -- one matched PIREP -> AIRMET
 *   9. jet exit             -- when jetMaxKt > 80
 *  10. diurnal inversion    -- when nocturnalInversion === true
 *
 * Every callout's `reason` text cites a SPECIFIC named truth-model element
 * (named pressure system, named front, named hazard zone, named convective
 * cell). Template placeholders like "the front" or "the air mass" are
 * forbidden. Discovery-first phrasing per ADR 011: `mode: 'socratic'`
 * questions open with What/Why/How.
 *
 * Every callout's `knowledgeNodeIds` references real nodes under
 * `course/knowledge/weather/` (validated by `validateAllKnowledgeNodes`).
 *
 * Source of truth:
 *   - `docs/work-packages/wx-engine/spec.md` "Data model"
 *   - `docs/work-packages/wx-engine/tasks.md` "Phase D" D.2
 *   - `docs/vision/products/pre-flight/weather-scenario-engine/DESIGN.md`
 *     "Layer 4 derivation: commentary"
 */

import { AIRMET_FAMILIES, type AirmetFamily } from '@ab/constants';
import type { ChartArtifact } from '../charts/types';
import type { AirmetAdvisory, DerivedMetar, DerivedPirep, DerivedTaf, DerivedFbGrid } from '../products/types';
import { distanceKm, distanceToPolylineKm, findAirMass, pointInPolygon, sideOfFront } from '../truth/geometry';
import type { AirMass, ConvectiveCell, HazardZone, TruthModel } from '../truth/types';
import type { CommentaryCallout } from './types';

// ----------------------------------------------------------------------
// Public contract
// ----------------------------------------------------------------------

export interface DeriveCommentaryProducts {
	metars: DerivedMetar[];
	tafs: DerivedTaf[];
	airmets: AirmetAdvisory[];
	fbGrid: DerivedFbGrid | null;
	pireps: DerivedPirep[];
}

/**
 * Author the commentary callout list for a given truth model + derived
 * products + charts.
 *
 * The function is a closed-rule classifier: each rule inspects the truth
 * state, fires 0+ callouts, and the union is returned. Output count for a
 * full scenario lands in `[8, 15]`. Authoring is rule-based, not LLM-
 * generated.
 */
export function deriveCommentary(
	truth: TruthModel,
	products: DeriveCommentaryProducts,
	charts: ChartArtifact[],
	scenarioId: string,
): CommentaryCallout[] {
	const callouts: CommentaryCallout[] = [];

	// Pre-compute references the rules share.
	const surfaceChart = chartBySuffix(charts, scenarioId, 'surface-analysis');
	const progChart = chartBySuffix(charts, scenarioId, 'prog-12hr');
	const airmetChart = chartBySuffix(charts, scenarioId, 'airmet-sigmet');
	const pirepChart = chartBySuffix(charts, scenarioId, 'pirep-plot');
	const windsAloftChart = chartBySuffix(charts, scenarioId, 'winds-aloft');

	// Resolve the parent low + the dominant cold front once. The rules
	// reference these by name to satisfy WXENG-34.
	const parentLow = truth.synoptic.pressureSystems.find((p) => p.kind === 'L') ?? null;
	const coldFront = truth.synoptic.fronts.find((f) => f.kind === 'cold') ?? null;
	const warmSector = truth.airMasses.find((m) => m.classification === 'mT' || m.classification === 'mP') ?? null;
	const coldSector = truth.airMasses.find((m) => m.classification === 'cP' || m.classification === 'cA') ?? null;

	// === Rule 1: front-crossing -- per station whose current air mass is
	//             on the cold side of the dominant cold front. ===
	if (coldFront !== null && warmSector !== null && coldSector !== null) {
		for (const icao of truth.routeStations) {
			const st = truth.stations[icao];
			if (st === undefined) continue;
			const pt: [number, number] = [st.lon, st.lat];
			const side = sideOfFront(pt, coldFront);
			if (side !== 'opposite') continue; // pip-side is warm sector for cold front
			const currentMass = findAirMass(truth, pt);
			if (currentMass === null || currentMass.classification === warmSector.classification) continue;
			callouts.push({
				id: `wxc-${scenarioId}-front-crossing-${icao}`,
				target: { kind: 'metar', elementId: icao },
				mode: 'socratic',
				question: `What changed at ${icao} when the ${coldFront.id} front passed -- compare its METAR to the warm-sector stations.`,
				observation: `${icao} now sits in the ${currentMass.classification} mass (${describeAirMass(currentMass)}); the warm-sector stations report the ${warmSector.classification} mass (${describeAirMass(warmSector)}).`,
				reason: `The ${coldFront.id} front (${coldFront.kind}, intensity ${coldFront.intensity}, moving ${coldFront.motionDegTrue}deg at ${coldFront.motionKt} kt) has already crossed ${icao}. The ${currentMass.classification} air now over the field replaces the ${warmSector.classification} sector that was there before passage: temperature drop ${warmSector.surfaceTempC - currentMass.surfaceTempC}C, dewpoint drop ${warmSector.surfaceDewpointC - currentMass.surfaceDewpointC}C, wind shift from ${warmSector.surfaceWindDirDeg}deg to ${currentMass.surfaceWindDirDeg}deg. Every change traces back to one event: a different air mass is now over the field.`,
				knowledgeNodeIds: ['wx-airmasses-and-fronts', 'wx-reading-metars-tafs'],
			});
		}
	}

	// === Rule 2: pre-frontal warm-sector -- southernmost warm-sector station. ===
	if (warmSector !== null) {
		const warmStations = truth.routeStations
			.map((icao) => ({ icao, st: truth.stations[icao] }))
			.filter((x): x is { icao: string; st: NonNullable<(typeof x)['st']> } => x.st !== undefined)
			.filter(({ st }) => pointInPolygon([st.lon, st.lat], warmSector.polygon));
		if (warmStations.length > 0) {
			const southernmost = warmStations.reduce((min, cur) => (cur.st.lat < min.st.lat ? cur : min));
			const lowLabel = parentLow !== null ? `${parentLow.id} (${parentLow.centralPressureMb}mb)` : 'the parent low';
			callouts.push({
				id: `wxc-${scenarioId}-pre-frontal-warm-sector-${southernmost.icao}`,
				target: { kind: 'metar', elementId: southernmost.icao },
				mode: 'socratic',
				question: `Why are ${southernmost.icao}'s winds ${formatWind(warmSector.surfaceWindDirDeg, warmSector.surfaceWindKt)} on a pre-frontal afternoon?`,
				observation: `${southernmost.icao} METAR carries the ${warmSector.classification} signature: T${warmSector.surfaceTempC}C / Td${warmSector.surfaceDewpointC}C, wind ${formatWind(warmSector.surfaceWindDirDeg, warmSector.surfaceWindKt)}.`,
				reason: `${southernmost.icao} sits in the ${warmSector.classification} warm sector ahead of ${coldFront !== null ? coldFront.id : 'the cold front'}. Surface flow circulates around ${lowLabel} to the north, drawing ${cardinalDirection(warmSector.surfaceWindDirDeg)} air up from the source region -- hence the ${warmSector.surfaceWindDirDeg}/${warmSector.surfaceWindKt} wind. The pre-frontal pressure gradient between ${lowLabel} and the downstream high tightens as the front approaches; that's why the wind speed is non-trivial despite the calm-feeling warm-sector skies.`,
				knowledgeNodeIds: ['wx-wind-systems', 'wx-airmasses-and-fronts'],
			});
		}
	}

	// === Rule 3: post-frontal gust -- deepest cold-sector station. ===
	if (coldSector !== null && coldFront !== null) {
		const coldStations = truth.routeStations
			.map((icao) => ({ icao, st: truth.stations[icao] }))
			.filter((x): x is { icao: string; st: NonNullable<(typeof x)['st']> } => x.st !== undefined)
			.filter(({ st }) => pointInPolygon([st.lon, st.lat], coldSector.polygon));
		if (coldStations.length > 0) {
			// "Deepest" cold-sector station = farthest from the front polyline.
			const deepest = coldStations.reduce((max, cur) => {
				const dCur = distanceToPolylineKm([cur.st.lon, cur.st.lat], coldFront.points);
				const dMax = distanceToPolylineKm([max.st.lon, max.st.lat], coldFront.points);
				return dCur > dMax ? cur : max;
			});
			const lowLabel = parentLow !== null ? `${parentLow.id} (${parentLow.centralPressureMb}mb)` : 'the parent low';
			callouts.push({
				id: `wxc-${scenarioId}-post-frontal-gust-${deepest.icao}`,
				target: { kind: 'metar', elementId: deepest.icao },
				mode: 'socratic',
				question: `Why is ${deepest.icao} still gusting on a clear post-frontal afternoon -- shouldn't the gusts have died with the sun?`,
				observation: `${deepest.icao}'s METAR carries the ${coldSector.classification} post-frontal wind: ${formatWind(coldSector.surfaceWindDirDeg, coldSector.surfaceWindKt)} with gusts driven by the post-frontal pressure rise.`,
				reason: `Two sources keep the gusts active even after sunset. (1) ${lowLabel} is deepening; isobars pack tighter behind a deepening trough, so the geostrophic wind speeds up as the cold-sector pressure rise meets the low's pressure fall. (2) Cold advection in the ${coldSector.classification} sector keeps the boundary layer well-mixed: mid-level momentum keeps coupling down to the surface as gusts. The "gusts die at sunset" heuristic applies in stable air; in active cold advection behind the ${coldFront.id} front it does not.`,
				knowledgeNodeIds: ['wx-wind-systems', 'wx-airmasses-and-fronts'],
			});
		}
	}

	// === Rule 4: TAF FM transition -- arrival airport whose TAF has an FM group. ===
	const arrivalIcao = truth.routeStations[truth.routeStations.length - 1];
	if (arrivalIcao !== undefined) {
		const arrivalIdx = truth.routeStations.indexOf(arrivalIcao);
		const arrivalTaf = arrivalIdx >= 0 ? products.tafs[arrivalIdx] : undefined;
		if (arrivalTaf !== undefined && /\bFM\d{6}\b/.test(arrivalTaf.raw)) {
			const fmMatch = arrivalTaf.raw.match(/FM(\d{2})(\d{2})(\d{2})\b/);
			const fmHour = fmMatch !== null ? `${fmMatch[2]}Z` : 'the FM hour';
			const arrivalSt = truth.stations[arrivalIcao];
			const frontInfo =
				coldFront !== null && arrivalSt !== undefined
					? `${Math.round(distanceToPolylineKm([arrivalSt.lon, arrivalSt.lat], coldFront.points))}km from the ${coldFront.id} front`
					: 'inside the projected frontal swath';
			callouts.push({
				id: `wxc-${scenarioId}-taf-fm-${arrivalIcao}`,
				target: { kind: 'taf-period', elementId: arrivalIcao },
				mode: 'socratic',
				question: `How does the FM${fmHour} transition in ${arrivalIcao}'s TAF change your arrival plan?`,
				observation: `${arrivalIcao} TAF: \`${arrivalTaf.raw}\``,
				reason: `${arrivalIcao} is currently ${frontInfo}. The FM group marks the forecast time the ${coldFront !== null ? coldFront.id : 'cold front'} reaches the field${coldFront !== null ? ` (motion ${coldFront.motionDegTrue}deg at ${coldFront.motionKt}kt)` : ''}. After the FM hour the ceiling and visibility drop, the wind veers and gusts, and you're flying through ${coldSector !== null ? coldSector.classification : 'post-frontal'} air -- denser, drier, colder. Arrive before the FM hour and the airport stays in ${warmSector !== null ? warmSector.classification : 'warm-sector'} conditions; arrive after and you're landing in the post-frontal regime.`,
				knowledgeNodeIds: ['wx-reading-metars-tafs', 'wx-airmasses-and-fronts'],
			});
		}
	}

	// === Rule 5: AIRMET callouts -- one per AIRMET; family-specific prompts. ===
	if (airmetChart !== null) {
		for (const airmet of products.airmets) {
			const hz = truth.hazardZones.find((h) => h.id === airmet.fromHazardZoneId);
			if (hz === undefined) continue;
			const callout = airmetCallout(scenarioId, airmet, hz, airmetChart.slug);
			callouts.push(callout);
		}
	}

	// === Rule 6: surface-analysis isobar gradient. ===
	if (surfaceChart !== null) {
		const highs = truth.synoptic.pressureSystems.filter((p) => p.kind === 'H');
		const lows = truth.synoptic.pressureSystems.filter((p) => p.kind === 'L');
		const highRef = highs[0] ?? null;
		const lowRef = lows[0] ?? null;
		if (highRef !== null && lowRef !== null) {
			const deltaMb = highRef.centralPressureMb - lowRef.centralPressureMb;
			callouts.push({
				id: `wxc-${scenarioId}-isobar-gradient`,
				target: { kind: 'chart-feature', chartSlug: surfaceChart.slug, elementId: 'isobar-pack' },
				mode: 'glance',
				question: 'Where are the isobars packed tightest on the surface analysis, and what does that tell you about wind speed?',
				observation: `Count the isobars between ${lowRef.id} (${lowRef.centralPressureMb}mb) and ${highRef.id} (${highRef.centralPressureMb}mb) -- a ${deltaMb}mb delta across the synoptic frame.`,
				reason: `Tight isobars equal a steep pressure gradient equal strong wind. The ${deltaMb}mb spread between ${lowRef.id} and ${highRef.id} is bridged across the cold-sector envelope; isobars compress where the deepening low draws air toward its center while the high pushes air outward. Surface friction veers the wind ~30deg right of the gradient direction; that's why the post-frontal stations report NW winds rather than pure W.`,
				knowledgeNodeIds: ['wx-wind-systems', 'wx-chart-type-surface-analysis', 'wx-product-surface-analysis-and-cva'],
			});
		}
	}

	// === Rule 7: convective cell -- one per convective cell. ===
	if (progChart !== null) {
		for (const cell of truth.convection.cells) {
			callouts.push(convectiveCellCallout(scenarioId, cell, truth, progChart.slug));
		}
	}

	// === Rule 8: PIREP corroboration -- one matched PIREP -> AIRMET. ===
	const matchedPirep = matchPirepToAirmet(products.pireps, products.airmets, truth.hazardZones);
	if (matchedPirep !== null && pirepChart !== null) {
		const { pirep, airmet, hz } = matchedPirep;
		const family = airmet.kind === AIRMET_FAMILIES.SIERRA ? 'Sierra' : airmet.kind === AIRMET_FAMILIES.TANGO ? 'Tango' : 'Zulu';
		callouts.push({
			id: `wxc-${scenarioId}-pirep-corroboration-${pirep.parsed.station}`,
			target: { kind: 'pirep', chartSlug: pirepChart.slug, elementId: pirep.parsed.station },
			mode: 'socratic',
			question: `How does the ${pirep.parsed.station} PIREP corroborate the AIRMET ${family} polygon?`,
			observation: `\`${pirep.raw}\``,
			reason: `The ${pirep.parsed.station} PIREP is inside the ${hz.id} hazard zone (severity ${hz.severity}, ${hz.altitudeBandFtMsl.min}-${hz.altitudeBandFtMsl.max ?? 'and above'}ft MSL). Three independent products agree: the AIRMET ${family} polygon covering ${hz.id}, the synoptic truth that produced the polygon (${hz.source}), and the pilot's report from inside it. Convergent independent evidence is the gold standard pre-flight signal -- treat it as confirmation, not coincidence.`,
			knowledgeNodeIds: ['wx-product-pireps', 'wx-product-airmets-sigmets'],
		});
	}

	// === Rule 9: winds-aloft jet exit -- jetMaxKt > 80. ===
	if (windsAloftChart !== null && truth.upperLevel.jetMaxKt > 80) {
		const jetAxis = truth.upperLevel.jetAxis;
		const axisDescription =
			jetAxis.length >= 2
				? `from ${formatLonLat(jetAxis[0])} to ${formatLonLat(jetAxis[jetAxis.length - 1])}`
				: 'across the upper-level chart';
		callouts.push({
			id: `wxc-${scenarioId}-jet-exit`,
			target: { kind: 'fb-row', chartSlug: windsAloftChart.slug, elementId: 'jet-max-fl' },
			mode: 'socratic',
			question: `Where is the jet axis on the winds-aloft chart, and what does the exit region predict about turbulence at FL240+?`,
			observation: `Jet maximum: ${truth.upperLevel.jetMaxKt} kt aloft, axis running ${axisDescription}.`,
			reason: `The ${truth.upperLevel.jetMaxKt}-kt jet axis (${axisDescription}) feeds an exit region where ageostrophic flow descends and accelerates on the cold side -- classic clear-air turbulence. On the cold-sector side of the jet exit, the post-frontal pressure rise reinforces the descent; expect chop concentrated in the FL180-FL280 band aligned with the axis.`,
			knowledgeNodeIds: ['wx-product-winds-aloft', 'wx-turbulence-types'],
		});
	}

	// === Rule 10: diurnal nocturnal inversion. ===
	if (surfaceChart !== null && truth.diurnal.nocturnalInversion === true) {
		callouts.push({
			id: `wxc-${scenarioId}-diurnal-inversion`,
			target: { kind: 'chart-feature', chartSlug: surfaceChart.slug, elementId: 'nocturnal-inversion' },
			mode: 'socratic',
			question: 'How does the nocturnal inversion shape this morning\'s ceiling-and-visibility recovery -- when does the LIFR layer lift?',
			observation: `Mixing height at validAt: ${truth.diurnal.mixingHeightFtMsl} ft MSL; solar noon at ${truth.diurnal.solarNoonUtcHour}Z.`,
			reason: `The radiation-cooling cycle traps moisture beneath the inversion overnight; visibility crashes as the surface air saturates. As the sun lifts past ${truth.diurnal.solarNoonUtcHour}Z, surface heating burns the inversion off and mixing height climbs through the trapped layer. The LIFR-to-VFR transition happens when the mixing height exceeds the inversion top -- usually 2-4 hours after sunrise depending on cloud cover and wind. Plan departure for after that transition, not before.`,
			knowledgeNodeIds: ['wx-fog-and-visibility-obstructions', 'wx-stability-and-instability'],
		});
	}

	return callouts;
}

// ----------------------------------------------------------------------
// Family-specific AIRMET callout authoring
// ----------------------------------------------------------------------

function airmetCallout(scenarioId: string, airmet: AirmetAdvisory, hz: HazardZone, chartSlug: string): CommentaryCallout {
	const minK = hz.altitudeBandFtMsl.min;
	const maxK = hz.altitudeBandFtMsl.max ?? null;
	const altBand = maxK === null ? `from ${minK}ft and above` : `from ${minK}ft to ${maxK}ft MSL`;
	const severity = hz.severity;
	const familyTag = airmet.kind === AIRMET_FAMILIES.SIERRA ? 'Sierra' : airmet.kind === AIRMET_FAMILIES.TANGO ? 'Tango' : 'Zulu';

	if (airmet.kind === AIRMET_FAMILIES.SIERRA) {
		return {
			id: `wxc-${scenarioId}-airmet-sierra-${hz.id}`,
			target: { kind: 'airmet', chartSlug, elementId: airmet.id },
			mode: 'socratic',
			question: `What does this AIRMET Sierra (${hz.id}) tell you about ceiling and visibility along the route?`,
			observation: `AIRMET ${familyTag} covers ${hz.id} ${altBand}; severity ${severity}. Source: ${hz.source}.`,
			reason: `The ${hz.id} hazard zone is a ${hz.kind} pocket bounded by the synoptic features that produced it (${hz.source}). The Sierra family triggers on ceiling below 1000ft AGL or visibility below 3SM; inside this polygon those minima are forecast to fail. Three impacts: (1) VFR is locked out under the polygon; (2) the cloud deck is uniform (the same stable inversion that traps the moisture caps it horizontally); (3) the polygon shrinks or grows with the synoptic state -- track the parent feature, not just the AIRMET itself.`,
			knowledgeNodeIds: ['wx-product-airmets-sigmets', 'wx-fog-and-visibility-obstructions'],
		};
	}

	if (airmet.kind === AIRMET_FAMILIES.TANGO) {
		return {
			id: `wxc-${scenarioId}-airmet-tango-${hz.id}`,
			target: { kind: 'airmet', chartSlug, elementId: airmet.id },
			mode: 'socratic',
			question: `Where is the AIRMET Tango polygon ${hz.id} centered relative to the jet axis -- and what mechanism stacks the turbulence?`,
			observation: `AIRMET ${familyTag} covers ${hz.id} ${altBand}; severity ${severity}. Source: ${hz.source}.`,
			reason: `Tango polygon ${hz.id} encloses ${altBand}. The mechanism is named in the hazard source: ${hz.source}. Two physical sources stack in this band: mechanical turbulence in the cold-advection boundary layer below, and ageostrophic descent on the cold side of the jet exit aloft. Together they produce continuous chop through the polygon's altitude span; expect ride quality to degrade entering the polygon and recover above the upper bound.`,
			knowledgeNodeIds: ['wx-product-airmets-sigmets', 'wx-turbulence-types'],
		};
	}

	// Zulu
	return {
		id: `wxc-${scenarioId}-airmet-zulu-${hz.id}`,
		target: { kind: 'airmet', chartSlug, elementId: airmet.id },
		mode: 'socratic',
		question: `What altitude band does the AIRMET Zulu cover for ${hz.id}, and how does the freezing-level shape that band?`,
		observation: `AIRMET ${familyTag} covers ${hz.id} ${altBand}; severity ${severity}. Source: ${hz.source}.`,
		reason: `Zulu polygon ${hz.id} encloses ${altBand}. Icing requires supercooled liquid water above the freezing level -- the band's lower bound tracks the freezing-level surface, and the upper bound caps where temperatures drop below ~-15C (most droplets glaciate). Inside the polygon, expect rime/clear icing on airframe surfaces; the AIRMET source (${hz.source}) names the specific producing mechanism so the polygon's altitude bounds and severity make sense.`,
		knowledgeNodeIds: ['wx-product-airmets-sigmets', 'wx-icing-types-and-avoidance'],
	};
}

// ----------------------------------------------------------------------
// Convective cell callout authoring
// ----------------------------------------------------------------------

function convectiveCellCallout(
	scenarioId: string,
	cell: ConvectiveCell,
	truth: TruthModel,
	chartSlug: string,
): CommentaryCallout {
	const nearbyAirmets = truth.hazardZones.filter((hz) => pointInPolygon([cell.lon, cell.lat], hz.polygon));
	const airmetSummary =
		nearbyAirmets.length > 0
			? `inside ${nearbyAirmets.map((hz) => hz.id).join(', ')}`
			: 'in the pre-frontal warm sector outside the bordered hazard zones';
	return {
		id: `wxc-${scenarioId}-convective-cell-${cell.id}`,
		target: { kind: 'chart-feature', chartSlug, elementId: `cell-${cell.id}` },
		mode: 'socratic',
		question: `What altitude band does the convective cell ${cell.id} extend through, and which AIRMET polygons does it overlap?`,
		observation: `Cell ${cell.id} at ${formatLonLat([cell.lon, cell.lat])}, radius ${cell.radiusKm}km, peak ${cell.peakDbz} dBZ; ${airmetSummary}.`,
		reason: `Convective cell ${cell.id} stands inside ${airmetSummary}. Cells in this peak-dBZ range (${cell.peakDbz} dBZ) reach the tropopause when peakDbz exceeds 50; this cell's vertical extent feeds the embedded turbulence and icing the AIRMETs cover. Three concrete hazards stack at the cell: (1) updraft turbulence inside the rain core, (2) downdraft + microburst risk at the leading edge, (3) embedded lightning. Stay ${cell.radiusKm * 2}km clear of the cell at flight altitudes the AIRMETs cover.`,
		knowledgeNodeIds: ['wx-thunderstorm-hazards', 'wx-product-airmets-sigmets'],
	};
}

// ----------------------------------------------------------------------
// PIREP <-> AIRMET match
// ----------------------------------------------------------------------

function matchPirepToAirmet(
	pireps: DerivedPirep[],
	airmets: AirmetAdvisory[],
	hazardZones: HazardZone[],
): { pirep: DerivedPirep; airmet: AirmetAdvisory; hz: HazardZone } | null {
	// Prefer turbulence-bearing PIREPs with MOD/SEV intensity. Walk each PIREP,
	// find the first airmet whose hazard polygon contains the PIREP's location.
	const ranked = [...pireps].sort((a, b) => severityRank(b) - severityRank(a));
	for (const pirep of ranked) {
		for (const airmet of airmets) {
			const hz = hazardZones.find((h) => h.id === airmet.fromHazardZoneId);
			if (hz === undefined) continue;
			if (pointInPolygon([pirep.lon, pirep.lat], hz.polygon)) {
				return { pirep, airmet, hz };
			}
		}
	}
	return null;
}

function severityRank(p: DerivedPirep): number {
	const intensity = p.parsed.turbulence?.intensity;
	if (intensity === undefined || intensity === null) return 0;
	if (intensity === 'SEV' || intensity === 'EXTM') return 3;
	if (intensity === 'MOD') return 2;
	if (intensity === 'LGT') return 1;
	return 0;
}

// ----------------------------------------------------------------------
// Local helpers
// ----------------------------------------------------------------------

function chartBySuffix(charts: ChartArtifact[], scenarioId: string, suffix: string): ChartArtifact | null {
	const want = `wx-scenario-${scenarioId}-${suffix}`;
	return charts.find((c) => c.slug === want) ?? null;
}

function describeAirMass(am: AirMass): string {
	return `T${am.surfaceTempC}C / Td${am.surfaceDewpointC}C, wind ${formatWind(am.surfaceWindDirDeg, am.surfaceWindKt)}, ${am.stability}`;
}

function formatWind(dirDeg: number, kt: number): string {
	return `${String(dirDeg).padStart(3, '0')}/${kt}`;
}

function cardinalDirection(dirDeg: number): string {
	const norm = ((dirDeg % 360) + 360) % 360;
	if (norm < 22.5 || norm >= 337.5) return 'northerly';
	if (norm < 67.5) return 'northeasterly';
	if (norm < 112.5) return 'easterly';
	if (norm < 157.5) return 'southeasterly';
	if (norm < 202.5) return 'southerly';
	if (norm < 247.5) return 'southwesterly';
	if (norm < 292.5) return 'westerly';
	return 'northwesterly';
}

function formatLonLat(pt: [number, number] | undefined): string {
	if (pt === undefined) return '(unknown)';
	const lonAbs = Math.abs(pt[0]).toFixed(1);
	const latAbs = Math.abs(pt[1]).toFixed(1);
	const lonHemi = pt[0] >= 0 ? 'E' : 'W';
	const latHemi = pt[1] >= 0 ? 'N' : 'S';
	return `${latAbs}${latHemi}/${lonAbs}${lonHemi}`;
}

