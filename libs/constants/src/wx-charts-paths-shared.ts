/**
 * Shared literals for the wx-chart artifact layout (ADR 027 PR 3).
 *
 * The three on-disk family subdirectories under `data/charts/wx/`:
 *
 *   - `reference-fixtures/` -- hand-traced wx-charts visual baselines.
 *   - `wx-scenarios/`       -- engine-generated scenario chart artifacts.
 *   - `mockups/`            -- internal design exploration; not addressable
 *                              via slug helpers and excluded from listings.
 *
 * Lives in a standalone module so both `wx-charts-paths.ts` and
 * `wx-engine-paths.ts` can import it without creating a cycle.
 */

export const WX_CHART_FAMILIES = {
	REFERENCE_FIXTURES: 'reference-fixtures',
	WX_SCENARIOS: 'wx-scenarios',
	MOCKUPS: 'mockups',
} as const;

export type WxChartFamily = (typeof WX_CHART_FAMILIES)[keyof typeof WX_CHART_FAMILIES];
