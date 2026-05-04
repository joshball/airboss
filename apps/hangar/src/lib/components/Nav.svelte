<script lang="ts">
import { ROLES, ROUTES } from '@ab/constants';
import { page } from '$app/state';

/**
 * Hangar top-level nav shell. Links to the primary admin surfaces:
 * Sources, Glossary, Users (admin-only), Jobs. Active-route highlighting
 * via `aria-current` matches the study-app pattern. Colors + spacing
 * resolve from role tokens (04-VOCABULARY.md) so light/dark + future
 * themes work.
 *
 * Sources comes first because /sources (the operational flow diagram)
 * is the post-sources-v1 primary landing. Users is hidden for non-admin
 * roles to match the route gate -- showing a link that 403s on click is
 * worse than not showing it.
 */

const sourcesActive = $derived(
	page.url.pathname === ROUTES.HANGAR_SOURCES || page.url.pathname.startsWith(`${ROUTES.HANGAR_SOURCES}/`),
);
const glossaryActive = $derived(
	page.url.pathname === ROUTES.HANGAR_GLOSSARY || page.url.pathname.startsWith(`${ROUTES.HANGAR_GLOSSARY}/`),
);
const docsActive = $derived(
	page.url.pathname === ROUTES.HANGAR_DOCS || page.url.pathname.startsWith(`${ROUTES.HANGAR_DOCS}/`),
);
const reviewActive = $derived(
	page.url.pathname === ROUTES.HANGAR_REVIEW || page.url.pathname.startsWith(`${ROUTES.HANGAR_REVIEW}/`),
);
const usersActive = $derived(
	page.url.pathname === ROUTES.HANGAR_USERS || page.url.pathname.startsWith(`${ROUTES.HANGAR_USERS}/`),
);
const jobsActive = $derived(
	page.url.pathname === ROUTES.HANGAR_JOBS || page.url.pathname.startsWith(`${ROUTES.HANGAR_JOBS}/`),
);
const isAdmin = $derived(page.data.user?.role === ROLES.ADMIN);
const reviewQueueCount = $derived<number>(
	typeof page.data.reviewQueueCount === 'number' ? page.data.reviewQueueCount : 0,
);
</script>

<div class="nav-sections">
	<a href={ROUTES.HANGAR_SOURCES} aria-current={sourcesActive ? 'page' : undefined}>Sources</a>
	<a href={ROUTES.HANGAR_GLOSSARY} aria-current={glossaryActive ? 'page' : undefined}>Glossary</a>
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
	}

	a {
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
		display: inline-block;
		margin-left: var(--space-3xs);
		padding: 0 var(--space-2xs);
		min-width: 1.25rem;
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
		font-weight: var(--font-weight-medium);
		line-height: 1.25rem;
		text-align: center;
		color: var(--ink-inverse);
		background: var(--action-default-default);
		border-radius: var(--radius-pill, 999px);
	}
</style>
