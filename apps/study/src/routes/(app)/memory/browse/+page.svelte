<script lang="ts">
import {
	CARD_STATUS_VALUES,
	CARD_STATUSES,
	CARD_TYPE_VALUES,
	CONTENT_SOURCE_VALUES,
	DOMAIN_VALUES,
	ROUTES,
} from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const { cards, filters, page: currentPage, hasMore } = $derived(data);

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function shorten(text: string, max = 120): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max).trimEnd()}...`;
}

function buildHref(next: Record<string, string | undefined>): string {
	const params = new URLSearchParams();
	const full = {
		domain: filters.domain,
		type: filters.cardType,
		source: filters.sourceType,
		status: filters.status === CARD_STATUSES.ACTIVE ? undefined : filters.status,
		q: filters.search || undefined,
		...next,
	};
	for (const [k, v] of Object.entries(full)) {
		if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
	}
	const qs = params.toString();
	return qs ? `${ROUTES.MEMORY_BROWSE}?${qs}` : ROUTES.MEMORY_BROWSE;
}

function pageHref(n: number): string {
	return buildHref({ page: n > 1 ? String(n) : undefined });
}
</script>

<svelte:head>
	<title>Browse cards -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Browse</h1>
			<p class="sub">Your deck of memory items. Filter, search, or click a card to edit.</p>
		</div>
		<a class="btn primary" href={ROUTES.MEMORY_NEW}>New card</a>
	</header>

	<form class="filters" method="GET">
		<input type="hidden" name="page" value="1" />
		<div class="filter">
			<label for="f-q">Search</label>
			<input id="f-q" type="search" name="q" placeholder="front or back..." value={filters.search ?? ''} />
		</div>
		<div class="filter">
			<label for="f-domain">Domain</label>
			<select id="f-domain" name="domain" value={filters.domain ?? ''}>
				<option value="">All</option>
				{#each DOMAIN_VALUES as d (d)}
					<option value={d}>{humanize(d)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-type">Type</label>
			<select id="f-type" name="type" value={filters.cardType ?? ''}>
				<option value="">All</option>
				{#each CARD_TYPE_VALUES as t (t)}
					<option value={t}>{humanize(t)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-source">Source</label>
			<select id="f-source" name="source" value={filters.sourceType ?? ''}>
				<option value="">All</option>
				{#each CONTENT_SOURCE_VALUES as s (s)}
					<option value={s}>{humanize(s)}</option>
				{/each}
			</select>
		</div>
		<div class="filter">
			<label for="f-status">Status</label>
			<select id="f-status" name="status" value={filters.status ?? CARD_STATUSES.ACTIVE}>
				{#each CARD_STATUS_VALUES as s (s)}
					<option value={s}>{humanize(s)}</option>
				{/each}
			</select>
		</div>
		<div class="filter-actions">
			<button type="submit" class="btn secondary">Apply</button>
			<a class="btn ghost" href={ROUTES.MEMORY_BROWSE}>Reset</a>
		</div>
	</form>

	{#if cards.length === 0}
		<div class="empty">
			<p>No cards match these filters.</p>
			<a class="btn primary" href={ROUTES.MEMORY_NEW}>Create your first card</a>
		</div>
	{:else}
		<ul class="list">
			{#each cards as c (c.id)}
				<li class="card">
					<a class="card-link" href={ROUTES.MEMORY_CARD(c.id)}>
						<div class="card-front">{shorten(c.front)}</div>
						<div class="card-meta">
							<span class="badge domain">{humanize(c.domain)}</span>
							<span class="badge type">{humanize(c.cardType)}</span>
							{#if c.status !== CARD_STATUSES.ACTIVE}
								<span class="badge status-{c.status}">{humanize(c.status)}</span>
							{/if}
							{#if c.sourceType !== 'personal'}
								<span class="badge source">{humanize(c.sourceType)}</span>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>

		<nav class="pager" aria-label="Pagination">
			{#if currentPage > 1}
				<a class="btn ghost" href={pageHref(currentPage - 1)}>Previous</a>
			{:else}
				<span></span>
			{/if}
			<span class="page-num">Page {currentPage}</span>
			{#if hasMore}
				<a class="btn ghost" href={pageHref(currentPage + 1)}>Next</a>
			{:else}
				<span></span>
			{/if}
		</nav>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.9375rem;
	}

	.filters {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto;
		gap: 0.75rem;
		align-items: end;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem;
	}

	.filter {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #475569;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.filter input,
	.filter select {
		font: inherit;
		padding: 0.5rem 0.625rem;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		background: white;
		color: #0f172a;
	}

	.filter input:focus,
	.filter select:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	.filter-actions {
		display: flex;
		gap: 0.375rem;
	}

	.empty {
		background: white;
		border: 1px dashed #cbd5e1;
		border-radius: 12px;
		padding: 3rem 1.5rem;
		text-align: center;
		color: #64748b;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		transition: border-color 120ms, box-shadow 120ms;
	}

	.card:hover {
		border-color: #bfdbfe;
		box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
	}

	.card-link {
		display: block;
		padding: 0.875rem 1rem;
		text-decoration: none;
		color: inherit;
	}

	.card-front {
		color: #0f172a;
		font-size: 0.9375rem;
		line-height: 1.4;
	}

	.card-meta {
		margin-top: 0.5rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		border-radius: 999px;
		border: 1px solid #e2e8f0;
		color: #475569;
		background: #f8fafc;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.domain {
		color: #1d4ed8;
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.badge.status-suspended {
		color: #92400e;
		background: #fffbeb;
		border-color: #fde68a;
	}

	.badge.status-archived {
		color: #4b5563;
		background: #f3f4f6;
		border-color: #e5e7eb;
	}

	.badge.source {
		color: #6b21a8;
		background: #faf5ff;
		border-color: #e9d5ff;
	}

	.pager {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.pager > :first-child {
		justify-self: start;
	}

	.pager > :last-child {
		justify-self: end;
	}

	.page-num {
		color: #64748b;
		font-size: 0.875rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover {
		background: #1d4ed8;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.secondary:hover {
		background: #e2e8f0;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
		border-color: transparent;
	}

	.btn.ghost:hover {
		background: #f1f5f9;
	}

	@media (max-width: 640px) {
		.filters {
			grid-template-columns: 1fr 1fr;
		}

		.filter-actions {
			grid-column: 1 / -1;
			justify-content: flex-end;
		}
	}
</style>
