<!--
TransitionStepBody -- the bridge-styled renderer for a step whose linked
node has `kind === 'transition'`. Replaces the 7-phase scaffold; renders
the body as a single block of connective prose with a left visual rule
to telegraph "this is a bridge between X and Y."

Per spec.md "Transition step rendering": transition nodes have no
Discover / Practice / Verify content authored, so the 7-phase scaffold
would render empty. The bridge treatment surfaces the same body in a way
that matches the pedagogical role.
-->
<script lang="ts">
import CourseStepMarkdown from './CourseStepMarkdown.svelte';

interface Props {
	bodyMd: string;
}

let { bodyMd }: Props = $props();
</script>

<section class="transition" aria-label="Bridge content">
	<header class="head">
		<span class="eyebrow">Transition</span>
	</header>
	<div class="prose"><CourseStepMarkdown {bodyMd} /></div>
</section>

<style>
	.transition {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		border-left: 4px solid var(--action-default-edge);
		background: var(--surface-muted);
		border-radius: var(--radius-md);
	}

	.eyebrow {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--action-default-hover);
	}

	.prose :global(p) {
		margin: 0 0 var(--space-md);
		line-height: 1.55;
		color: var(--ink-body);
	}

	.prose :global(p:last-child) {
		margin-bottom: 0;
	}

	.prose :global(a) {
		color: var(--action-default-hover);
	}
</style>
