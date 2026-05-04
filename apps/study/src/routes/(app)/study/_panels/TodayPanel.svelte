<script lang="ts">
/**
 * Today briefing panel. Renders the deterministic prose helper output
 * for the current `TodayBriefing`. Three shapes:
 *
 *   - `no-goal`: nothing renders here (the page-level banner replaces this
 *     panel).
 *   - `caught_up`: friendly nudge.
 *   - `focus`: headline (leaf title) + body paragraph + CTA link to the
 *     focus knowledge node.
 */

import { renderTodayProse } from '../_lib/today-prose';
import type { TodayBriefing } from '../_lib/today-types';

let { briefing }: { briefing: TodayBriefing } = $props();

const rendered = $derived(renderTodayProse(briefing));
const isNoGoal = $derived(briefing.kind === 'no-goal');
</script>

{#if !isNoGoal}
	<section class="today" aria-labelledby="today-h">
		<h2 id="today-h" class="hd">Today</h2>
		{#if rendered.headline.length > 0}
			<p class="headline">{rendered.headline}</p>
		{/if}
		<p class="body">{rendered.body}</p>
		{#if rendered.cta !== null}
			<p class="cta">
				<a href={rendered.cta.href}>{rendered.cta.label}</a>
			</p>
		{/if}
	</section>
{/if}

<style>
.today {
	display: flex;
	flex-direction: column;
	gap: var(--space-sm);
}

.hd {
	margin: 0;
	font-size: var(--font-size-base);
	color: var(--ink-muted);
	font-weight: var(--font-weight-regular);
	text-transform: uppercase;
	letter-spacing: var(--letter-spacing-wide);
}

.headline {
	margin: 0;
	font-size: var(--font-size-lg);
	font-weight: var(--font-weight-medium);
	color: var(--ink-body);
}

.body {
	margin: 0;
	font-size: var(--font-size-base);
	color: var(--ink-body);
	max-width: 70ch;
}

.cta a {
	color: var(--link-default);
	text-decoration: underline;
}
</style>
