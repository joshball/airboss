/**
 * `@ab/wx-charts` -> `wx/metar/` barrel.
 *
 * Re-exports the parser + types together so consumers can write
 * `import { parseMetar, type ParsedMetar } from '@ab/wx-charts'`
 * (the runtime barrel forwards from here).
 *
 * Browser-safe: types + a pure parser, no Node imports.
 */

export { parseMetar } from './parser';
export type { CloudLayer, ParsedMetar, SkyCover, WindGroup } from './types';
