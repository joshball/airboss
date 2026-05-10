/**
 * Frontal symbology renderers: cold / warm / occluded / stationary.
 *
 * Each renderer composes the canonical line stroke + pip pattern via
 * the `renderPolylinePips` primitive. Colors follow the WPC convention:
 * cold = blue, warm = red, occluded = purple, stationary = blue+red
 * dashed pair with triangles on one side and semicircles on the other.
 *
 * Browser-safe: pure SVG-string emission, no Node imports.
 *
 * Ported from `spikes/wx-charts/01-surface-analysis/src/symbology.ts`
 * (the four `render<Kind>Front` functions).
 */

import { renderPolylinePips, type ScreenVec } from './polyline-pips';

export type FrontKind = 'cold' | 'warm' | 'occluded' | 'stationary';
export type PipSide = 'N' | 'S' | 'E' | 'W';

export interface FrontDef {
	kind: FrontKind;
	/** Polyline points in projected screen coordinates. */
	points: ReadonlyArray<readonly [number, number]>;
	/**
	 * Cardinal side the pips should face. Defaults vary by kind: cold
	 * defaults to S; warm/occluded/stationary default to N. The cardinal
	 * is interpreted in screen-space (N = up = -y, S = down = +y, E =
	 * right = +x, W = left = -x).
	 */
	pipSide?: PipSide;
}

const COLD_BLUE = '#1f4ea8';
const WARM_RED = '#b8232f';
const OCCLUDED_PURPLE = '#6a1f8f';
const FRONT_STROKE_WIDTH = 2.4;
const PIP_SPACING = 28;

const CARDINAL_TO_SCREEN: Record<PipSide, ScreenVec> = {
	N: [0, -1],
	S: [0, 1],
	E: [1, 0],
	W: [-1, 0],
};

const DEFAULT_PIP_SIDE: Record<FrontKind, PipSide> = {
	cold: 'S',
	warm: 'N',
	occluded: 'N',
	stationary: 'N',
};

function polylineToPath(pts: ReadonlyArray<readonly [number, number]>): string {
	return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
}

function targetForFront(front: FrontDef): ScreenVec {
	return CARDINAL_TO_SCREEN[front.pipSide ?? DEFAULT_PIP_SIDE[front.kind]];
}

/** Render a single front by kind. Returns the inner SVG fragment. */
export function renderFront(front: FrontDef): string {
	if (front.points.length < 2) return '';
	switch (front.kind) {
		case 'cold':
			return renderColdFront(front);
		case 'warm':
			return renderWarmFront(front);
		case 'occluded':
			return renderOccludedFront(front);
		case 'stationary':
			return renderStationaryFront(front);
		default: {
			// Exhaustiveness guard. If a new kind is added, the compiler
			// flags this `never` branch.
			const exhaustive: never = front.kind;
			throw new Error(`Unsupported front kind: ${String(exhaustive)}`);
		}
	}
}

export function renderColdFront(front: FrontDef): string {
	const linePath = polylineToPath(front.points);
	const target = targetForFront(front);
	const pips = renderPolylinePips(front.points, {
		shape: 'triangle',
		color: COLD_BLUE,
		spacingPx: PIP_SPACING,
		targetSide: target,
	});
	return `<g class="front-cold">
  <path d="${linePath}" fill="none" stroke="${COLD_BLUE}" stroke-width="${FRONT_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" />
  ${pips}
</g>`;
}

export function renderWarmFront(front: FrontDef): string {
	const linePath = polylineToPath(front.points);
	const target = targetForFront(front);
	const pips = renderPolylinePips(front.points, {
		shape: 'semicircle',
		color: WARM_RED,
		spacingPx: PIP_SPACING,
		targetSide: target,
	});
	return `<g class="front-warm">
  <path d="${linePath}" fill="none" stroke="${WARM_RED}" stroke-width="${FRONT_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" />
  ${pips}
</g>`;
}

export function renderOccludedFront(front: FrontDef): string {
	const linePath = polylineToPath(front.points);
	const target = targetForFront(front);
	const triangles = renderPolylinePips(front.points, {
		shape: 'triangle',
		color: OCCLUDED_PURPLE,
		spacingPx: PIP_SPACING,
		targetSide: target,
	});
	const semis = renderPolylinePips(front.points, {
		shape: 'semicircle',
		color: OCCLUDED_PURPLE,
		spacingPx: PIP_SPACING,
		startOffsetPx: PIP_SPACING,
		targetSide: target,
	});
	return `<g class="front-occluded">
  <path d="${linePath}" fill="none" stroke="${OCCLUDED_PURPLE}" stroke-width="${FRONT_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" />
  ${triangles}
  ${semis}
</g>`;
}

export function renderStationaryFront(front: FrontDef): string {
	const linePath = polylineToPath(front.points);
	const target = targetForFront(front);
	const oppTarget: ScreenVec = [-target[0], -target[1]];
	const triangles = renderPolylinePips(front.points, {
		shape: 'triangle',
		color: COLD_BLUE,
		spacingPx: PIP_SPACING,
		targetSide: target,
	});
	const semis = renderPolylinePips(front.points, {
		shape: 'semicircle',
		color: WARM_RED,
		spacingPx: PIP_SPACING,
		startOffsetPx: PIP_SPACING,
		targetSide: oppTarget,
	});
	return `<g class="front-stationary">
  <path d="${linePath}" fill="none" stroke="${COLD_BLUE}" stroke-width="${FRONT_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${PIP_SPACING} ${PIP_SPACING}" />
  <path d="${linePath}" fill="none" stroke="${WARM_RED}" stroke-width="${FRONT_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${PIP_SPACING} ${PIP_SPACING}" stroke-dashoffset="${PIP_SPACING}" />
  ${triangles}
  ${semis}
</g>`;
}
