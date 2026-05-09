<script lang="ts">
import type { LensLeaf, LensTreeNode } from '@ab/bc-study';
import { COURSE_STATUS_LABELS, type CourseStatus, ROUTES } from '@ab/constants';
import { renderMarkdown } from '@ab/utils';
import CertGapsPanel from '$lib/components/CertGapsPanel.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const course = $derived(data.course);
const lensResult = $derived(data.lensResult);
const overlayActive = $derived(data.overlayActive);
const stepCodeByLeafId = $derived(data.stepCodeByLeafId);

function statusLabel(status: CourseStatus): string {
	return COURSE_STATUS_LABELS[status] ?? status;
}

const courseRollup = $derived(lensResult.rollup);
const masteryPercent = $derived(Math.round(courseRollup.masteryFraction * 100));

// The lens emits one root tree node per call (`level: 'course'`); pull the
// section children out so we can render the two-level tree directly.
const sections = $derived<LensTreeNode[]>(lensResult.tree.length > 0 ? (lensResult.tree[0]?.children ?? []) : []);

const certGaps = $derived(lensResult.certGaps ?? []);

function masteryClass(leaf: LensLeaf): string {
	if (leaf.mastery.mastered) return 'mastered';
	if (leaf.mastery.covered) return 'covered';
	return 'unseen';
}

function masteryLabel(leaf: LensLeaf): string {
	if (leaf.mastery.mastered) return 'Mastered';
	if (leaf.mastery.covered) return 'Covered';
	return 'Unseen';
}

/**
 * Resolve the step's authored `course_step.code` from its lens-leaf id.
 * The loader builds the map; if a leaf surfaces without a matching code
 * (impossible for well-formed data) we fall back to the id, which is
 * still a working route param though it 404s.
 */
function leafCode(leaf: LensLeaf): string {
	return stepCodeByLeafId[leaf.id] ?? leaf.id;
}
</script>

<svelte:head>
	<title>{course.title} -- Courses -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.COURSES}>Courses</a>
		<span aria-hidden="true">/</span>
		<span>{course.title}</span>
	</nav>

	<header class="hd">
		<div class="title-row">
			<h1>{course.title}</h1>
			<span class="badge status-{course.status}">{statusLabel(course.status)}</span>
		</div>
		{#if course.description}
			<div class="prose">{@html renderMarkdown(course.description)}</div>
		{/if}
	</header>

	<section class="mastery-panel" aria-label="Course mastery">
		<div class="mastery-head">
			<span class="mastery-label">Course mastery</span>
			<span class="mastery-pct">
				{masteryPercent}% ({courseRollup.masteredLeaves} of {courseRollup.totalLeaves} mastered)
			</span>
		</div>
		<div
			class="mastery-bar"
			role="progressbar"
			aria-label="Course mastery"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={masteryPercent}
		>
			<span class="mastery-fill" style:width="{masteryPercent}%"></span>
		</div>
	</section>

	{#if sections.length === 0}
		<p class="empty-tree">No sections authored yet.</p>
	{:else}
		<section class="tree" aria-label="Course tree">
			{#each sections as section (section.id)}
				<article class="section-block" aria-labelledby="sec-{section.id}">
					<header class="section-head">
						<h2 id="sec-{section.id}" class="section-title">{section.title}</h2>
						<span class="section-rollup">
							{section.rollup.masteredLeaves}/{section.rollup.totalLeaves} mastered
						</span>
					</header>
					{#if (section.leaves ?? []).length === 0}
						<p class="empty-section">No steps yet.</p>
					{:else}
						<ul class="leaf-list">
							{#each section.leaves ?? [] as leaf (leaf.id)}
								<li class="leaf-row">
									<a class="leaf-link" href={ROUTES.COURSE_STEP(course.slug, leafCode(leaf))}>
										<span class="leaf-title">{leaf.title}</span>
										<span class="leaf-mastery mastery-{masteryClass(leaf)}">
											{masteryLabel(leaf)}
										</span>
										{#if overlayActive && leaf.sources?.inCert && leaf.sources?.certCode}
											<span class="cert-chip" title="Satisfies cert leaf {leaf.sources.certCode}">
												{leaf.sources.certCode}
											</span>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</article>
			{/each}
		</section>
	{/if}

	{#if overlayActive}
		<CertGapsPanel gaps={certGaps} heading="Cert gaps under this overlay" />
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

	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.crumb a {
		color: var(--ink-subtle);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.prose :global(p) {
		margin: var(--space-sm) 0;
		line-height: 1.55;
		color: var(--ink-body);
	}

	.badge {
		display: inline-flex;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.status-active {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.status-archived {
		color: var(--ink-subtle);
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
	}

	.status-draft {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.mastery-panel {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.mastery-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.mastery-label {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		font-weight: 600;
	}

	.mastery-pct {
		font-size: var(--type-definition-body-size);
		color: var(--ink-body);
		font-weight: 600;
	}

	.mastery-bar {
		width: 100%;
		height: 8px;
		background: var(--edge-default);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.mastery-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
	}

	.tree {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.section-block {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
	}

	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: var(--space-sm);
	}

	.section-title {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.section-rollup {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.leaf-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.leaf-row {
		background: var(--surface-muted);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
	}

	.leaf-link {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		text-decoration: none;
		color: inherit;
	}

	.leaf-title {
		flex: 1 1 auto;
		color: var(--ink-body);
	}

	.leaf-mastery {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.mastery-mastered {
		color: var(--signal-success);
	}

	.mastery-covered {
		color: var(--action-default-hover);
	}

	.mastery-unseen {
		color: var(--ink-faint);
	}

	.cert-chip {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		border: 1px solid var(--action-default-edge);
		font-family: var(--font-family-mono);
	}

	.empty-tree,
	.empty-section {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}
</style>
