<script lang="ts">
import { QUERY_PARAMS, ROLE_LABELS, ROLE_VALUES, ROUTES, type Role } from '@ab/constants';
import Badge from '@ab/ui/components/Badge.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import FilterBar from '@ab/ui/components/FilterBar.svelte';
import FilterField from '@ab/ui/components/FilterField.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import RolePill from '@ab/ui/components/RolePill.svelte';
import Table from '@ab/ui/components/Table.svelte';
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
	<PageHeader title="Users" subtitle={countSummary} />

	<Banner tone="info">Click a user to edit role, ban status, and sessions.</Banner>

	<FilterBar ariaLabel="Filter users" maxWidth="32rem" columns="minmax(0, 1fr)">
		<FilterField id="user-search" label="Search">
			<input
				id="user-search"
				type="search"
				placeholder="name or email"
				bind:value={searchValue}
				autocomplete="off"
			/>
		</FilterField>
	</FilterBar>

	{#if data.users.length === 0}
		{#if data.filters.search}
			<EmptyState title="No matches" body={`No users match "${data.filters.search}".`} />
		{:else}
			<EmptyState title="No users yet" />
		{/if}
	{:else}
		{#if data.truncated}
			<p class="muted">Showing the first {data.limit} users. Refine the search to narrow the list.</p>
		{/if}
		<Table ariaLabel="Users">
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
								<RolePill>{ROLE_LABELS[user.role]}</RolePill>
							{:else}
								<span class="muted">-</span>
							{/if}
						</td>
						<td class="mono">{formatLastSeen(user.lastSeenAt)}</td>
						<td class="mono">{formatDate(user.createdAt)}</td>
						<td>
							{#if user.banned}
								<Badge tone="danger" size="sm">Banned</Badge>
							{:else}
								<span class="muted">-</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</Table>
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
</style>
