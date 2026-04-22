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
		margin: 0.75rem 0;
		padding: 1rem;
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
	}

	.activity figcaption {
		margin-top: 0.625rem;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-sm);
		text-align: center;
	}

	.unknown {
		margin: 0.75rem 0;
		padding: 0.75rem 1rem;
		background: var(--ab-color-warning-subtle);
		border: 1px solid var(--ab-color-warning-subtle-border);
		border-radius: var(--ab-radius-md);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-warning-active);
	}

	.unknown code {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		background: white;
		padding: 0.05em 0.35em;
		border-radius: var(--ab-radius-xs);
	}
</style>
