<script lang="ts">
/**
 * Cert map panel. Tab strip + a single recursive `<MapTree>` rendering
 * the active projection.
 *
 * Tab navigation is a full SvelteKit page navigation (anchor + query
 * param) so the browser back-button stays honest and the active tab is
 * preserved after a refresh. The page loader writes the user's
 * preferred tab to `study.user_pref.study.home.map_tab` so the next
 * load picks it up via the citation order pattern.
 *
 * Tab buttons follow the WAI-ARIA tabs pattern: `role="tab"` with
 * `aria-selected`. Arrow-key roving focus is left to the browser default
 * since each tab is a real link (Tab + Enter is the canonical sequence).
 */

import { type CitationOrder, STUDY_MAP_TABS, type StudyMapTab } from '@ab/constants';
import type { MapNode } from '../_lib/map-types';
import MapTree from './MapTree.svelte';

interface Props {
	tab: StudyMapTab;
	tree: MapNode[];
	citationOrder: CitationOrder;
}

let { tab, tree, citationOrder }: Props = $props();

const tabs: ReadonlyArray<{ id: StudyMapTab; label: string }> = [
	{ id: STUDY_MAP_TABS.ACS, label: 'ACS' },
	{ id: STUDY_MAP_TABS.HANDBOOK, label: 'Handbook' },
	{ id: STUDY_MAP_TABS.COURSE, label: 'Course' },
];

function tabHref(t: StudyMapTab): string {
	return `?tab=${encodeURIComponent(t)}`;
}
</script>

<section class="map" aria-labelledby="map-h">
	<header class="hd-row">
		<h2 id="map-h" class="hd">The map</h2>
		<div class="tabstrip" role="tablist" aria-label="Map projection">
			{#each tabs as t (t.id)}
				<a
					class="tab"
					href={tabHref(t.id)}
					role="tab"
					aria-selected={t.id === tab ? 'true' : 'false'}
					tabindex={t.id === tab ? 0 : -1}
				>
					{t.label}
				</a>
			{/each}
		</div>
	</header>

	{#if tree.length === 0}
		<p class="empty">No content for this projection yet.</p>
	{:else}
		<MapTree nodes={tree} {citationOrder} />
	{/if}

	{#if tab !== STUDY_MAP_TABS.ACS}
		<p class="mobile-hint" aria-hidden="true">
			Switch to desktop for the full map.
		</p>
	{/if}
</section>

<style>
.map {
	display: flex;
	flex-direction: column;
	gap: var(--space-md);
}

.hd-row {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: var(--space-md);
	flex-wrap: wrap;
}

.hd {
	margin: 0;
	font-size: var(--font-size-base);
	color: var(--ink-muted);
	font-weight: var(--font-weight-regular);
	text-transform: uppercase;
	letter-spacing: var(--letter-spacing-wide);
}

.tabstrip {
	display: flex;
	gap: var(--space-2xs);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-md);
	overflow: hidden;
}

.tab {
	display: inline-block;
	padding: var(--space-2xs) var(--space-sm);
	color: var(--ink-body);
	background: var(--surface-panel);
	font-size: var(--font-size-sm);
	text-decoration: none;
	border-right: 1px solid var(--edge-default);
}

.tab:last-child {
	border-right: none;
}

.tab[aria-selected='true'] {
	background: var(--link-default);
	color: var(--surface-panel);
}

.empty {
	color: var(--ink-muted);
	font-size: var(--font-size-base);
}

.mobile-hint {
	display: none;
	color: var(--ink-muted);
	font-size: var(--font-size-sm);
}

@media (max-width: 700px) {
	.mobile-hint {
		display: block;
	}
}
</style>
