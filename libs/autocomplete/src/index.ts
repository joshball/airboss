// @ab/autocomplete -- generic input-autocomplete component + sources.
//
// Phase 3.5 of the command-palette WP (decision R13): the autocomplete is
// extracted from the search modal so future surfaces (header search,
// /library filter, Phase 4 command mode, Phase 5 quick-open) can wear the
// same affordance with different sources.
//
// Browser-safe by construction: only `@ab/aviation` (browser-safe) +
// `@ab/constants` are imported. No `node:*`, no `@ab/db/connection`.
//
// Public API:
//   - `<Autocomplete>` component (svelte 5; runes only)
//   - `AutocompleteSource`, `AutocompleteEntry`, `AutocompleteProps`
//   - Bundled sources: `DocCodeSource`, `TitlePrefixSource`

export { default as Autocomplete } from './Autocomplete.svelte';
export { DOC_CODE_SOURCE_ID, DocCodeSource } from './DocCodeSource';
export { TITLE_PREFIX_SOURCE_ID, TitlePrefixSource } from './TitlePrefixSource';
export type { AutocompleteEntry, AutocompleteProps, AutocompleteSource } from './types';
