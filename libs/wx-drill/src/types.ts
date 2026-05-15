/**
 * `@ab/wx-drill` -- types shared by the sampler, MD renderer, and CLI / app
 * consumers. Pure data; browser-safe.
 */

import type { WxProduct, WxScenario } from '@ab/constants';
import type { TokenAnnotation } from '@ab/wx-explain';

export type DrillLayout = 'interleaved' | 'two-section';

export type DrillCoverage = 'balanced' | 'random' | 'gap-filling';

export interface DrillItem {
	index: number;
	product: WxProduct;
	scenarioSlug: WxScenario;
	stationIcao: string | null;
	raw: string;
	annotations: TokenAnnotation[];
	exercisedFamilies: string[];
}

export interface DrillCoverageReport {
	totalFamilies: number;
	coveredFamilies: number;
	uncoveredFamilies: string[];
}

export interface DrillPackArgs {
	count: number;
	products: WxProduct[];
	layout: DrillLayout;
	seed: number;
	fromScenarios: 'all' | WxScenario[];
	coverage: DrillCoverage;
}

export interface DrillPack {
	generatedAt: string;
	args: DrillPackArgs;
	items: DrillItem[];
	coverageReport: DrillCoverageReport;
}
