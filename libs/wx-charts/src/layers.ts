/**
 * Layer-band composer.
 *
 * Source of truth: [docs/work-packages/wx-chart-symbology-library/spec.md](
 *   ../../../docs/work-packages/wx-chart-symbology-library/spec.md
 * ) "Layer band contract".
 *
 * Every chart-type renderer composes its output by emitting an SVG
 * fragment per layer band; `composeChart()` flattens them into a single
 * SVG document with the bands stacked in canonical z-order. Two charts
 * that follow the contract compose layer-by-layer at the same band.
 *
 * The band set is closed: adding a new band requires bumping
 * `libs/wx-charts/package.json` version + running
 * `bun run charts build --all` to regenerate every chart's `meta.json`.
 *
 * Browser-safe: pure string composition, no Node imports.
 */

import { LAYER_BAND_VALUES, type LayerBand } from '@ab/constants';
import { SVG_HEIGHT, SVG_WIDTH } from './projection';

/**
 * Map from layer band -> raw SVG fragment to emit inside that band's
 * outer `<g class="layer-${band}">`. Missing bands emit an empty `<g>`
 * placeholder so a chart-author can introspect the canonical band set
 * by reading the output SVG.
 */
export type LayerBandMap = Partial<Record<LayerBand, string>>;

export class LayerBandError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LayerBandError';
	}
}

export interface ComposeChartOptions {
	width?: number;
	height?: number;
	/** SVG-element `font-family` attribute; defaults to system stack. */
	fontFamily?: string;
	/** Optional `viewBox` override; defaults to `0 0 width height`. */
	viewBox?: string;
}

/**
 * Compose layer-band fragments into a complete SVG document. Bands are
 * stacked in `LAYER_BAND_VALUES` order (background first, chrome last).
 * Unknown bands raise `LayerBandError` -- the band set is closed; adding
 * one is a substrate change.
 */
export function composeChart(bands: LayerBandMap, options: ComposeChartOptions = {}): string {
	for (const key of Object.keys(bands)) {
		if (!(LAYER_BAND_VALUES as readonly string[]).includes(key)) {
			throw new LayerBandError(
				`Unknown layer band '${key}'. Legal bands: ${(LAYER_BAND_VALUES as readonly string[]).join(', ')}.`,
			);
		}
	}

	const width = options.width ?? SVG_WIDTH;
	const height = options.height ?? SVG_HEIGHT;
	const viewBox = options.viewBox ?? `0 0 ${width} ${height}`;
	const fontFamily = options.fontFamily ?? '-apple-system, system-ui, sans-serif';

	const layerGroups = LAYER_BAND_VALUES.map((band) => {
		const content = bands[band] ?? '';
		return `<g class="layer-${band}">${content}</g>`;
	}).join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" font-family="${fontFamily}">
${layerGroups}
</svg>
`;
}

/**
 * Build an empty `LayerBandMap` with every band initialized to `''`.
 * Renderers can fill in selectively; `composeChart` treats missing keys
 * as empty either way.
 */
export function emptyLayerBands(): Required<LayerBandMap> {
	const map = {} as Required<LayerBandMap>;
	for (const band of LAYER_BAND_VALUES) {
		map[band] = '';
	}
	return map;
}
