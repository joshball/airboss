<script lang="ts">
import { type AircraftConfig, listAircraftConfigs } from '@ab/bc-sim';
import { AVIONICS_SELECTABLE_AIRCRAFT, ROUTES, type SimAircraftId } from '@ab/constants';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const SELECTABLE_AIRCRAFT_IDS = new Set<SimAircraftId>(AVIONICS_SELECTABLE_AIRCRAFT);
const aircraft: readonly AircraftConfig[] = listAircraftConfigs();

// `form?.selectedAircraftId` is the optimistic update for the same
// request that wrote the cookie -- the next navigation re-loads the
// layout from the cookie. Falling back to layout data covers initial
// load and any pages where the action did not run.
const selectedAircraftId = $derived<SimAircraftId>(
	(form && 'selectedAircraftId' in form ? form.selectedAircraftId : undefined) ?? data.selectedAircraftId,
);
const fieldError = $derived(form && 'fieldError' in form ? form.fieldError : undefined);

function isSelectable(id: SimAircraftId): boolean {
	return SELECTABLE_AIRCRAFT_IDS.has(id);
}

function selectedDisplayName(id: SimAircraftId): string {
	const cfg = aircraft.find((a) => a.id === id);
	return cfg?.displayName ?? id;
}
</script>

<svelte:head>
	<title>airboss avionics -- aircraft</title>
</svelte:head>

<main>
	<header>
		<h1>Aircraft</h1>
		<p class="subtitle">
			Choose the aircraft the avionics surface is configured for. The PFD
			reads V-speeds against this selection; the second aircraft drops in
			here without any other code change.
		</p>
	</header>

	<section class="current" aria-label="Currently selected aircraft">
		<span class="label">Currently selected</span>
		<strong class="current-name">{selectedDisplayName(selectedAircraftId)}</strong>
	</section>

	<form method="post" class="picker" aria-label="Aircraft picker">
		<fieldset>
			<legend class="visually-hidden">Aircraft</legend>
			<ul>
				{#each aircraft as cfg (cfg.id)}
					{@const selectable = isSelectable(cfg.id)}
					{@const checked = cfg.id === selectedAircraftId}
					<li class:disabled={!selectable}>
						<label>
							<input
								type="radio"
								name="aircraftId"
								value={cfg.id}
								checked={checked}
								disabled={!selectable}
							/>
							<span class="row">
								<span class="name">{cfg.displayName}</span>
								{#if !selectable}
									<span class="tag">coming soon</span>
								{:else if checked}
									<span class="tag tag-active">selected</span>
								{/if}
							</span>
						</label>
					</li>
				{/each}
			</ul>
		</fieldset>

		{#if fieldError}
			<p class="error" role="alert">{fieldError}</p>
		{/if}

		<div class="actions">
			<button type="submit" class="primary">Save selection</button>
		</div>
	</form>

	<footer>
		<a href={ROUTES.AVIONICS_HOME}>Back to avionics</a>
	</footer>
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-xl);
	}

	header {
		margin-bottom: var(--space-2xl);
	}

	h1 {
		margin: 0 0 var(--space-2xs) 0;
		font-size: var(--font-size-2xl);
	}

	.subtitle {
		margin: 0;
		color: var(--ink-muted);
		line-height: var(--line-height-normal);
	}

	.current {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-md) var(--space-lg);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		margin-bottom: var(--space-xl);
	}

	.current .label {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.current-name {
		font-size: var(--font-size-lg);
		color: var(--ink-body);
	}

	.picker fieldset {
		border: none;
		padding: 0;
		margin: 0 0 var(--space-md) 0;
	}

	.picker ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
	}

	.picker li {
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
	}

	.picker li.disabled {
		background: var(--surface-sunken);
		opacity: 0.7;
	}

	.picker label {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		cursor: pointer;
	}

	.picker li.disabled label {
		cursor: not-allowed;
	}

	.picker input[type='radio'] {
		flex-shrink: 0;
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-md);
		flex: 1;
	}

	.name {
		font-size: var(--font-size-body);
		color: var(--ink-body);
	}

	.tag {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.tag-active {
		color: var(--action-default);
	}

	.error {
		margin: 0 0 var(--space-md) 0;
		color: var(--signal-danger-ink);
		font-size: var(--font-size-sm);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	button.primary {
		background: var(--action-default);
		color: var(--action-default-ink);
		border: 1px solid var(--action-default);
		border-radius: var(--radius-sm);
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-body);
		cursor: pointer;
	}

	button.primary:hover,
	button.primary:focus-visible {
		filter: brightness(1.05);
	}

	footer {
		margin-top: var(--space-2xl);
	}

	footer a {
		color: var(--action-default);
		text-decoration: none;
	}

	footer a:hover,
	footer a:focus-visible {
		text-decoration: underline;
	}

	.visually-hidden {
		position: absolute;
		clip: rect(0 0 0 0);
		width: 1px;
		height: 1px;
		overflow: hidden;
		white-space: nowrap;
	}
</style>
