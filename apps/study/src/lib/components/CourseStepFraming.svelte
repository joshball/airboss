<script lang="ts">
import { ROUTES } from '@ab/constants';
import { renderMarkdown } from '@ab/utils';

interface Props {
	courseSlug: string;
	courseTitle: string;
	sectionTitle: string | null;
	stepTitle: string;
	bodyMd: string;
}

let { courseSlug, courseTitle, sectionTitle, stepTitle, bodyMd }: Props = $props();
</script>

<header class="framing">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.COURSES}>Courses</a>
		<span aria-hidden="true">/</span>
		<a href={ROUTES.COURSE(courseSlug)}>{courseTitle}</a>
		{#if sectionTitle}
			<span aria-hidden="true">/</span>
			<span class="crumb-section">{sectionTitle}</span>
		{/if}
	</nav>
	<h1 class="step-title">{stepTitle}</h1>
	{#if bodyMd}
		<div class="prose">{@html renderMarkdown(bodyMd)}</div>
	{/if}
</header>

<style>
	.framing {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
		flex-wrap: wrap;
	}

	.crumb a {
		color: var(--ink-subtle);
	}

	.crumb-section {
		color: var(--ink-muted);
	}

	.step-title {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.prose :global(p) {
		margin: 0 0 var(--space-md);
		line-height: 1.55;
		color: var(--ink-body);
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 var(--space-md) var(--space-xl);
		line-height: 1.55;
	}
</style>
