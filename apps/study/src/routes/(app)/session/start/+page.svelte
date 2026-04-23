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
		gap: var(--space-xl);
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
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--type-definition-body-size);
	}

	/* Preset gallery */
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

	.tiles {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--space-lg);
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
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-sm);
		transition: border-color var(--motion-fast);
	}

	.tile-disclosure.is-primary {
		border-color: var(--action-default);
	}

	.tile-disclosure.is-disabled {
		opacity: 0.55;
	}

	.tile-disclosure[open] {
		border-color: var(--action-default);
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
		gap: var(--space-sm);
		width: 100%;
	}

	.tile-chev {
		color: var(--ink-faint);
		font-size: var(--type-ui-label-size);
		transition: transform var(--motion-fast);
	}

	.tile-disclosure[open] .tile-chev {
		transform: rotate(180deg);
	}

	.tile-body {
		padding: var(--space-md) var(--space-xl) var(--space-lg);
		border-top: 1px solid var(--edge-default);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
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

	/* Existing in-plan UI */
	.empty {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-2xl);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		align-items: center;
	}

	.empty h2 {
		margin: 0;
		font-size: var(--type-reading-lead-size);
	}

	.controls {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.mode-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.mode-row label {
		font-weight: var(--type-heading-3-weight);
		font-size: var(--type-ui-label-size);
	}

	.mode-row select {
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		padding: var(--space-xs) var(--space-sm);
		font-size: var(--type-ui-label-size);
		background: var(--surface-panel);
		color: var(--ink-body);
	}

	.meta {
		display: flex;
		gap: var(--space-lg);
		flex-wrap: wrap;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.link {
		color: var(--action-default);
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.note {
		margin: 0;
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-label-size);
	}

	.preview {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-xl) var(--space-2xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.preview > h2 {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: var(--type-heading-3-weight);
	}

	.slice {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.slice-hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.slice-hd h3 {
		margin: 0;
		font-size: var(--type-definition-body-size);
		color: var(--ink-body);
	}

	.count {
		color: var(--ink-subtle);
		font-size: var(--type-ui-caption-size);
	}

	.items {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.item {
		display: flex;
		gap: var(--space-sm);
		align-items: baseline;
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-label-size);
	}

	.kind {
		display: inline-block;
		font-weight: var(--type-heading-1-weight);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-sm);
		background: var(--edge-default);
		color: var(--ink-muted);
	}

	.kind[data-kind='node_start'] {
		background: var(--signal-info-wash);
		color: var(--signal-info);
	}

	.kind[data-kind='rep'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
	}

	.reason {
		color: var(--ink-body);
		font-weight: var(--type-ui-control-weight);
	}

	.detail {
		color: var(--ink-subtle);
	}

	.id {
		margin-left: auto;
		color: var(--ink-faint);
		font-family: var(--font-family-mono, ui-monospace, monospace);
		font-size: var(--type-ui-caption-size);
	}

	.id-link {
		text-decoration: none;
		transition: color var(--motion-fast);
	}

	.id-link:hover {
		color: var(--action-default);
		text-decoration: underline;
	}

	.id-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
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
		gap: var(--space-sm);
	}

	.row {
		display: flex;
		gap: var(--space-sm);
	}

	.muted {
		color: var(--ink-faint);
		margin: 0;
		font-size: var(--type-ui-label-size);
	}
</style>
