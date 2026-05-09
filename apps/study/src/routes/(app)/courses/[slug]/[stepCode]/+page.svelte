<script lang="ts">
import { NODE_LIFECYCLES } from '@ab/constants';
import CertOverlayChips from '$lib/components/CertOverlayChips.svelte';
import CourseStepChart from '$lib/components/CourseStepChart.svelte';
import CourseStepFraming from '$lib/components/CourseStepFraming.svelte';
import EncodedTextLadderTabs from '$lib/components/EncodedTextLadderTabs.svelte';
import KnowledgeNodeBody from '$lib/components/KnowledgeNodeBody.svelte';
import TransitionStepBody from '$lib/components/TransitionStepBody.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const course = $derived(data.course);
const step = $derived(data.step);
const parentSection = $derived(data.parentSection);
const node = $derived(data.node);
const phases = $derived(data.phases);
const stepLeaf = $derived(data.stepLeaf);
const overlayActive = $derived(data.overlayActive);
const isEncodedText = $derived(data.isEncodedText);
const isTransition = $derived(data.isTransition);
const chartSlug = $derived(data.chartSlug);

const showFraming = $derived(step.bodyMd !== '');
const isSkeletonNode = $derived(node !== null && node.lifecycle === NODE_LIFECYCLES.SKELETON);

// The transition lens has no contentMd in the node payload directly; we
// fetched the splitContentPhases output instead. For transition rendering
// we want the original markdown -- but we only have the phase split. Pull
// any non-null phase body and join. (Transition nodes typically have one
// `context` body and nothing else; if multiple are authored we render
// them all in order.)
const transitionContent = $derived(
	phases
		.map((p) => p.body)
		.filter((b): b is string => b !== null && b.length > 0)
		.join('\n\n'),
);
</script>

<svelte:head>
	<title>{step.title} -- {course.title} -- airboss</title>
</svelte:head>

<section class="page">
	{#if showFraming}
		<CourseStepFraming
			courseSlug={course.slug}
			courseTitle={course.title}
			sectionTitle={parentSection?.title ?? null}
			stepTitle={step.title}
			bodyMd={step.bodyMd}
		/>
	{/if}

	{#if overlayActive && stepLeaf}
		<CertOverlayChips leaf={stepLeaf} />
	{/if}

	{#if node === null}
		<p class="missing-node">This step has no linked knowledge node.</p>
	{:else if isSkeletonNode}
		<section class="skeleton-placeholder" aria-label="Linked node body">
			<h2>{node.title}</h2>
			<p>Content authoring in progress for this knowledge node.</p>
		</section>
	{:else if isTransition}
		<TransitionStepBody contentMd={transitionContent} />
	{:else}
		{#if isEncodedText}
			<EncodedTextLadderTabs />
		{/if}
		<KnowledgeNodeBody {phases} masteryCriteria={node.masteryCriteria} ariaLabel="Linked node body" />
	{/if}

	{#if chartSlug}
		<CourseStepChart slug={chartSlug} />
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 70rem;
		margin: 0 auto;
		width: 100%;
	}

	.missing-node {
		margin: 0;
		padding: var(--space-md);
		color: var(--ink-faint);
		font-style: italic;
		background: var(--surface-muted);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
	}

	.skeleton-placeholder {
		padding: var(--space-md) var(--space-lg);
		background: var(--surface-muted);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.skeleton-placeholder h2 {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-heading-2-size);
	}

	.skeleton-placeholder p {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}
</style>
