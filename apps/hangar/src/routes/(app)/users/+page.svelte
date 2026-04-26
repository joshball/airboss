<script lang="ts">
import { QUERY_PARAMS, ROLE_LABELS, ROLE_VALUES, ROUTES, type Role } from '@ab/constants';
import Banner from '@ab/ui/components/Banner.svelte';
import { replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

// Seed from server-rendered filter; URL <-> state syncs below.
// svelte-ignore state_referenced_locally
let searchValue = $state(data.filters.search);

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
$effect(() => {
	const _trigger = searchValue;
	void _trigger;
	if (typeof window === 'undefined') return;
	if (searchDebounce !== null) clearTimeout(searchDebounce);
	searchDebounce = setTimeout(() => {
		const url = new URL(page.url);
		const trimmed = searchValue.trim();
		if (trimmed) url.searchParams.set(QUERY_PARAMS.SEARCH, trimmed);
		else url.searchParams.delete(QUERY_PARAMS.SEARCH);
		if (url.search === page.url.search) return;
		replaceState(url, page.state);
	}, 150);
	return () => {
		if (searchDebounce !== null) clearTimeout(searchDebounce);
	};
});

const total = $derived(data.users.length);

/**
 * Compose the count-summary line: "23 users -- 4 admins, 8 authors,
 * 11 learners". Roles with zero count are omitted to keep the line
 * tight; if every role is empty we fall back to just the total.
 */
const countSummary = $derived.by(() => {
	const parts: string[] = [];
	for (const role of ROLE_VALUES) {
		const c = data.roleCounts[role];
		if (c > 0) parts.push(`${c} ${pluralRole(role, c)}`);
	}
	const head = `${total} user${total === 1 ? '' : 's'}`;
	return parts.length ? `${head} -- ${parts.join(', ')}` : head;
});

function pluralRole(role: Role, count: number): string {
	const label = ROLE_LABELS[role].toLowerCase();
	return count === 1 ? label : `${label}s`;
}

function displayName(name: string, email: string): string {
	const trimmed = name.trim();
	return trimmed || email;
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatLastSeen(iso: string | null): string {
	if (!iso) return 'never';
	return new Date(iso).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}
</script>

<svelte:head>
	<title>Users -- hangar</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Users</h1>
			<p class="sub">{countSummary}</p>
		</div>
	</header>

	<Banner tone="info">
		User editing coming soon -- this is a read-only view for now.
	</Banner>

	<section class="filter-bar" aria-label="Filter users">
		<div class="field">
			<label for="user-search">Search</label>
			<input
				id="user-search"
				type="search"
				placeholder="name or email"
				bind:value={searchValue}
				autocomplete="off"
			/>
		</div>
	</section>

	{#if data.users.length === 0}
		<p class="empty">
			{#if data.filters.search}
				No users match {`"${data.filters.search}"`}.
			{:else}
				No users yet.
			{/if}
		</p>
	{:else}
		{#if data.truncated}
			<p class="muted">Showing the first {data.limit} users. Refine the search to narrow the list.</p>
		{/if}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col">Email</th>
						<th scope="col">Role</th>
						<th scope="col">Last seen</th>
						<th scope="col">Created</th>
						<th scope="col">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user (user.id)}
						<tr>
							<td>
								<a href={ROUTES.HANGAR_USER_DETAIL(user.id)}>{displayName(user.name, user.email)}</a>
							</td>
							<td class="mono">{user.email}</td>
							<td>
								{#if user.role}
									<span class="role-pill">{ROLE_LABELS[user.role]}</span>
								{:else}
									<span class="muted">-</span>
								{/if}
							</td>
							<td class="mono">{formatLastSeen(user.lastSeenAt)}</td>
							<td class="mono">{formatDate(user.createdAt)}</td>
							<td>
								{#if user.banned}
									<span class="badge banned">Banned</span>
								{:else}
									<span class="muted">-</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.filter-bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-md);
		align-items: end;
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		max-width: 32rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.field label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.field input {
		background: var(--input-default-bg);
		color: var(--input-default-ink);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		font: inherit;
	}

	.field input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--input-default-hover-border);
	}

	.empty {
		color: var(--ink-muted);
		font-style: italic;
		padding: var(--space-xl);
		text-align: center;
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
	}

	th,
	td {
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		border-bottom: 1px solid var(--table-row-edge);
		color: var(--ink-body);
		vertical-align: top;
	}

	th {
		background: var(--table-header-bg);
		color: var(--table-header-ink);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
	}

	tr:hover {
		background: var(--table-row-bg-hover);
	}

	td a {
		color: var(--link-default);
		text-decoration: none;
	}

	td a:hover {
		text-decoration: underline;
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.muted {
		color: var(--ink-faint);
	}

	.role-pill {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-pill);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.badge {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
	}

	.badge.banned {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
	}
</style>
