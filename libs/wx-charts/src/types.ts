/**
 * Public type contracts for the weather-chart library.
 *
 * Source of truth: [docs/work-packages/wx-chart-symbology-library/spec.md](
 *   ../../../docs/work-packages/wx-chart-symbology-library/spec.md
 * ) "Chart-type renderer contract" + "Data model".
 *
 * Browser-safe: pure types, no values, no imports of Node built-ins.
 */

import type { ChartType, LayerBand } from '@ab/constants';

/**
 * Projection variant declared in a chart's `spec.yaml`. v1 supports only
 * Lambert Conformal -- every CONUS chart uses it. Other variants land
 * when a non-CONUS extent earns the work (see OUT-OF-SCOPE.md).
 */
export interface ChartProjectionSpec {
	kind: 'lambert';
	parallels: [number, number];
	rotate: [number, number];
}

/**
 * Common base of every chart's `spec.yaml`. Per-chart-type schemas extend
 * this with type-specific `sources` keys + `options` shape via the Zod
 * schema co-located with each renderer.
 */
export interface ChartSpec {
	slug: string;
	type: ChartType;
	title: string;
	subtitle?: string;
	projection: ChartProjectionSpec;
	extent: 'conus' | 'alaska' | 'hawaii' | { lon_min: number; lat_min: number; lon_max: number; lat_max: number };
	sources: Record<string, string>;
	options?: Record<string, unknown>;
}

/**
 * Inputs the CLI passes to a renderer. Renderers are pure functions:
 * the CLI does the file I/O, the renderer accepts bytes + the parsed
 * spec and returns SVG + meta.
 */
export interface ChartRenderInput<TSpec extends ChartSpec = ChartSpec> {
	spec: TSpec;
	/**
	 * Resolved source bytes / strings, keyed by the spec's `sources` keys.
	 * The CLI loads files from the dev cache (`~/Documents/airboss-handbook-cache/wx/...`)
	 * and passes the bytes here. Renderers parse from these inputs.
	 */
	sources: Record<string, Uint8Array | string>;
	/**
	 * Path to the substrate basemap. Default: `data/references/basemaps/us-states-10m.json`.
	 * The renderer accepts the path as input so tests can pass a fixture path.
	 */
	basemapPath: string;
	/**
	 * Optional path to the nation outline. Phase A's surface analysis only
	 * needs the states file (CONUS-only outer mesh is derived from the
	 * filtered states), but renderers in later phases may use this for
	 * coastline detail.
	 */
	nationPath?: string;
	/** Stamped into `meta.json.library_version` for provenance. */
	libraryVersion: string;
}

/**
 * Per-band element counts captured during a render. Useful for the snapshot
 * tests + for debugging "why is this chart empty?" without re-rendering.
 */
export type LayerCounts = Partial<Record<LayerBand, number>>;

export interface ChartRenderMeta {
	layer_counts: LayerCounts;
	drawn_pixels: number;
	parser_warnings: string[];
}

export interface ChartRenderResult {
	svg: string;
	meta: ChartRenderMeta;
}

/**
 * Every chart renderer in `libs/wx-charts/src/charts/*.ts` exports a
 * function with this signature. The CLI looks up the renderer by
 * `spec.type` via the `CHART_RENDERERS` registry and calls it with the
 * resolved inputs. No I/O happens inside renderers.
 */
export type ChartRenderer<TSpec extends ChartSpec = ChartSpec> = (
	input: ChartRenderInput<TSpec>,
) => Promise<ChartRenderResult>;
