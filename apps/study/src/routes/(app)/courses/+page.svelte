<script lang="ts">
import { COURSE_STATUS_LABELS, type CourseStatus, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const rows = $derived(data.rows);
const hasPrimaryGoal = $derived(data.hasPrimaryGoal);
const isEmpty = $derived(rows.length === 0);

function statusLabel(status: string): string {
	return COURSE_STATUS_LABELS[status as CourseStatus] ?? status;
}

function pct(num: number, den: number): number {
	if (den === 0) return 0;
	// Clamp to [0, 100] -- an orphan-inflated rollup could push num past
	// den, which would otherwise overflow the bar and produce an
	// incoherent aria-valuenow/aria-valuemax pair.
	return Math.min(100, Math.max(0, Math.round((num / den) * 100)));
}
</script>

<svelte:head>
	<title>Courses -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		title="Courses"
		subtitle="Instructor-authored guided walkthroughs that string knowledge nodes into a sequence."
	/>

	{#if !hasPrimaryGoal}
		<aside class="banner" role="status">
			<p>
				<strong>No primary goal set.</strong> Showing every active course. Set a primary goal and add courses to it
				to get per-course mastery tracking.
			</p>
			<a class="banner-cta" href={ROUTES.PROGRAM_GOALS_NEW}>Create a goal</a>
		</aside>
	{/if}

	{#if isEmpty}
		<EmptyState
			title="No courses yet"
			body="No active or archived courses exist. Authoring lives in the hangar app -- ask your administrator if you expected to see something here."
		/>
	{:else}
		<ul class="grid">
			{#each rows as row (row.course.id)}
				<li class="card" class:in-goal={row.inGoal}>
					<header class="card-header">
						<span class="status status-{row.course.status}">{statusLabel(row.course.status)}</span>
						{#if row.inGoal}
							<span class="badge in-goal-badge">In goal</span>
						{/if}
					</header>
					<h2 class="title"><a class="title-link" href={ROUTES.COURSE(row.course.slug)}>{row.course.title}</a></h2>
					{#if row.course.description !== ''}
						<p class="description">{row.course.description}</p>
					{/if}
					{#if row.inGoal && row.rollup.totalLeaves > 0}
						<dl class="stats">
							<div>
								<dt>Mastered</dt>
								<dd data-testid="course-mastery">
									{row.rollup.masteredLeaves} / {row.rollup.totalLeaves}
								</dd>
							</div>
							<div>
								<dt>Coverage</dt>
								<dd>{pct(row.rollup.coveredLeaves, row.rollup.totalLeaves)}%</dd>
							</div>
						</dl>
						<div
							class="mastery-bar"
							role="progressbar"
							aria-label="Course mastery"
							aria-valuemin="0"
							aria-valuemax={row.rollup.totalLeaves}
							aria-valuenow={row.rollup.masteredLeaves}
							aria-valuetext="{row.rollup.masteredLeaves} of {row.rollup.totalLeaves} leaves mastered"
						>
							<span
								class="mastery-fill"
								style:width="{pct(row.rollup.masteredLeaves, row.rollup.totalLeaves)}%"
							></span>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.banner {
		background: var(--signal-info-wash);
		border: 1px solid var(--signal-info-edge);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-md);
		color: var(--ink-body);
	}

	.banner p {
		margin: 0;
	}

	.banner-cta {
		color: var(--action-default-hover);
		font-weight: 600;
		text-decoration: none;
	}

	.banner-cta:hover {
		text-decoration: underline;
	}

	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--space-lg);
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-lg);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		height: 100%;
		transition: border-color var(--motion-fast) ease;
	}

	.card:hover {
		border-color: var(--action-default-edge);
	}

	.card.in-goal {
		border-color: var(--action-default-edge);
	}

	.title-link {
		color: var(--ink-body);
		text-decoration: none;
	}

	.title-link:hover {
		text-decoration: underline;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-sm);
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

	.badge {
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

	.title {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.description {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-definition-body-size);
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.stats {
		margin: var(--space-sm) 0 0;
		display: flex;
		gap: var(--space-lg);
	}

	.stats div {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.stats dt {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.stats dd {
		margin: 0;
		font-size: var(--type-definition-body-size);
		font-weight: 600;
		color: var(--ink-body);
	}

	.mastery-bar {
		width: 100%;
		height: var(--space-2xs);
		background: var(--edge-default);
		border-radius: var(--radius-pill);
		overflow: hidden;
		margin-top: var(--space-sm);
	}

	.mastery-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
	}

	@media (prefers-reduced-motion: reduce) {
		.card {
			transition: none;
		}
	}
</style>
