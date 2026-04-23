<script lang="ts">
import {
	CERT_LABELS,
	type Cert,
	CUSTOM_TILE,
	DEPTH_PREFERENCE_LABELS,
	type DepthPreference,
	DOMAIN_LABELS,
	type Domain,
	type Preset,
	type PresetId,
	QUERY_PARAMS,
	ROUTES,
	SESSION_MODE_LABELS,
	SESSION_MODE_VALUES,
	SESSION_REASON_CODE_DEFINITIONS,
	SESSION_REASON_CODE_LABELS,
	SESSION_SLICE_LABELS,
	SESSION_SLICES,
	type SessionMode,
	type SessionReasonCode,
	type SessionSlice,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import { humanize } from '@ab/utils';
import { enhance } from '$app/forms';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';
import SessionLegend from './SessionLegend.svelte';

/**
 * Plain-English descriptions of each slice for InfoTips. Drive the short
 * definition shown in the popover; "Learn more" jumps to the matching
 * section on the session-slices concept page.
 */
const SLICE_DEFINITIONS: Record<SessionSlice, string> = {
	[SESSION_SLICES.CONTINUE]:
		'Pick up where you left off. Cards due in a domain you just studied, or nodes you started but did not finish.',
	[SESSION_SLICES.STRENGTHEN]:
		'Fix things the engine thinks are slipping. Relearning, overdue, recently-missed, or mastery-regressed items.',
	[SESSION_SLICES.EXPAND]:
		'Move the frontier forward. Unstarted core nodes whose prerequisites are met, or nodes that match your focus domain.',
	[SESSION_SLICES.DIVERSIFY]:
		'Rotate into domains you have been ignoring so the queue does not collapse into a single topic.',
};

/**
 * Per-slice help-page fragment (on `concept-session-slices`). Used by the
 * slice-heading InfoTips' "Learn more" link so the popover jumps you to
 * the exact subsection for that slice.
 */
const SLICE_HELP_SECTION: Record<SessionSlice, string> = {
	[SESSION_SLICES.CONTINUE]: 'continue',
	[SESSION_SLICES.STRENGTHEN]: 'strengthen',
	[SESSION_SLICES.EXPAND]: 'expand',
	[SESSION_SLICES.DIVERSIFY]: 'diversify',
};

const KIND_DEFINITIONS = {
	card: 'A flashcard scheduled by FSRS. Reveal the answer, rate Again/Hard/Good/Easy.',
	rep: 'A decision-rep scenario. Read the situation, pick an option, see the outcome.',
	node_start: 'A knowledge-graph node you have not started yet. Launches the 7-phase guided learn flow.',
} as const;

const KIND_LABELS = {
	card: 'Card',
	rep: 'Rep',
	node_start: 'Node',
} as const;

const KIND_HELP = {
	card: { helpId: 'memory-review', helpSection: 'fsrs-in-one-paragraph' },
	rep: { helpId: 'reps-session', helpSection: '' },
	node_start: { helpId: 'concept-knowledge-graph', helpSection: '' },
} as const;

function kindHelpSection(kind: 'card' | 'rep' | 'node_start'): string | undefined {
	const s = KIND_HELP[kind].helpSection;
	return s === '' ? undefined : s;
}

let { data, form }: { data: PageData; form: ActionData } = $props();

let shuffling = $state(false);
let starting = $state(false);
/** Id of the preset tile currently submitting. Drives pending UI on that tile only. */
let submittingPresetId = $state<PresetId | null>(null);

const preview = $derived(data.needsPlan ? null : data.preview);
const presets: readonly Preset[] = $derived(data.needsPlan ? data.presets : []);
const presetError = $derived(typeof form?.error === 'string' ? form.error : null);

type PreviewItem = NonNullable<typeof preview>['items'][number];

// Group items by slice for preview rendering.
const bySlice = $derived.by<Record<SessionSlice, PreviewItem[]>>(() => {
	const out: Record<SessionSlice, PreviewItem[]> = {
		[SESSION_SLICES.CONTINUE]: [],
		[SESSION_SLICES.STRENGTHEN]: [],
		[SESSION_SLICES.EXPAND]: [],
		[SESSION_SLICES.DIVERSIFY]: [],
	};
	if (!preview) return out;
	for (const item of preview.items) out[item.slice].push(item);
	return out;
});

async function shuffle() {
	shuffling = true;
	const next = new URL(page.url);
	next.searchParams.set(QUERY_PARAMS.SESSION_SEED, Math.random().toString(36).slice(2));
	await goto(next, { replaceState: true, invalidateAll: true });
	shuffling = false;
}

function changeMode(nextMode: SessionMode) {
	const next = new URL(page.url);
	next.searchParams.set(QUERY_PARAMS.SESSION_MODE, nextMode);
	next.searchParams.delete(QUERY_PARAMS.SESSION_SEED);
	void goto(next, { replaceState: true, invalidateAll: true });
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
}

function reasonLabel(code: SessionReasonCode): string {
	return SESSION_REASON_CODE_LABELS[code] ?? humanize(code);
}

function certLabel(slug: Cert): string {
	return (CERT_LABELS as Record<Cert, string>)[slug] ?? slug;
}

function depthLabel(slug: DepthPreference): string {
	return (DEPTH_PREFERENCE_LABELS as Record<DepthPreference, string>)[slug] ?? humanize(slug);
}
</script>

<svelte:head>
	<title>Start session -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<div class="title-row">
				<h1>Start a session</h1>
				<PageHelp pageId="session-start" />
			</div>
			{#if preview}
				<p class="sub">{preview.items.length} items queued. Review the plan, then start.</p>
			{:else if data.needsPlan}
				<p class="sub">Pick a plan to get started -- you'll be in a scenario in one click.</p>
			{/if}
		</div>
		<nav class="quick">
			<Button variant="ghost" href={ROUTES.DASHBOARD}>Cancel</Button>
		</nav>
	</header>

	{#if data.needsPlan}
		{#if presetError}
			<Banner variant="danger" title="Couldn't start the session">{presetError}</Banner>
		{/if}

		<section class="gallery" aria-labelledby="gallery-h">
			<h2 id="gallery-h" class="gallery-h">Pick a plan to get started</h2>
			<p class="gallery-hint">
				Each preset activates a plan and starts a session. Expand a tile to preview the shape, then Start.
			</p>
			<ul class="tiles">
				{#each presets as preset, idx (preset.id)}
					{@const isBusy = submittingPresetId === preset.id}
					{@const disableOthers = submittingPresetId !== null && submittingPresetId !== preset.id}
					<li>
						<details class="tile-disclosure" class:is-primary={idx === 0} class:is-disabled={disableOthers}>
							<summary class="tile tile-summary" aria-busy={isBusy}>
								<span class="tile-heading">
									<span class="tile-label">{preset.label}</span>
									<span class="tile-chev" aria-hidden="true">▾</span>
								</span>
								<span class="tile-desc">{preset.description}</span>
							</summary>
							<div class="tile-body">
								<dl class="tile-meta">
									{#if preset.certGoals.length > 0}
										<div>
											<dt>Cert goals</dt>
											<dd>{preset.certGoals.map((c) => certLabel(c)).join(', ')}</dd>
										</div>
									{/if}
									{#if preset.focusDomains.length > 0}
										<div>
											<dt>Focus domains</dt>
											<dd>{preset.focusDomains.map((d) => domainLabel(d)).join(', ')}</dd>
										</div>
									{/if}
									{#if preset.skipDomains.length > 0}
										<div>
											<dt>Skip domains</dt>
											<dd>{preset.skipDomains.map((d) => domainLabel(d)).join(', ')}</dd>
										</div>
									{/if}
									<div>
										<dt>Depth</dt>
										<dd>{depthLabel(preset.depthPreference)}</dd>
									</div>
									<div>
										<dt>Mode</dt>
										<dd>{SESSION_MODE_LABELS[preset.defaultMode]}</dd>
									</div>
									<div>
										<dt>Session length</dt>
										<dd>{preset.sessionLength} items</dd>
									</div>
								</dl>
								<p class="tile-warning">Activating this preset archives any currently active plan.</p>
								<form
									method="post"
									action="?/startFromPreset"
									use:enhance={() => {
										submittingPresetId = preset.id as PresetId;
										return async ({ update }) => {
											await update();
											submittingPresetId = null;
										};
									}}
								>
									<input type="hidden" name="presetId" value={preset.id} />
									<button
										type="submit"
										class="tile-start"
										class:is-busy={isBusy}
										disabled={isBusy || disableOthers}
										aria-busy={isBusy}
									>
										{isBusy ? 'Starting…' : `Start ${preset.label}`}
									</button>
								</form>
							</div>
						</details>
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
		</section>
	{:else if preview}
		<article class="controls">
			<div class="mode-row">
				<label for="mode">Mode</label>
				<select
					id="mode"
					value={preview.mode}
					onchange={(e) => changeMode((e.target as HTMLSelectElement).value as SessionMode)}
				>
					{#each SESSION_MODE_VALUES as m (m)}
						<option value={m}>{SESSION_MODE_LABELS[m as SessionMode]}</option>
					{/each}
				</select>
			</div>

			<div class="meta">
				<span>Length: {preview.sessionLength}</span>
				<span>Plan: <a class="link" href={ROUTES.PLAN(preview.plan.id)}>{preview.plan.title}</a></span>
				{#if preview.focus}<span>Focus: {domainLabel(preview.focus)}</span>{/if}
				{#if preview.cert}<span>Cert: {preview.cert}</span>{/if}
			</div>

			{#if preview.short}
				<p class="note">Not enough candidates to fill {preview.sessionLength} slots. You'll get {preview.items.length}.</p>
			{/if}
		</article>

		{#if preview.items.length === 0}
			<article class="empty">
				<h2>Nothing to study yet</h2>
				<p class="muted">Add cards or scenarios first, or wait for the knowledge graph to populate.</p>
				<div class="row">
					<Button variant="secondary" href={ROUTES.MEMORY_NEW}>New card</Button>
					<Button variant="secondary" href={ROUTES.REPS_NEW}>New scenario</Button>
				</div>
			</article>
		{:else}
			<SessionLegend />

			<article class="preview">
				<h2>Preview</h2>
				{#each Object.values(SESSION_SLICES) as slice (slice)}
					{@const items = bySlice[slice]}
					{#if items && items.length > 0}
						<section class="slice">
							<header class="slice-hd">
								<h3>
									{SESSION_SLICE_LABELS[slice]}
									<InfoTip
										term={SESSION_SLICE_LABELS[slice]}
										definition={SLICE_DEFINITIONS[slice]}
										helpId="concept-session-slices"
										helpSection={SLICE_HELP_SECTION[slice]}
									/>
								</h3>
								<span class="count">{items.length}</span>
							</header>
							<ol class="items">
								{#each items as item, idx (idx)}
									<li class="item">
										<span class="kind-wrap">
											<span class="kind" data-kind={item.kind}>
												{KIND_LABELS[item.kind]}
											</span>
											<InfoTip
												term={KIND_LABELS[item.kind]}
												definition={KIND_DEFINITIONS[item.kind]}
												helpId={KIND_HELP[item.kind].helpId}
												helpSection={kindHelpSection(item.kind)}
											/>
										</span>
										<span class="reason-wrap">
											<span class="reason">{reasonLabel(item.reasonCode)}</span>
											<InfoTip
												term={reasonLabel(item.reasonCode)}
												definition={SESSION_REASON_CODE_DEFINITIONS[item.reasonCode]}
												helpId="session-start"
												helpSection="reason-codes"
											/>
										</span>
										{#if item.reasonDetail}
											<span class="detail">— {item.reasonDetail}</span>
										{/if}
										{#if item.kind === 'node_start'}
											<a class="id id-link" href={ROUTES.KNOWLEDGE_SLUG(item.nodeId)}>{item.nodeId}</a>
										{:else if item.kind === 'card'}
											<a class="id id-link" href={ROUTES.MEMORY_CARD(item.cardId)}>{item.cardId}</a>
										{:else}
											<a class="id id-link" href={ROUTES.REP_DETAIL(item.scenarioId)}>{item.scenarioId}</a>
										{/if}
									</li>
								{/each}
							</ol>
						</section>
					{/if}
				{/each}
			</article>

			<form
				method="post"
				action="?/start"
				class="start-row"
				use:enhance={() => {
					starting = true;
					return async ({ update }) => {
						await update();
						starting = false;
					};
				}}
			>
				<input type="hidden" name="mode" value={preview.mode} />
				{#if preview.focus}<input type="hidden" name="focus" value={preview.focus} />{/if}
				{#if preview.cert}<input type="hidden" name="cert" value={preview.cert} />{/if}
				<input type="hidden" name="seed" value={preview.seed} />
				<Button variant="secondary" onclick={shuffle} disabled={shuffling} loading={shuffling} loadingLabel="Shuffling…">
					Shuffle
				</Button>
				<Button type="submit" variant="primary" disabled={starting} loading={starting} loadingLabel="Starting…">
					Start session
				</Button>
			</form>
		{/if}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xl);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--ab-space-lg);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.sub {
		margin: var(--ab-space-2xs) 0 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-body);
	}

	/* Preset gallery */
	.gallery {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-lg);
	}

	.gallery-h {
		margin: 0;
		font-size: var(--ab-font-size-lg);
		color: var(--ab-color-fg);
	}

	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--ab-space-lg);
	}

	.tiles > li {
		display: flex;
	}

	.tiles > li > a,
	.tiles > li > details {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.tile-disclosure {
		margin: 0;
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		box-shadow: var(--ab-shadow-sm);
		transition: border-color var(--ab-transition-fast);
	}

	.tile-disclosure.is-primary {
		border-color: var(--ab-color-primary);
	}

	.tile-disclosure.is-disabled {
		opacity: 0.55;
	}

	.tile-disclosure[open] {
		border-color: var(--ab-color-primary);
	}

	.tile-summary {
		list-style: none;
		cursor: pointer;
	}

	.tile-summary::-webkit-details-marker {
		display: none;
	}

	.tile-heading {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--ab-space-sm);
		width: 100%;
	}

	.tile-chev {
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-sm);
		transition: transform var(--ab-transition-fast);
	}

	.tile-disclosure[open] .tile-chev {
		transform: rotate(180deg);
	}

	.tile-body {
		padding: var(--ab-space-md) var(--ab-space-xl) var(--ab-space-lg);
		border-top: 1px solid var(--ab-color-border);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md);
	}

	.tile-meta {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--ab-space-2xs) var(--ab-space-md);
		font-size: var(--ab-font-size-sm);
	}

	.tile-meta > div {
		display: contents;
	}

	.tile-meta dt {
		font-weight: var(--ab-font-weight-semibold);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: var(--ab-font-size-xs);
	}

	.tile-meta dd {
		margin: 0;
		color: var(--ab-color-fg);
	}

	.tile-warning {
		margin: 0;
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-warning-active);
	}

	.tile-start {
		align-self: flex-start;
		padding: var(--ab-space-sm) var(--ab-space-lg);
		background: var(--ab-color-primary);
		color: var(--ab-color-fg-on-primary, white);
		border: 1px solid var(--ab-color-primary);
		border-radius: var(--ab-control-radius);
		font-weight: var(--ab-font-weight-semibold);
		font-size: var(--ab-font-size-sm);
		cursor: pointer;
		transition: background var(--ab-transition-fast);
	}

	.tile-start:hover:not(:disabled) {
		background: var(--ab-color-primary-hover);
	}

	.tile-start:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
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
		gap: var(--ab-space-2xs);
		text-align: left;
		width: 100%;
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-space-lg) var(--ab-space-xl);
		box-shadow: var(--ab-shadow-sm);
		cursor: pointer;
		font: inherit;
		color: var(--ab-color-fg);
		text-decoration: none;
		transition:
			border-color var(--ab-transition-fast),
			background var(--ab-transition-fast),
			box-shadow var(--ab-transition-fast),
			transform var(--ab-transition-fast);
	}

	.tile:hover:not(:disabled):not(.is-disabled) {
		border-color: var(--ab-color-primary);
		background: var(--ab-color-surface-muted);
	}

	.tile:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
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
		font-size: var(--ab-font-size-base);
		font-weight: var(--ab-font-weight-semibold);
		color: var(--ab-color-fg);
	}

	.tile-desc {
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-muted);
		line-height: var(--ab-line-height-normal);
	}

	.gallery-hint {
		margin: 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-sm);
	}

	.tile-custom {
		border-style: dashed;
		background: var(--ab-color-surface-sunken);
	}

	.tile-custom:hover {
		background: var(--ab-color-surface-muted);
	}

	/* Existing in-plan UI */
	.empty {
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-space-2xl);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md);
		align-items: center;
	}

	.empty h2 {
		margin: 0;
		font-size: var(--ab-font-size-lg);
	}

	.controls {
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-space-lg) var(--ab-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md);
	}

	.mode-row {
		display: flex;
		align-items: center;
		gap: var(--ab-space-sm);
	}

	.mode-row label {
		font-weight: var(--ab-font-weight-semibold);
		font-size: var(--ab-font-size-sm);
	}

	.mode-row select {
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-control-radius);
		padding: var(--ab-space-xs) var(--ab-space-sm);
		font-size: var(--ab-font-size-sm);
		background: var(--ab-color-surface);
		color: var(--ab-color-fg);
	}

	.meta {
		display: flex;
		gap: var(--ab-space-lg);
		flex-wrap: wrap;
		color: var(--ab-color-fg-muted);
		font-size: var(--ab-font-size-sm);
	}

	.link {
		color: var(--ab-color-primary);
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.note {
		margin: 0;
		color: var(--ab-color-warning-active);
		background: var(--ab-color-warning-subtle);
		padding: var(--ab-space-sm) var(--ab-space-md);
		border-radius: var(--ab-radius-sm);
		font-size: var(--ab-font-size-sm);
	}

	.preview {
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-space-xl) var(--ab-space-2xl);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-lg);
	}

	.preview > h2 {
		margin: 0;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: var(--ab-font-weight-semibold);
	}

	.slice {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-sm);
	}

	.slice-hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.slice-hd h3 {
		margin: 0;
		font-size: var(--ab-font-size-body);
		color: var(--ab-color-fg);
	}

	.count {
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-xs);
	}

	.items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-2xs);
	}

	.item {
		display: flex;
		gap: var(--ab-space-sm);
		align-items: baseline;
		padding: var(--ab-space-xs) var(--ab-space-md);
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-sm);
		font-size: var(--ab-font-size-sm);
	}

	.kind {
		display: inline-block;
		font-weight: var(--ab-font-weight-bold);
		font-size: var(--ab-font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: var(--ab-space-2xs) var(--ab-space-xs);
		border-radius: var(--ab-radius-sm);
		background: var(--ab-color-border);
		color: var(--ab-color-fg-muted);
	}

	.kind[data-kind='node_start'] {
		background: var(--ab-color-info-subtle);
		color: var(--ab-color-info-active);
	}

	.kind[data-kind='rep'] {
		background: var(--ab-color-warning-subtle);
		color: var(--ab-color-warning-active);
	}

	.reason {
		color: var(--ab-color-fg);
		font-weight: var(--ab-font-weight-medium);
	}

	.detail {
		color: var(--ab-color-fg-subtle);
	}

	.id {
		margin-left: auto;
		color: var(--ab-color-fg-faint);
		font-family: var(--ab-font-family-mono, ui-monospace, monospace);
		font-size: var(--ab-font-size-xs);
	}

	.id-link {
		text-decoration: none;
		transition: color var(--ab-transition-fast);
	}

	.id-link:hover {
		color: var(--ab-color-primary);
		text-decoration: underline;
	}

	.id-link:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
		border-radius: var(--ab-radius-sm);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--ab-space-sm);
		flex-wrap: wrap;
	}

	.kind-wrap,
	.reason-wrap {
		display: inline-flex;
		align-items: baseline;
	}

	.start-row {
		display: flex;
		justify-content: flex-end;
		gap: var(--ab-space-sm);
	}

	.row {
		display: flex;
		gap: var(--ab-space-sm);
	}

	.muted {
		color: var(--ab-color-fg-faint);
		margin: 0;
		font-size: var(--ab-font-size-sm);
	}
</style>
