<script lang="ts" module>
import type { SourceId } from '@ab/sources';

/**
 * `<CitationChip>` -- compact link primitive that turns an `airboss-ref:`
 * URI into a flightbag link.
 *
 * Today this is a stub: it renders the URI text inside an anchor whose
 * `href` is computed via `urlForReference`. The downstream rendering WP
 * will swap the URI text for a humanised label (resolved via the registry's
 * `canonical_short`) and surface adjacency-aware grouping.
 *
 * The component shape (props, slots, exports) is locked here so callers
 * across study / sim / hangar / avionics can adopt it now and let the
 * rendering improvements land transparently in a follow-on.
 */

export interface CitationChipProps {
	/** Canonical `airboss-ref:` URI. */
	readonly uri: SourceId;
	/** Optional override label; defaults to the URI string itself. */
	readonly label?: string;
}
</script>

<script lang="ts">
import { urlForReference } from '@ab/sources';

let { uri, label }: CitationChipProps = $props();

const href = $derived(urlForReference(uri));
const display = $derived(label ?? uri);
</script>

<a class="chip" data-testid="citation-chip" data-ref-uri={uri} {href}>{display}</a>

<style>
.chip {
	display: inline-flex;
	align-items: center;
	gap: var(--space-xs);
	padding: var(--space-xs) var(--space-sm);
	border-radius: var(--radius-sm);
	background: var(--surface-panel);
	border: 1px solid var(--edge-default);
	color: var(--ink-body);
	font-size: var(--type-ui-label-size);
	text-decoration: none;
}

.chip:hover,
.chip:focus-visible {
	border-color: var(--edge-emphasized);
	color: var(--ink-strong);
}
</style>
