/**
 * Phase 10 -- VFR sectional chart locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("Sectionals").
 *
 * Locator shape:
 *
 *   <chart-name>                              e.g. denver, los-angeles, seattle
 *
 * Chart names are lowercase kebab-case. The FAA's VFR catalog publishes
 * 56 sectional charts covering CONUS plus Alaska/Hawaii; the locator
 * preserves the catalog name verbatim (lowercased, dashed).
 *
 * Pin format: `?at=YYYY-MM-DD` (NACO 56-day cycle date).
 */

import type { LocatorError, ParsedLocator, ParsedSectionalsLocator } from '../types.ts';

const CHART_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `sectionals` corpus locator. The locator is the segment after
 * `airboss-ref:sectionals/`, stripped of `?at=...`.
 */
export function parseSectionalsLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('sectionals locator is empty');
	}

	const segments = locator.split('/');
	if (segments.length > 1) {
		return err(`sectionals locator has unexpected segments (expected single chart name, got "${locator}")`);
	}
	const chartName = segments[0] ?? '';
	if (chartName.length === 0) {
		return err('sectionals locator missing chart name');
	}
	if (!CHART_NAME_PATTERN.test(chartName)) {
		return err(
			`sectionals locator chart name "${chartName}" is malformed (expected lowercase kebab-case, e.g. "denver", "los-angeles")`,
		);
	}
	const sectionals: ParsedSectionalsLocator = { chartName };
	return { kind: 'ok', segments, sectionals };
}

/**
 * Format a sectional locator. Round-trips with `parseSectionalsLocator`.
 */
export function formatSectionalsLocator(parsed: ParsedSectionalsLocator): string {
	return parsed.chartName;
}
