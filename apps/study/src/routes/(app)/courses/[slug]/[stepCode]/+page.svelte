<script lang="ts">
import { ROUTES } from '@ab/constants';
import CourseStepMarkdown from '$lib/components/CourseStepMarkdown.svelte';
import EncodedTextLadderTabs from '$lib/components/EncodedTextLadderTabs.svelte';
import KnowledgeNodeBody from '$lib/components/KnowledgeNodeBody.svelte';
import TransitionStepBody from '$lib/components/TransitionStepBody.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const course = $derived(data.course);
const step = $derived(data.step);
const node = $derived(data.node);
const phases = $derived(data.phases);
const certChip = $derived(data.certChip);
const overlayActive = $derived(data.overlayActive);
const isEncodedText = $derived(data.isEncodedText);
const isTransition = $derived(data.isTransition);

const hasStepFraming = $derived(step.bodyMd !== '');
const hasNodeBody = $derived(node !== null && (node.contentMd ?? '').trim() !== '');
const isNodeSkeleton = $derived(node !== null && !hasNodeBody);
</script>

<svelte:head>
	<title>{step.title} -- {course.title} -- airboss</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb">
		<ol class="crumb">
			<li><a href={ROUTES.COURSES}>Courses</a></li>
			<li><a href={ROUTES.COURSE(course.slug)}>{course.title}</a></li>
			<li aria-current="page">{step.title}</li>
		</ol>
	</nav>

	<header class="hd">
		<h1>{step.title}</h1>
		{#if overlayActive && certChip !== null}
			<aside class="cert-chips" aria-label="Cert coverage">
				<span class="cert-chip">In {certChip.code}</span>
			</aside>
		{/if}
	</header>

	{#if hasStepFraming}
		<section class="framing" aria-label="Step framing">
			<CourseStepMarkdown bodyMd={step.bodyMd} />
		</section>
	{/if}

	{#if isEncodedText}
		<EncodedTextLadderTabs />
	{/if}

	{#if node === null}
		<section class="missing-node" aria-label="Linked node">
			<p>This step has no knowledge node linked. Authoring is in progress.</p>
		</section>
	{:else if isNodeSkeleton}
		<section class="missing-node" aria-label="Linked node">
			<h2>{node.title}</h2>
			<p>Content authoring in progress for this node.</p>
		</section>
	{:else if isTransition}
		<TransitionStepBody bodyMd={node.contentMd ?? ''} />
	{:else}
		<KnowledgeNodeBody {phases} ariaLabel="Step content" />
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.crumb {
		display: flex;
		gap: var(--space-sm);
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
	}

	.crumb li + li::before {
		content: '/';
		margin-right: var(--space-sm);
		color: var(--ink-faint);
	}

	.crumb a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-md);
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.cert-chips {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.cert-chip {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.framing {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
	}

	.missing-node {
		background: var(--surface-muted);
		border: 1px dashed var(--edge-strong);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
		text-align: center;
		color: var(--ink-muted);
	}

	.missing-node h2 {
		margin: 0 0 var(--space-sm);
		color: var(--ink-body);
	}

	.missing-node p {
		margin: 0;
	}
</style>
