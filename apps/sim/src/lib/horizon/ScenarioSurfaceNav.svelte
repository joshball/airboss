<script lang="ts">
/**
 * Surface-switcher for a sim scenario. Renders three sibling links --
 * cockpit / horizon / dual -- with the current surface marked
 * `aria-current="page"`. Any sim page that wants to expose the other
 * surfaces drops this in. The component holds no state and imports
 * nothing surface-specific; it is purely a navigation widget keyed on
 * scenario id.
 *
 * Lives in `lib/horizon/` because it landed with the Phase 7 horizon
 * work; can be moved to `lib/nav/` later if other nav widgets accumulate.
 */

import { ROUTES, type SimScenarioId } from '@ab/constants';

interface Props {
	scenarioId: SimScenarioId;
	current: 'cockpit' | 'horizon' | 'dual';
}

let { scenarioId, current }: Props = $props();
</script>

<nav class="surface-nav" aria-label="Scenario surfaces">
	<a
		href={ROUTES.SIM_SCENARIO(scenarioId)}
		class:current={current === 'cockpit'}
		aria-current={current === 'cockpit' ? 'page' : undefined}
	>
		Cockpit
	</a>
	<a
		href={ROUTES.SIM_SCENARIO_HORIZON(scenarioId)}
		class:current={current === 'horizon'}
		aria-current={current === 'horizon' ? 'page' : undefined}
	>
		Horizon
	</a>
	<a
		href={ROUTES.SIM_SCENARIO_DUAL(scenarioId)}
		class:current={current === 'dual'}
		aria-current={current === 'dual' ? 'page' : undefined}
	>
		Dual
	</a>
</nav>

<style>
	.surface-nav {
		display: flex;
		gap: var(--space-md);
		font-size: var(--font-size-sm);
	}
	.surface-nav a {
		color: var(--ink-muted);
		text-decoration: none;
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-xs);
	}
	.surface-nav a:hover {
		color: var(--ink-body);
	}
	.surface-nav a.current {
		color: var(--ink-body);
		background: var(--edge-default);
	}
</style>
