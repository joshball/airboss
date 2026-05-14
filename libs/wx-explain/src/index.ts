/**
 * `@ab/wx-explain` -- per-token annotation generators for encoded-text
 * weather products. Browser-safe. Pairs with `@ab/wx-charts` parsers and
 * (optionally) the `TruthModel` shape from `@ab/wx-engine` for synoptic
 * `why` lines.
 */

export { explainAirmet } from './airmet';
export { explainFb } from './fb';
export { explainMetar, kmBetween } from './metar';
export { explainPirep } from './pirep';
export { explainTaf } from './taf';
export type { TokenAnnotation } from './types';
