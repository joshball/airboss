/**
 * `@ab/wx-explain` -- per-token annotation generators for encoded-text
 * weather products. Browser-safe. Pairs with `@ab/wx-charts` parsers and
 * (optionally) the `TruthModel` shape from `@ab/wx-engine` for synoptic
 * `why` lines.
 */

export { explainAirmet } from './airmet';
export { explainFb } from './fb';
// Hazard product decoder -- raw-text in, decoded model + CLI render out.
export { type DecodeOptions, type DecodeResult, decodeHazardText } from './hazards/decode';
export { type FormatOptions, formatHazards } from './hazards/format-cli';
export {
	looksLikeConvectiveSigmet,
	ParseError as HazardParseError,
	parseConvectiveSigmet,
} from './hazards/parse-convective-sigmet';
export { looksLikeSvrWarning, parseSvrWarning } from './hazards/parse-svr-warning';
export type {
	AwcRegion,
	ConvectiveOutlook,
	ConvectiveOutlookArea,
	ConvectivePhenomenon,
	ConvectiveSigmet,
	DecodedHazard,
	HazardBoundary,
	HazardFromPoint,
	HazardKind,
	HazardMovement,
	HazardQuadrant,
	HazardSeverity,
	SevereThunderstormWarning,
} from './hazards/types';
export { explainMetar, kmBetween } from './metar';
export { explainPirep } from './pirep';
export { explainTaf } from './taf';
export type { TokenAnnotation } from './types';
