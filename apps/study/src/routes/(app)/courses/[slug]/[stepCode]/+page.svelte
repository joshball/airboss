<script lang="ts">
import { COURSE_STEP_LEVEL_LABELS, type CourseStepLevel, ROUTES } from '@ab/constants';
import { renderMarkdown } from '@ab/utils';
import CourseStepMarkdown from '$lib/components/CourseStepMarkdown.svelte';
import EncodedTextLadderTabs from '$lib/components/EncodedTextLadderTabs.svelte';
import KnowledgeNodeBody from '$lib/components/KnowledgeNodeBody.svelte';
import TransitionStepBody from '$lib/components/TransitionStepBody.svelte';
import Breadcrumbs from './Breadcrumbs.svelte';
import type { PageData } from './$types';
import PrevNext from './PrevNext.svelte';

let { data }: { data: PageData } = $props();

const course = $derived(data.course);
const step = $derived(data.step);
const isLeaf = $derived(data.isLeaf);
const node = $derived(data.node);
const phases = $derived(data.phases);
const children = $derived(data.children);
const breadcrumbs = $derived(data.breadcrumbs);
const prev = $derived(data.prev);
const next = $derived(data.next);
const certChip = $derived(data.certChip);
const overlayActive = $derived(data.overlayActive);
const isEncodedText = $derived(data.isEncodedText);
const isTransition = $derived(data.isTransition);

const hasStepFraming = $derived(step.bodyMd !== '');
const hasNodeBody = $derived(node !== null && (node.contentMd ?? '').trim() !== '');
const isNodeSkeleton = $derived(isLeaf && node !== null && !hasNodeBody);
</script>

<svelte:head>
	<title>{step.title} -- {course.title} -- airboss</title>
</svelte:head>

<section class="page">
	<Breadcrumbs
		courseSlug={course.slug}
		courseTitle={course.title}
		crumbs={breadcrumbs}
		current={{ title: step.title }}
	/>

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

	{#if isLeaf}
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
	{:else}
		<section class="children" aria-label="Children">
			<h2 class="children-h">In this {COURSE_STEP_LEVEL_LABELS[step.level as CourseStepLevel].toLowerCase()}</h2>
			{#if children.length === 0}
				<p class="empty">No children authored yet.</p>
			{:else}
				<ol class="child-list">
					{#each children as child (child.id)}
						<li class="child-card">
							<a class="child-link" href={ROUTES.COURSE_STEP(course.slug, child.code)}>
								<header class="child-head">
									<span class="child-badge level-{child.level}">{COURSE_STEP_LEVEL_LABELS[child.level]}</span>
									<span class="child-code">{child.code}</span>
									<h3 class="child-title">{child.title}</h3>
								</header>
								{#if child.bodyPreview !== ''}
									<div class="child-preview prose">{@html renderMarkdown(child.bodyPreview)}</div>
								{/if}
							</a>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	{/if}

	<PrevNext courseSlug={course.slug} {prev} {next} />
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
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

	.children {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.children-h {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.empty {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}

	.child-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.child-card {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.child-link {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		text-decoration: none;
		color: var(--ink-body);
		transition: border-color var(--motion-fast) ease;
	}

	.child-card:hover {
		border-color: var(--action-default-edge);
		background: var(--surface-muted);
	}

	.child-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.child-badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		background: var(--surface-muted);
		color: var(--ink-muted);
		border: 1px solid var(--edge-default);
	}

	.level-section {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.level-lesson {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.child-code {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.child-title {
		margin: 0;
		flex: 1 1 auto;
		font-size: var(--type-heading-4-size);
		color: var(--ink-body);
	}

	.child-preview {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.prose :global(p) {
		margin: 0;
		line-height: 1.55;
	}
</style>
