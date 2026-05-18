/**
 * Shared spatial-ui types.
 *
 * `.svelte` components cannot export plain types from their instance
 * `<script>` block, so renderer-shared types live here.
 */

import type { LegPerformance, LegPlaceholder } from '@ab/spatial-engine';

/**
 * A leg the `LegLabel` can render -- either a Phase-C geometry placeholder
 * or a Phase-E full performance row.
 */
export type LegLabelData = LegPerformance | LegPlaceholder;
