<script lang="ts">
import { ROLES, ROUTES } from '@ab/constants';
import { page } from '$app/state';

/**
 * Hangar top-level nav shell. Links to the primary admin surfaces:
 * Sources, Glossary, Courses, Docs, Review, Ingest review, Roadmap, Users
 * (admin-only), Jobs. Active-route highlighting via `aria-current` matches
 * the study-app pattern. Colors + spacing resolve from role tokens
 * (04-VOCABULARY.md) so light/dark + future themes work.
 *
 * Sources comes first because /sources (the operational flow diagram)
 * is the post-sources-v1 primary landing. Courses sits with the other
 * authoring surfaces (Glossary / Docs) since the course-reader-and-editor
 * WP ships an authoring UI under /courses. Users is hidden for non-admin
 * roles to match the route gate -- showing a link that 403s on click is
 * worse than not showing it.
 */

function isActive(prefix: string): boolean {
	return page.url.pathname === prefix || page.url.pathname.startsWith(`${prefix}/`);
}

const sourcesActive = $derived(isActive(ROUTES.HANGAR_SOURCES));
const glossaryActive = $derived(isActive(ROUTES.HANGAR_GLOSSARY));
const coursesActive = $derived(isActive(ROUTES.HANGAR_COURSES));
const docsActive = $derived(isActive(ROUTES.HANGAR_DOCS));
const reviewActive = $derived(isActive(ROUTES.HANGAR_REVIEW));
const ingestReviewActive = $derived(isActive(ROUTES.HANGAR_INGEST_REVIEW));
const roadmapActive = $derived(isActive(ROUTES.HANGAR_ROADMAP));
const usersActive = $derived(isActive(ROUTES.HANGAR_USERS));
const jobsActive = $derived(isActive(ROUTES.HANGAR_JOBS));
const isAdmin = $derived(page.data.user?.role === ROLES.ADMIN);
const reviewQueueCount = $derived<number>(
	typeof page.data.reviewQueueCount === 'number' ? page.data.reviewQueueCount : 0,
);
</script>

<div class="nav-sections">
	<a href={ROUTES.HANGAR_SOURCES} aria-current={sourcesActive ? 'page' : undefined}>Sources</a>
	<a href={ROUTES.HANGAR_GLOSSARY} aria-current={glossaryActive ? 'page' : undefined}>Glossary</a>
	<a href={ROUTES.HANGAR_COURSES} aria-current={coursesActive ? 'page' : undefined}>Courses</a>
	<a href={ROUTES.HANGAR_DOCS} aria-current={docsActive ? 'page' : undefined}>Docs</a>
	<a href={ROUTES.HANGAR_REVIEW} aria-current={reviewActive ? 'page' : undefined}>
		Review
		{#if reviewQueueCount > 0}
			<span
				class="badge"
				aria-label={`${reviewQueueCount} item${reviewQueueCount === 1 ? '' : 's'} need review`}
			>{reviewQueueCount}</span>
		{/if}
	</a>
	<a href={ROUTES.HANGAR_INGEST_REVIEW} aria-current={ingestReviewActive ? 'page' : undefined}>Ingest review</a>
	<a href={ROUTES.HANGAR_ROADMAP} aria-current={roadmapActive ? 'page' : undefined}>Roadmap</a>
	{#if isAdmin}
		<a href={ROUTES.HANGAR_USERS} aria-current={usersActive ? 'page' : undefined}>Users</a>
	{/if}
	<a href={ROUTES.HANGAR_JOBS} aria-current={jobsActive ? 'page' : undefined}>Jobs</a>
</div>

<style>
	.nav-sections {
		display: flex;
		gap: var(--space-xl);
		flex-wrap: wrap;
		align-items: center;
	}

	a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		color: var(--ink-muted);
		text-decoration: none;
		font-weight: var(--type-ui-control-weight);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
	}

	a:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	a[aria-current='page'] {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
	}

	a:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 var(--space-2xs);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
		font-weight: var(--font-weight-medium);
		text-align: center;
		color: var(--action-default-ink);
		background: var(--action-default);
		border-radius: var(--radius-pill, 999px);
	}
</style>
