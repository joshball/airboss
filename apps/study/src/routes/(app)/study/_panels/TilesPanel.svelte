<script lang="ts">
/**
 * Five-tile entry row. Equal weight by design (no primary CTA): the
 * user picks the surface they want to study from.
 *
 * Tile targets:
 *
 *   - Read       -> flightbag origin + ROUTES.FLIGHTBAG_HOME (cross-app link)
 *   - Cards      -> ROUTES.MEMORY_REVIEW or MEMORY_REVIEW_FOR_NODE(focus)
 *   - Sim        -> sim app origin (cross-app link)
 *   - Scenarios  -> ROUTES.REPS
 *   - Flight     -> /flight (placeholder; WP 2 ships the real surface)
 */

import type { RepBacklog } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';

interface Props {
	repBacklog: RepBacklog;
	focusNodeId: string | null;
	/**
	 * Recall-gated cards still owed for the active credential. `null`
	 * when the credential has no recall-gated leaves (so we should NOT
	 * pretend the user has zero cards remaining -- there are no cards
	 * to count). The badge reads "--" in that case.
	 */
	dueCardsCount: number | null;
	newCardsCount: number;
	/**
	 * Cross-app origin for the flightbag. Passed in from the layout so the
	 * Read tile points at the canonical FAA-references reader without going
	 * through the legacy `/library` redirect.
	 */
	flightbagOrigin: string;
}

let { repBacklog, focusNodeId, dueCardsCount, newCardsCount, flightbagOrigin }: Props = $props();

const cardsHref = $derived(focusNodeId === null ? ROUTES.MEMORY_REVIEW : ROUTES.MEMORY_REVIEW_FOR_NODE(focusNodeId));
const readHref = $derived(`${flightbagOrigin}${ROUTES.FLIGHTBAG_HOME}`);
const scenariosHref = $derived(ROUTES.REPS);
// Sim is a separate app; today the cross-app link convention here is the
// site-relative `/sim` path (handled by the parent SvelteKit hooks).
const simHref = '/sim';
const flightHref = $derived(ROUTES.FLIGHT);

const cardsBadge = $derived(
	dueCardsCount === null ? '--' : `${dueCardsCount} due${newCardsCount > 0 ? ` / ${newCardsCount} new` : ''}`,
);
const repsBadge = $derived(`${repBacklog.unattempted} ready`);
</script>

<section class="tiles" aria-labelledby="tiles-h">
	<h2 id="tiles-h" class="sr-only">How would you like to study it?</h2>
	<a class="tile" href={readHref}>
		<span class="tile-label">Read</span>
		<span class="tile-badge">Open handbook</span>
	</a>
	<a class="tile" href={cardsHref}>
		<span class="tile-label">Cards</span>
		<span class="tile-badge">{cardsBadge}</span>
	</a>
	<a class="tile" href={simHref}>
		<span class="tile-label">Sim</span>
		<span class="tile-badge">Available</span>
	</a>
	<a class="tile" href={scenariosHref}>
		<span class="tile-label">Scenarios</span>
		<span class="tile-badge">{repsBadge}</span>
	</a>
	<a class="tile" href={flightHref}>
		<span class="tile-label">Flight</span>
		<span class="tile-badge">WP 2</span>
	</a>
</section>

<style>
.tiles {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	gap: var(--space-md);
}

.tile {
	display: flex;
	flex-direction: column;
	gap: var(--space-2xs);
	padding: var(--space-md);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-md);
	background: var(--surface-panel);
	color: var(--ink-body);
	text-decoration: none;
	min-height: 5rem;
	justify-content: center;
	align-items: center;
	text-align: center;
}

.tile:hover {
	background: var(--surface-sunken);
	border-color: var(--edge-strong);
}

.tile:focus-visible {
	outline: 2px solid var(--edge-focus);
	outline-offset: 2px;
}

.tile-label {
	font-size: var(--font-size-base);
	font-weight: var(--font-weight-medium);
}

.tile-badge {
	font-size: var(--font-size-sm);
	color: var(--ink-muted);
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}

@media (max-width: 700px) {
	.tiles {
		grid-template-columns: repeat(2, 1fr);
	}
}
</style>
