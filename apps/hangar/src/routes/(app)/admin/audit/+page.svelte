<script lang="ts">
import { AUDIT_OP_VALUES } from '@ab/audit';
import {
	AUDIT_TARGET_VALUES,
	AUDIT_WINDOW_LABELS,
	AUDIT_WINDOW_VALUES,
	AUDIT_WINDOWS,
	type AuditWindow,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { goto, replaceState } from '$app/navigation';
import { page } from '$app/state';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

interface ActorOption {
	id: string;
	name: string;
	email: string;
}

// svelte-ignore state_referenced_locally
const initialActor = data.actorOptions[0];
// svelte-ignore state_referenced_locally
let actorSearch = $state(initialActor ? formatActor(initialActor) : '');
// svelte-ignore state_referenced_locally
let actorId = $state<string | null>(data.filters.actorId);
let actorOptions = $state<ActorOption[]>([]);
let actorMenuOpen = $state(false);

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
let lastTypeaheadTerm = '';

$effect(() => {
	const term = actorSearch.trim();
	if (typeof window === 'undefined') return;
	if (searchDebounce !== null) clearTimeout(searchDebounce);
	if (!term) {
		actorOptions = [];
		actorMenuOpen = false;
		return;
	}
	if (term === lastTypeaheadTerm) return;
	searchDebounce = setTimeout(async () => {
		lastTypeaheadTerm = term;
		try {
			const url = new URL(ROUTES.HANGAR_API_AUDIT_ACTORS, window.location.origin);
			url.searchParams.set(QUERY_PARAMS.SEARCH, term);
			const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
			if (!res.ok) return;
			const body = (await res.json()) as { results: ActorOption[] };
			actorOptions = body.results;
			actorMenuOpen = body.results.length > 0;
		} catch {
			// Non-fatal: typeahead failure leaves the previous list in place.
		}
	}, 150);
	return () => {
		if (searchDebounce !== null) clearTimeout(searchDebounce);
	};
});

function formatActor(option: ActorOption): string {
	const trimmed = option.name.trim();
	return trimmed ? `${trimmed} <${option.email}>` : option.email;
}

function buildFilterUrl(mutate: (params: URLSearchParams) => void): URL {
	const url = new URL(page.url);
	mutate(url.searchParams);
	// Cursor never survives a filter change -- you're starting a new query.
	url.searchParams.delete(QUERY_PARAMS.AUDIT_CURSOR);
	return url;
}

function pushFilters(url: URL): void {
	if (url.search === page.url.search) return;
	void goto(url, { keepFocus: true, noScroll: true, replaceState: true });
}

function pickActor(option: ActorOption): void {
	actorId = option.id;
	actorSearch = formatActor(option);
	actorOptions = [];
	actorMenuOpen = false;
	const url = buildFilterUrl((p) => p.set(QUERY_PARAMS.AUDIT_ACTOR, option.id));
	pushFilters(url);
}

function clearActor(): void {
	actorId = null;
	actorSearch = '';
	actorOptions = [];
	actorMenuOpen = false;
	const url = buildFilterUrl((p) => p.delete(QUERY_PARAMS.AUDIT_ACTOR));
	pushFilters(url);
}

function pickSystemActor(): void {
	actorId = 'null';
	actorSearch = 'system';
	actorOptions = [];
	actorMenuOpen = false;
	const url = buildFilterUrl((p) => p.set(QUERY_PARAMS.AUDIT_ACTOR, 'null'));
	pushFilters(url);
}

function setTargetType(value: string): void {
	const url = buildFilterUrl((p) => {
		if (value) p.set(QUERY_PARAMS.AUDIT_TARGET_TYPE, value);
		else p.delete(QUERY_PARAMS.AUDIT_TARGET_TYPE);
	});
	pushFilters(url);
}

function setOp(value: string): void {
	const url = buildFilterUrl((p) => {
		if (value) p.set(QUERY_PARAMS.AUDIT_OP, value);
		else p.delete(QUERY_PARAMS.AUDIT_OP);
	});
	pushFilters(url);
}

// svelte-ignore state_referenced_locally
let targetIdValue = $state(data.filters.targetId ?? '');
let targetIdDebounce: ReturnType<typeof setTimeout> | null = null;
$effect(() => {
	const _trigger = targetIdValue;
	void _trigger;
	if (typeof window === 'undefined') return;
	if (targetIdDebounce !== null) clearTimeout(targetIdDebounce);
	targetIdDebounce = setTimeout(() => {
		const url = new URL(page.url);
		const trimmed = targetIdValue.trim();
		if (trimmed) url.searchParams.set(QUERY_PARAMS.AUDIT_TARGET_ID, trimmed);
		else url.searchParams.delete(QUERY_PARAMS.AUDIT_TARGET_ID);
		url.searchParams.delete(QUERY_PARAMS.AUDIT_CURSOR);
		if (url.search === page.url.search) return;
		replaceState(url, page.state);
	}, 150);
	return () => {
		if (targetIdDebounce !== null) clearTimeout(targetIdDebounce);
	};
});

function pickWindow(value: AuditWindow): void {
	const url = buildFilterUrl((p) => {
		p.set(QUERY_PARAMS.AUDIT_WINDOW, value);
		// Switching to a preset blows away any custom from/to range.
		if (value !== AUDIT_WINDOWS.CUSTOM) {
			p.delete(QUERY_PARAMS.AUDIT_FROM);
			p.delete(QUERY_PARAMS.AUDIT_TO);
		}
	});
	pushFilters(url);
}

// svelte-ignore state_referenced_locally
let customFromValue = $state(toLocalDateTime(data.filters.from));
// svelte-ignore state_referenced_locally
let customToValue = $state(toLocalDateTime(data.filters.to));

function applyCustomRange(): void {
	const url = buildFilterUrl((p) => {
		p.set(QUERY_PARAMS.AUDIT_WINDOW, AUDIT_WINDOWS.CUSTOM);
		if (customFromValue) p.set(QUERY_PARAMS.AUDIT_FROM, new Date(customFromValue).toISOString());
		else p.delete(QUERY_PARAMS.AUDIT_FROM);
		if (customToValue) p.set(QUERY_PARAMS.AUDIT_TO, new Date(customToValue).toISOString());
		else p.delete(QUERY_PARAMS.AUDIT_TO);
	});
	pushFilters(url);
}

function clearAllFilters(): void {
	void goto(ROUTES.HANGAR_ADMIN_AUDIT, { keepFocus: true, noScroll: true, replaceState: true });
	actorSearch = '';
	actorId = null;
	actorOptions = [];
	actorMenuOpen = false;
	targetIdValue = '';
	customFromValue = '';
	customToValue = '';
}

function showMore(): void {
	if (data.nextCursor === null) return;
	const url = new URL(page.url);
	url.searchParams.set(QUERY_PARAMS.AUDIT_CURSOR, data.nextCursor);
	void goto(url, { keepFocus: true, noScroll: true });
}

function toLocalDateTime(iso: string | null): string {
	if (!iso) return '';
	// Render an ISO datetime as a local datetime-local string. Strips
	// the trailing 'Z' / millis so the input control accepts it.
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n: number): string => n.toString().padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTimestamp(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}

function actorLabel(row: { actorId: string | null; actorName: string | null; actorEmail: string | null }): string {
	if (row.actorId === null) return 'system';
	const name = row.actorName?.trim() ?? '';
	if (name) return name;
	return row.actorEmail ?? row.actorId;
}

const filterSummary = $derived.by(() => {
	const parts: string[] = [];
	const win = data.filters.window;
	if (win === AUDIT_WINDOWS.CUSTOM) {
		parts.push('custom range');
	} else if (win === AUDIT_WINDOWS.ALL) {
		parts.push('all time');
	} else {
		parts.push(`last ${AUDIT_WINDOW_LABELS[win]}`);
	}
	if (data.filters.actorId !== null) {
		const actor = data.actorOptions[0];
		if (actor) parts.push(`actor ${actor.name.trim() || actor.email}`);
		else if (data.filters.actorId === 'null') parts.push('system writes');
		else parts.push('1 actor');
	}
	if (data.filters.targetType !== null) parts.push(data.filters.targetType);
	if (data.filters.op !== null) parts.push(data.filters.op);
	if (data.filters.targetId !== null) parts.push(`target ${data.filters.targetId}`);
	const head = `${data.rows.length} event${data.rows.length === 1 ? '' : 's'}`;
	return `${head} -- ${parts.join(', ')}`;
});

const hasFiltersBeyondWindow = $derived(
	data.filters.actorId !== null ||
		data.filters.targetType !== null ||
		data.filters.targetId !== null ||
		data.filters.op !== null,
);
</script>

<svelte:head>
	<title>Audit log -- hangar</title>
</svelte:head>

<section class="page">
	<PageHeader title="Audit log" subtitle={filterSummary}>
		{#snippet titleSuffix()}
			<PageHelp pageId="audit" />
		{/snippet}
	</PageHeader>

	<section class="filter-bar" aria-label="Filter audit events">
		<div class="row">
			<div class="field actor-field">
				<label for="audit-actor">Actor</label>
				<div class="actor-input-wrap">
					<input
						id="audit-actor"
						type="text"
						role="combobox"
						placeholder="search by name or email"
						bind:value={actorSearch}
						onfocus={() => {
							if (actorOptions.length > 0) actorMenuOpen = true;
						}}
						autocomplete="off"
						aria-expanded={actorMenuOpen}
						aria-controls="audit-actor-menu"
						aria-autocomplete="list"
					/>
					{#if actorId}
						<button type="button" class="chip-clear" aria-label="Clear actor filter" onclick={clearActor}>x</button>
					{/if}
					{#if actorMenuOpen}
						<ul id="audit-actor-menu" class="actor-menu" role="listbox">
							{#each actorOptions as option (option.id)}
								<li>
									<button type="button" onclick={() => pickActor(option)} role="option" aria-selected="false">
										<span class="actor-menu-name">{option.name.trim() || option.email}</span>
										<span class="actor-menu-email">{option.email}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
				<button type="button" class="link-button" onclick={pickSystemActor}>System writes only</button>
			</div>

			<div class="field">
				<label for="audit-target-type">Target type</label>
				<select
					id="audit-target-type"
					value={data.filters.targetType ?? ''}
					onchange={(event) => setTargetType((event.currentTarget as HTMLSelectElement).value)}
				>
					<option value="">all</option>
					{#each AUDIT_TARGET_VALUES as type (type)}
						<option value={type}>{type}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label for="audit-target-id">Target id</label>
				<input id="audit-target-id" type="search" placeholder="exact match" bind:value={targetIdValue} autocomplete="off" />
			</div>

			<div class="field">
				<label for="audit-op">Op</label>
				<select id="audit-op" value={data.filters.op ?? ''} onchange={(event) => setOp((event.currentTarget as HTMLSelectElement).value)}>
					<option value="">all</option>
					{#each AUDIT_OP_VALUES as op (op)}
						<option value={op}>{op}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="row window-row">
			<div class="field" role="group" aria-labelledby="audit-window-label">
				<span id="audit-window-label" class="field-label">Window</span>
				<div class="chip-group">
					{#each AUDIT_WINDOW_VALUES as preset (preset)}
						<button
							type="button"
							class="chip"
							aria-pressed={data.filters.window === preset}
							onclick={() => pickWindow(preset)}
						>
							{AUDIT_WINDOW_LABELS[preset]}
						</button>
					{/each}
				</div>
			</div>
			{#if data.filters.window === AUDIT_WINDOWS.CUSTOM}
				<div class="field">
					<label for="audit-from">From</label>
					<input id="audit-from" type="datetime-local" bind:value={customFromValue} onchange={applyCustomRange} />
				</div>
				<div class="field">
					<label for="audit-to">To</label>
					<input id="audit-to" type="datetime-local" bind:value={customToValue} onchange={applyCustomRange} />
				</div>
			{/if}
			<div class="field-actions">
				<button type="button" class="link-button" onclick={clearAllFilters}>Clear filters</button>
			</div>
		</div>
	</section>

	{#if data.capReached && data.nextCursor !== null}
		<p class="cap-banner" role="status">
			Showing the first {data.limit} events. Refine the filters to narrow the list.
		</p>
	{/if}

	{#if data.rows.length === 0}
		{#if hasFiltersBeyondWindow}
			<EmptyState title="No events match these filters" body="Try widening the time window or clearing the actor / target filters." />
		{:else}
			<EmptyState title="No audit events yet" body="Mutations across every BC will appear here." />
		{/if}
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Time</th>
						<th scope="col">Actor</th>
						<th scope="col">Op</th>
						<th scope="col">Target type</th>
						<th scope="col">Target id</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.id)}
						<tr>
							<td class="mono">
								<a href={ROUTES.HANGAR_ADMIN_AUDIT_DETAIL(row.id)}>{formatTimestamp(row.timestamp)}</a>
							</td>
							<td>
								{#if row.actorId === null}
									<span class="muted">system</span>
								{:else}
									<a href={ROUTES.HANGAR_ADMIN_AUDIT_DETAIL(row.id)}>
										<span class="actor-name">{actorLabel(row)}</span>
										{#if row.actorEmail}
											<span class="actor-email mono">{row.actorEmail}</span>
										{/if}
									</a>
								{/if}
							</td>
							<td><span class="op-pill op-{row.op}">{row.op}</span></td>
							<td class="mono">{row.targetType}</td>
							<td class="mono">{row.targetId ?? '-'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if data.nextCursor !== null}
			<div class="show-more-row">
				<button type="button" class="show-more" onclick={showMore}>Show more</button>
			</div>
		{/if}
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

	.filter-bar {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: var(--space-md);
		align-items: end;
	}

	.window-row {
		grid-template-columns: minmax(0, 1fr) auto auto auto;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		min-width: 0;
	}

	.field label,
	.field .field-label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.field input,
	.field select {
		background: var(--input-default-bg);
		color: var(--input-default-ink);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		font: inherit;
	}

	.field input:focus-visible,
	.field select:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--input-default-hover-border);
	}

	.actor-field {
		grid-column: span 2;
	}

	.actor-input-wrap {
		position: relative;
	}

	.chip-clear {
		position: absolute;
		right: var(--space-2xs);
		top: 50%;
		transform: translateY(-50%);
		background: transparent;
		border: 0;
		color: var(--ink-muted);
		cursor: pointer;
		padding: 0 var(--space-2xs);
		font-size: var(--type-ui-label-size);
	}

	.chip-clear:hover {
		color: var(--ink-body);
	}

	.actor-menu {
		position: absolute;
		top: calc(100% + var(--space-2xs));
		left: 0;
		right: 0;
		max-height: 14rem;
		overflow-y: auto;
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-lg);
		z-index: 10;
	}

	.actor-menu li button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		width: 100%;
		padding: var(--space-xs) var(--space-sm);
		background: transparent;
		border: 0;
		color: var(--ink-body);
		cursor: pointer;
		text-align: left;
		font: inherit;
	}

	.actor-menu li button:hover {
		background: var(--surface-sunken);
	}

	.actor-menu-email {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
	}

	.link-button {
		background: transparent;
		border: 0;
		color: var(--link-default);
		padding: 0;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
		font-size: var(--type-ui-caption-size);
	}

	.link-button:hover {
		color: var(--link-hover);
	}

	.field-actions {
		display: flex;
		align-items: end;
		justify-content: flex-end;
	}

	.chip-group {
		display: inline-flex;
		gap: var(--space-2xs);
		flex-wrap: wrap;
	}

	.chip {
		background: var(--surface-page);
		border: 1px solid var(--edge-default);
		color: var(--ink-body);
		border-radius: var(--radius-pill);
		padding: var(--space-2xs) var(--space-sm);
		font: inherit;
		cursor: pointer;
		font-size: var(--type-ui-caption-size);
	}

	.chip[aria-pressed='true'] {
		background: var(--action-default-wash);
		border-color: var(--action-default);
		color: var(--action-default-hover);
	}

	.chip:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.cap-banner {
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
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
		display: inline-flex;
		flex-direction: column;
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

	.actor-name {
		color: var(--ink-body);
	}

	.actor-email {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.op-pill {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-pill);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.show-more-row {
		display: flex;
		justify-content: center;
		padding: var(--space-md);
	}

	.show-more {
		background: var(--action-default);
		color: var(--action-default-ink);
		border: 0;
		border-radius: var(--radius-sm);
		padding: var(--space-sm) var(--space-lg);
		font: inherit;
		cursor: pointer;
	}

	.show-more:hover {
		background: var(--action-default-hover);
	}
</style>
