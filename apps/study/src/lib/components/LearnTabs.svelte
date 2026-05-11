<!--
@component
Tab strip for the consolidated Learn section (study-app-ia-cleanup Phase 4).

Three tabs share this strip: Cards (`/memory`), Reps (`/reps`), Read
(`/library`). The Memory and Reps URLs intentionally stay where they are
(per the Phase 4 design: nav surface is unified under Learn, but the
underlying URLs do not move). The Learn index at `/study/learn` is a
discovery page; the tabs link out to the canonical section roots.

Each tab anchor carries `data-testid="learn-tab-{name}"` per the e2e
selector convention in `docs/agents/best-practices.md`. The active tab
derives from `page.url.pathname` via prefix match against each section
root, so the strip lights up correctly whether you arrived via Learn or
landed deep on a section sub-route.

Used by:
- `/study/learn/+page.svelte` (the section index)
- Section index pages (`/memory`, `/reps`, `/library`) that want the
  Learn-level orientation rendered above their own page header.
-->
<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import { page } from '$app/state';

interface Props {
	/**
	 * Forces the active tab regardless of the current URL. Useful on the
	 * `/study/learn` index where the URL doesn't match any section root.
	 */
	active?: 'learn' | 'cards' | 'reps' | 'read';
}

let { active }: Props = $props();

function pathMatches(current: string, prefix: string): boolean {
	return current === prefix || current.startsWith(`${prefix}/`);
}

const cardsActive = $derived(active === 'cards' || pathMatches(page.url.pathname, ROUTES.MEMORY));
const repsActive = $derived(active === 'reps' || pathMatches(page.url.pathname, ROUTES.REPS));
// Read is now a cross-app link to the flightbag. The legacy `/library/*`
// paths still 301 to flightbag for any stale bookmark, but the tab itself
// points directly at the canonical reader so a click crosses subdomains
// once instead of round-tripping through study.
const readActive = $derived(active === 'read' || pathMatches(page.url.pathname, ROUTES.LIBRARY));
const learnIndexActive = $derived(active === 'learn' || page.url.pathname === ROUTES.LEARN);
const flightbagOrigin = $derived(page.data.flightbagOrigin ?? '');
const readHref = $derived(`${flightbagOrigin}${ROUTES.FLIGHTBAG_HOME}`);
</script>

<nav class="learn-tabs" aria-label="Learn sub-sections">
	<a href={ROUTES.LEARN} aria-current={learnIndexActive ? 'page' : undefined} data-testid="learn-tab-overview">
		Overview
	</a>
	<a href={ROUTES.MEMORY} aria-current={cardsActive ? 'page' : undefined} data-testid="learn-tab-cards">
		{NAV_LABELS.LEARN_CARDS}
	</a>
	<a href={ROUTES.REPS} aria-current={repsActive ? 'page' : undefined} data-testid="learn-tab-reps">
		{NAV_LABELS.LEARN_REPS}
	</a>
	<a href={readHref} aria-current={readActive ? 'page' : undefined} data-testid="learn-tab-read">
		{NAV_LABELS.LEARN_READ}
	</a>
</nav>

<style>
	.learn-tabs {
		display: flex;
		gap: var(--space-md);
		flex-wrap: wrap;
		border-bottom: 1px solid var(--edge-default);
		padding-bottom: var(--space-2xs);
		margin-bottom: var(--space-lg);
	}

	.learn-tabs a {
		color: var(--ink-muted);
		text-decoration: none;
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.learn-tabs a:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.learn-tabs a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.learn-tabs a[aria-current='page'] {
		color: var(--action-default-hover);
		border-bottom-color: var(--action-default);
	}
</style>
