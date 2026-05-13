<script lang="ts">
/**
 * Breadcrumb chain for the course step reader. Renders course title ->
 * each ancestor's title (linked to its landing URL) -> the current row
 * title (non-clickable, marked `aria-current="page"`).
 *
 * Composes from the chain emitted by `+page.server.ts`'s
 * `buildBreadcrumbs` -- root-first list of ancestors, not including the
 * current row. The current row is passed in separately as `current`.
 */

import { ROUTES } from '@ab/constants';
import type { BreadcrumbCrumb } from './+page.server';

interface Props {
	courseSlug: string;
	courseTitle: string;
	crumbs: BreadcrumbCrumb[];
	current: { title: string };
}

let { courseSlug, courseTitle, crumbs, current }: Props = $props();
</script>

<nav aria-label="Breadcrumb" class="crumbs">
	<ol class="crumb">
		<li><a href={ROUTES.COURSES}>Courses</a></li>
		<li><a href={ROUTES.COURSE(courseSlug)}>{courseTitle}</a></li>
		{#each crumbs as crumb (crumb.code)}
			<li>
				<a href={ROUTES.COURSE_STEP(courseSlug, crumb.code)}>{crumb.title}</a>
			</li>
		{/each}
		<li aria-current="page">{current.title}</li>
	</ol>
</nav>

<style>
	.crumbs {
		display: flex;
	}

	.crumb {
		display: flex;
		flex-wrap: wrap;
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

	[aria-current='page'] {
		color: var(--ink-body);
		font-weight: 500;
	}
</style>
