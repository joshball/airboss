<script lang="ts">
import { COURSE_STATUS_LABELS, type CourseStatus, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const courses = $derived(data.courses);
const hasGoal = $derived(data.hasGoal);

function statusLabel(status: CourseStatus): string {
	return COURSE_STATUS_LABELS[status] ?? status;
}

function masteryText(entry: (typeof courses)[number]): string {
	if (entry.mastery === null) return hasGoal ? 'Not in your goal' : 'No goal set';
	if (entry.mastery.totalLeaves === 0) return 'No content yet';
	return `${entry.mastery.masteredLeaves} of ${entry.mastery.totalLeaves} mastered`;
}

function masteryPercent(entry: (typeof courses)[number]): number {
	if (entry.mastery === null) return 0;
	return Math.round(entry.mastery.masteryFraction * 100);
}
</script>

<svelte:head>
	<title>Courses -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader title="Courses" subtitle="Instructor-authored courses you can read or pull into your goal." />

	{#if courses.length === 0}
		<EmptyState title="No courses yet" body="Authoring is in flight; come back soon." />
	{:else}
		<ul class="course-list" aria-label="Course list">
			{#each courses as course (course.id)}
				<li class="course-row" class:in-goal={course.inGoal}>
					<a class="course-link" href={ROUTES.COURSE(course.slug)} aria-label="Open {course.title}">
						<div class="row-head">
							<h2 class="course-title">{course.title}</h2>
							<span class="badge status status-{course.status}">{statusLabel(course.status)}</span>
							{#if course.inGoal}
								<span class="badge in-goal-badge" title="This course is in your active goal">In goal</span>
							{/if}
						</div>
						{#if course.description}
							<p class="course-description">{course.description}</p>
						{/if}
						<div class="mastery-row">
							<span class="mastery-text">{masteryText(course)}</span>
							{#if course.mastery !== null && course.mastery.totalLeaves > 0}
								<div
									class="mastery-bar"
									role="progressbar"
									aria-label="Course mastery"
									aria-valuemin="0"
									aria-valuemax="100"
									aria-valuenow={masteryPercent(course)}
								>
									<span class="mastery-fill" style:width="{masteryPercent(course)}%"></span>
								</div>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>
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

	.course-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.course-row {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		transition: border-color var(--motion-fast);
	}

	.course-row.in-goal {
		border-color: var(--action-default-edge);
		background: var(--action-default-wash);
	}

	.course-row:hover {
		border-color: var(--action-default-edge);
	}

	.course-link {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md) var(--space-lg);
		text-decoration: none;
		color: inherit;
	}

	.row-head {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.course-title {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
		flex: 1 1 auto;
	}

	.course-description {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--type-definition-body-size);
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		background: var(--surface-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.badge.status-active {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.badge.status-archived {
		color: var(--ink-subtle);
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
	}

	.badge.status-draft {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.in-goal-badge {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.mastery-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.mastery-bar {
		flex: 1 1 auto;
		max-width: 12rem;
		height: 6px;
		background: var(--edge-default);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.mastery-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
	}
</style>
