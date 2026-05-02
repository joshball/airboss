<script lang="ts">
import {
	CERT_LABELS,
	type Cert,
	CUSTOM_TILE,
	DEPTH_PREFERENCE_LABELS,
	type DepthPreference,
	type Domain,
	domainLabel,
	type Preset,
	type PresetId,
	ROUTES,
	SESSION_MODE_LABELS,
} from '@ab/constants';
import Drawer from '@ab/ui/components/Drawer.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import { humanize } from '@ab/utils';
import { enhance } from '$app/forms';

/**
 * Preset gallery + detail drawer. Owns the in-flight submission state for a
 * single tile so neighbouring tiles render the disabled affordance and the
 * drawer's Start button can show its busy state. Tiles open a drawer with
 * the picked preset; the drawer was the next-best after the in-place
 * `<details>` expansion was failing the grid.
 */

let { presets }: { presets: readonly Preset[] } = $props();

let submittingPresetId = $state<PresetId | null>(null);
let detailPreset = $state<Preset | null>(null);
const detailOpen = $derived(detailPreset !== null);

function openPresetDetail(preset: Preset): void {
	if (submittingPresetId !== null) return;
	detailPreset = preset;
}

function closePresetDetail(): void {
	detailPreset = null;
}

function certLabel(slug: Cert): string {
	return (CERT_LABELS as Record<Cert, string>)[slug] ?? slug;
}

function depthLabel(slug: DepthPreference): string {
	return (DEPTH_PREFERENCE_LABELS as Record<DepthPreference, string>)[slug] ?? humanize(slug);
}
</script>

<section class="gallery" aria-labelledby="gallery-h">
	<h2 id="gallery-h" class="gallery-h">Pick a plan to get started</h2>
	<p class="gallery-hint">
		Each preset activates a plan and starts a session. Pick a tile to preview the shape, then Start.
	</p>
	<ul class="tiles">
		{#each presets as preset, idx (preset.id)}
			{@const isBusy = submittingPresetId === preset.id}
			{@const disableOthers = submittingPresetId !== null && submittingPresetId !== preset.id}
			<li>
				<button
					type="button"
					class="tile tile-button"
					class:is-primary={idx === 0}
					class:is-disabled={disableOthers}
					onclick={() => openPresetDetail(preset)}
					disabled={disableOthers}
					aria-busy={isBusy}
					aria-haspopup="dialog"
					aria-expanded={detailPreset?.id === preset.id ? 'true' : 'false'}
				>
					<span class="tile-label">{preset.label}</span>
					<span class="tile-desc">{preset.description}</span>
					<span class="tile-cta" aria-hidden="true">View details →</span>
				</button>
			</li>
		{/each}
		<li>
			<a
				class="tile tile-custom"
				href={submittingPresetId !== null ? undefined : ROUTES.PLANS_NEW}
				class:is-disabled={submittingPresetId !== null}
				aria-disabled={submittingPresetId !== null ? 'true' : undefined}
				onclick={(e: MouseEvent) => {
					if (submittingPresetId !== null) e.preventDefault();
				}}
			>
				<span class="tile-label">{CUSTOM_TILE.label}</span>
				<span class="tile-desc">{CUSTOM_TILE.description}</span>
			</a>
		</li>
	</ul>

	<Drawer
		open={detailOpen}
		size="md"
		ariaLabelledby="preset-detail-title"
		onClose={closePresetDetail}
	>
		{#snippet header()}
			{#if detailPreset}
				<h2 id="preset-detail-title" class="drawer-title">{detailPreset.label}</h2>
				<p class="drawer-sub">{detailPreset.description}</p>
			{/if}
		{/snippet}
		{#snippet body()}
			{#if detailPreset}
				{@const dp = detailPreset}
				<dl class="tile-meta">
					{#if dp.certGoals.length > 0}
						<div>
							<dt>Cert goals</dt>
							<dd>{dp.certGoals.map((c: Cert) => certLabel(c)).join(', ')}</dd>
						</div>
					{/if}
					{#if dp.focusDomains.length > 0}
						<div>
							<dt>
								<span class="dt-row">
									Focus domains
									<InfoTip
										term="Focus domains"
										definition="Domains the engine biases toward in this plan. More = broader refresher; fewer = deeper focus."
										helpId="focus-domains"
									/>
								</span>
							</dt>
							<dd>{dp.focusDomains.map((d: Domain) => domainLabel(d)).join(', ')}</dd>
						</div>
					{/if}
					{#if dp.skipDomains.length > 0}
						<div>
							<dt>Skip domains</dt>
							<dd>{dp.skipDomains.map((d: Domain) => domainLabel(d)).join(', ')}</dd>
						</div>
					{/if}
					<div>
						<dt>Depth</dt>
						<dd>{depthLabel(dp.depthPreference)}</dd>
					</div>
					<div>
						<dt>Mode</dt>
						<dd>{SESSION_MODE_LABELS[dp.defaultMode]}</dd>
					</div>
					<div>
						<dt>Session length</dt>
						<dd>{dp.sessionLength} items</dd>
					</div>
				</dl>
				<p class="tile-warning">Activating this preset archives any currently active plan.</p>
			{/if}
		{/snippet}
		{#snippet footer()}
			{#if detailPreset}
				{@const isBusy = submittingPresetId === detailPreset.id}
				<button type="button" class="drawer-cancel" onclick={closePresetDetail} disabled={isBusy}>
					Cancel
				</button>
				<form
					method="post"
					action="?/startFromPreset"
					use:enhance={() => {
						if (!detailPreset) return;
						submittingPresetId = detailPreset.id as PresetId;
						return async ({ update }) => {
							await update();
							submittingPresetId = null;
						};
					}}
				>
					<input type="hidden" name="presetId" value={detailPreset.id} />
					<button type="submit" class="tile-start" class:is-busy={isBusy} disabled={isBusy} aria-busy={isBusy}>
						{isBusy ? 'Starting…' : `Start ${detailPreset.label}`}
					</button>
				</form>
			{/if}
		{/snippet}
	</Drawer>
</section>

<style>
	.gallery {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.gallery-h {
		margin: 0;
		font-size: var(--type-reading-lead-size);
		color: var(--ink-body);
	}

	/* Clean two-column desktop grid; collapses to single-column on narrow.
	 * `auto-fit` + a sane min keeps the cells the same size at every width;
	 * the in-place `<details>` expansion was removed so siblings cannot get
	 * stretched by an open tile. Detail lives in the Drawer below. */
	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		gap: var(--space-lg);
	}

	.tiles > li {
		display: flex;
	}

	.tiles > li > a,
	.tiles > li > button {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.tile-button {
		font: inherit;
		text-align: left;
	}

	.tile-button.is-primary {
		border-color: var(--action-default);
	}

	.tile-cta {
		margin-top: auto;
		padding-top: var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--type-heading-3-weight);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--action-default);
	}

	.tile-meta {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-2xs) var(--space-md);
		font-size: var(--type-ui-label-size);
	}

	.tile-meta > div {
		display: contents;
	}

	.tile-meta dt {
		font-weight: var(--type-heading-3-weight);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-size: var(--type-ui-caption-size);
	}

	.tile-meta dd {
		margin: 0;
		color: var(--ink-body);
	}

	.tile-warning {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--signal-warning);
	}

	.dt-row {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2xs);
	}

	.drawer-title {
		margin: 0;
		font-size: var(--type-reading-lead-size);
		color: var(--ink-body);
	}

	.drawer-sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
	}

	.drawer-cancel {
		font: inherit;
		padding: var(--space-sm) var(--space-lg);
		background: transparent;
		color: var(--ink-muted);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background var(--motion-fast);
	}

	.drawer-cancel:hover:not(:disabled) {
		background: var(--surface-sunken);
	}

	.drawer-cancel:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.drawer-cancel:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.tile-start {
		align-self: flex-start;
		padding: var(--space-sm) var(--space-lg);
		background: var(--action-default);
		color: var(--action-default-ink, white);
		border: 1px solid var(--action-default);
		border-radius: var(--radius-md);
		font-weight: var(--type-heading-3-weight);
		font-size: var(--type-ui-label-size);
		cursor: pointer;
		transition: background var(--motion-fast);
	}

	.tile-start:hover:not(:disabled) {
		background: var(--action-default-hover);
	}

	.tile-start:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.tile-start:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.tile-start.is-busy {
		cursor: progress;
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		text-align: left;
		width: 100%;
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg) var(--space-xl);
		box-shadow: var(--shadow-sm);
		cursor: pointer;
		font: inherit;
		color: var(--ink-body);
		text-decoration: none;
		transition:
			border-color var(--motion-fast),
			background var(--motion-fast),
			box-shadow var(--motion-fast),
			transform var(--motion-fast);
	}

	.tile:hover:not(:disabled):not(.is-disabled) {
		border-color: var(--action-default);
		background: var(--surface-muted);
	}

	.tile:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.tile:active:not(:disabled):not(.is-disabled) {
		transform: translateY(1px);
	}

	.tile:disabled,
	.tile.is-disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.tile-label {
		font-size: var(--type-reading-body-size);
		font-weight: var(--type-heading-3-weight);
		color: var(--ink-body);
	}

	.tile-desc {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		line-height: var(--type-ui-label-line-height);
	}

	.gallery-hint {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
	}

	.tile-custom {
		border-style: dashed;
		background: var(--surface-sunken);
	}

	.tile-custom:hover {
		background: var(--surface-muted);
	}
</style>
