<script lang="ts">
import type { LensLeaf, LensTreeNode } from '@ab/bc-study';
import { COURSE_STATUS_LABELS, type CourseStatus, QUERY_PARAMS, ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import NotesList from '@ab/ui/components/notes/NotesList.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { renderMarkdown } from '@ab/utils';
import CertGapsPanel from '$lib/components/CertGapsPanel.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const course = $derived(data.course);
const lensResult = $derived(data.lensResult);
const overlayActive = $derived(data.overlayActive);
const stepCodeById = $derived(data.stepCodeById);
const courseNotes = $derived(data.courseNotes);
// `+ Note` pre-fills the course context so the standalone composer
// opens with this course already selected.
const newNoteHref = $derived(`${ROUTES.NOTES_NEW}?${QUERY_PARAMS.NOTE_COURSE_ID}=${encodeURIComponent(course.id)}`);

const root = $derived<LensTreeNode | null>(lensResult.tree[0] ?? null);
const sections = $derived<LensTreeNode[]>(root?.children ?? []);
const certGaps = $derived(lensResult.certGaps ?? []);

function codeFor(id: string): string {
	// Lens emits node ids = course_step.id (cst_ULID). The reader URL uses
	// course_step.code (e.g. `s1.1`, `s1.1.1`) so the URL stays grep-able.
	// The loader builds the lookup map for every row (section / lesson /
	// step) -- non-leaf rows render landing pages with the same URL shape.
	return stepCodeById[id] ?? id;
}

function statusLabel(status: string): string {
	return COURSE_STATUS_LABELS[status as CourseStatus] ?? status;
}

function pct(num: number, den: number): number {
	if (den === 0) return 0;
	return Math.round((num / den) * 100);
}

function masteryStateLabel(leaf: LensLeaf): string {
	if (leaf.mastery.mastered) return 'Mastered';
	if (leaf.mastery.covered) return 'Covered';
	return 'Unseen';
}

function masteryStateClass(leaf: LensLeaf): string {
	if (leaf.mastery.mastered) return 'mastery-mastered';
	if (leaf.mastery.covered) return 'mastery-covered';
	return 'mastery-unseen';
}

// Headings scale with depth: section -> h2, lesson -> h3, deeper -> h4
// (capped at h6 by `Math.min`). Depth starts at 0 for sections.
function headingLevel(depth: number): 2 | 3 | 4 | 5 | 6 {
	const level = Math.min(2 + depth, 6);
	return level as 2 | 3 | 4 | 5 | 6;
}
</script>

<svelte:head>
	<title>{course.title} -- Courses -- airboss</title>
</svelte:head>

{#snippet leafItem(leaf: LensLeaf)}
	<li class="leaf">
		<a class="leaf-link" href={ROUTES.COURSE_STEP(course.slug, codeFor(leaf.id))}>
			<span class="leaf-title">{leaf.title}</span>
			<span class="leaf-meta">
				<span class={`leaf-state ${masteryStateClass(leaf)}`}>
					{masteryStateLabel(leaf)}
				</span>
				{#if overlayActive && leaf.sources?.inCert && leaf.sources.certCode !== undefined}
					<span class="leaf-cert">In {leaf.sources.certCode}</span>
				{/if}
			</span>
		</a>
	</li>
{/snippet}

{#snippet treeNode(node: LensTreeNode, depth: number)}
	{@const isSection = node.level === 'section'}
	{@const isLesson = node.level === 'lesson'}
	{@const hLevel = headingLevel(depth)}
	<li class={isSection ? 'section-card' : 'lesson-card'} data-depth={depth}>
		<header class={isSection ? 'section-head' : 'lesson-head'}>
			{#if hLevel === 2}
				<h2 class="node-title">
					<a class="node-link" href={ROUTES.COURSE_STEP(course.slug, codeFor(node.id))}>{node.title}</a>
				</h2>
			{:else if hLevel === 3}
				<h3 class="node-title">
					<a class="node-link" href={ROUTES.COURSE_STEP(course.slug, codeFor(node.id))}>{node.title}</a>
				</h3>
			{:else if hLevel === 4}
				<h4 class="node-title">
					<a class="node-link" href={ROUTES.COURSE_STEP(course.slug, codeFor(node.id))}>{node.title}</a>
				</h4>
			{:else if hLevel === 5}
				<h5 class="node-title">
					<a class="node-link" href={ROUTES.COURSE_STEP(course.slug, codeFor(node.id))}>{node.title}</a>
				</h5>
			{:else}
				<h6 class="node-title">
					<a class="node-link" href={ROUTES.COURSE_STEP(course.slug, codeFor(node.id))}>{node.title}</a>
				</h6>
			{/if}
			{#if node.rollup.totalLeaves > 0}
				<span class="node-rollup">
					{node.rollup.masteredLeaves} / {node.rollup.totalLeaves} mastered
				</span>
			{/if}
		</header>

		{#if (node.leaves === undefined || node.leaves.length === 0) && node.children.length === 0}
			<p class={isLesson ? 'lesson-empty' : 'section-empty'}>
				{isLesson ? 'No steps in this lesson yet.' : 'No steps in this section yet.'}
			</p>
		{:else}
			{#if node.leaves !== undefined && node.leaves.length > 0}
				<ul class="leaves">
					{#each node.leaves as leaf (leaf.id)}
						{@render leafItem(leaf)}
					{/each}
				</ul>
			{/if}
			{#if node.children.length > 0}
				<ol class="children">
					{#each node.children as child (child.id)}
						{@render treeNode(child, depth + 1)}
					{/each}
				</ol>
			{/if}
		{/if}
	</li>
{/snippet}

<section class="page">
	<nav aria-label="Breadcrumb">
		<ol class="crumb">
			<li><a href={ROUTES.COURSES}>Courses</a></li>
			<li aria-current="page">{course.title}</li>
		</ol>
	</nav>

	<PageHeader title={course.title}>
		{#snippet titleSuffix()}
			<span class="status status-{course.status}">{statusLabel(course.status)}</span>
		{/snippet}
	</PageHeader>

	{#if course.description !== ''}
		<div class="prose description">{@html renderMarkdown(course.description)}</div>
	{/if}

	{#if root !== null && root.rollup.totalLeaves > 0}
		<section class="rollup" aria-label="Course mastery">
			<div class="rollup-head">
				<span class="rollup-label">Mastery</span>
				<span class="rollup-value">
					{root.rollup.masteredLeaves} of {root.rollup.totalLeaves} mastered
					({pct(root.rollup.masteredLeaves, root.rollup.totalLeaves)}%)
				</span>
			</div>
			<div
				class="mastery-bar"
				role="progressbar"
				aria-label="Course mastery"
				aria-valuemin="0"
				aria-valuemax={root.rollup.totalLeaves}
				aria-valuenow={root.rollup.masteredLeaves}
			>
				<span
					class="mastery-fill"
					style:width="{pct(root.rollup.masteredLeaves, root.rollup.totalLeaves)}%"
				></span>
			</div>
		</section>
	{/if}

	{#if sections.length === 0}
		<EmptyState
			title="Course outline coming soon"
			body="This course has no sections yet. Check back once authoring is further along."
		/>
	{:else}
		<ol class="sections">
			{#each sections as section (section.id)}
				{@render treeNode(section, 0)}
			{/each}
		</ol>
	{/if}

	{#if overlayActive && certGaps.length > 0}
		<CertGapsPanel gaps={certGaps} />
	{/if}

	<section class="notes-block" aria-labelledby="course-notes-h">
		<header class="notes-head">
			<h2 id="course-notes-h">Notes for this course ({courseNotes.length})</h2>
			<Button href={newNoteHref} variant="primary">+ Note</Button>
		</header>
		<NotesList
			notes={courseNotes}
			showContextChips={false}
			emptyTitle="No notes for this course yet"
			emptyBody="Capture a thought attached to this course -- it stays here even when the syllabus changes."
		/>
	</section>
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

	.status {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
	}

	.status-active {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.status-archived {
		color: var(--ink-faint);
		background: var(--surface-sunken);
	}

	.description {
		color: var(--ink-body);
	}

	.prose :global(p) {
		margin: 0 0 var(--space-md);
		line-height: 1.55;
	}

	.prose :global(a) {
		color: var(--action-default-hover);
	}

	.rollup {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.rollup-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.rollup-label {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		font-weight: 600;
	}

	.rollup-value {
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

	.sections {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.section-card {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.lesson-card {
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.section-head,
	.lesson-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-md);
	}

	.node-title {
		margin: 0;
		color: var(--ink-body);
	}

	.section-card > .section-head > .node-title {
		font-size: var(--type-heading-3-size);
	}

	.lesson-card > .lesson-head > .node-title {
		font-size: var(--type-heading-4-size);
	}

	.node-link {
		color: inherit;
		text-decoration: none;
	}

	.node-link:hover {
		text-decoration: underline;
		color: var(--action-default-hover);
	}

	.node-rollup {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.section-empty,
	.lesson-empty {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}

	.leaves {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.children {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.leaf-link {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		color: var(--ink-body);
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
		background: var(--ink-inverse);
	}

	.leaf-link:hover {
		border-color: var(--action-default-edge);
		background: var(--surface-muted);
	}

	.leaf-title {
		font-weight: 500;
	}

	.leaf-meta {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
		flex-wrap: wrap;
	}

	.leaf-state {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.mastery-mastered {
		color: var(--signal-success);
		background: var(--signal-success-wash);
	}

	.mastery-covered {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
	}

	.mastery-unseen {
		color: var(--ink-muted);
		background: var(--surface-sunken);
	}

	.leaf-cert {
		font-size: var(--type-ui-caption-size);
		color: var(--action-default-hover);
		font-weight: 500;
	}

	.notes-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.notes-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		flex-wrap: wrap;
	}

	.notes-head h2 {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}
</style>
