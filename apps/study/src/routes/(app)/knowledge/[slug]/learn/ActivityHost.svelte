<script lang="ts">
import CrosswindComponent from '@ab/activities/crosswind-component/CrosswindComponent.svelte';

interface Props {
	/** The `activity:<id>` value from the authored markdown. */
	activityId: string;
}

let { activityId }: Props = $props();

/**
 * Activity registry. A switch statement is the simplest thing that captures
 * "known activity ids map to known components". When the second activity
 * lands we extend this list; no plugin infrastructure until it pays for
 * itself.
 */
</script>

{#if activityId === 'crosswind-component'}
	<figure class="activity">
		<CrosswindComponent maxDemoCrosswind={15} />
		<figcaption>Interactive activity: drag the wind to see the crosswind + headwind split change.</figcaption>
	</figure>
{:else}
	<aside class="unknown" role="note">
		Activity <code>{activityId}</code> is referenced but not yet registered in the UI.
	</aside>
{/if}

<style>
	.activity {
		margin: var(--space-md) 0;
		padding: var(--space-lg);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
	}

	.activity figcaption {
		margin-top: var(--space-sm);
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
		text-align: center;
	}

	.unknown {
		margin: var(--space-md) 0;
		padding: var(--space-md) var(--space-lg);
		background: var(--signal-warning-wash);
		border: 1px solid var(--signal-warning-edge);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
		color: var(--signal-warning);
	}

	.unknown code {
		font-family: var(--font-family-mono);
		background: var(--ink-inverse);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
	}
</style>
