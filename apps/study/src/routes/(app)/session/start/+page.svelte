<script lang="ts">
import {
	type Cert,
	type Domain,
	domainLabel,
	type Preset,
	QUERY_PARAMS,
	ROUTES,
	SESSION_ITEM_KINDS,
	SESSION_MODE_LABELS,
	SESSION_MODE_VALUES,
	SESSION_REASON_CODE_DEFINITIONS,
	SESSION_REASON_CODE_LABELS,
	SESSION_SLICE_LABELS,
	SESSION_SLICES,
	type SessionItemKind,
	type SessionMode,
	type SessionReasonCode,
	type SessionSlice,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { humanize } from '@ab/utils';
import { enhance } from '$app/forms';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import PresetGalleryPanel from './_panels/PresetGalleryPanel.svelte';
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

const KIND_DEFINITIONS: Record<SessionItemKind, string> = {
	[SESSION_ITEM_KINDS.CARD]: 'A flashcard scheduled by FSRS. Reveal the answer, rate Again/Hard/Good/Easy.',
	[SESSION_ITEM_KINDS.REP]: 'A decision-rep scenario. Read the situation, pick an option, see the outcome.',
	[SESSION_ITEM_KINDS.NODE_START]:
		'A knowledge-graph node you have not started yet. Launches the 7-phase guided learn flow.',
};

const KIND_LABELS: Record<SessionItemKind, string> = {
	[SESSION_ITEM_KINDS.CARD]: 'Card',
	[SESSION_ITEM_KINDS.REP]: 'Rep',
	[SESSION_ITEM_KINDS.NODE_START]: 'Node',
};

const KIND_HELP: Record<SessionItemKind, { helpId: string; helpSection: string }> = {
	[SESSION_ITEM_KINDS.CARD]: { helpId: 'memory-review', helpSection: 'fsrs-in-one-paragraph' },
	[SESSION_ITEM_KINDS.REP]: { helpId: 'reps-session', helpSection: '' },
	[SESSION_ITEM_KINDS.NODE_START]: { helpId: 'concept-knowledge-graph', helpSection: '' },
};

function kindHelpSection(kind: SessionItemKind): string | undefined {
	const s = KIND_HELP[kind].helpSection;
	return s === '' ? undefined : s;
}

let { data, form }: { data: PageData; form: ActionData } = $props();

let shuffling = $state(false);
let starting = $state(false);

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

function reasonLabel(code: SessionReasonCode): string {
	return SESSION_REASON_CODE_LABELS[code] ?? humanize(code);
}
</script>

<svelte:head>
	<title>Start session -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		title="Start a session"
		subtitle={preview
			? `${preview.items.length} items queued. Review the plan, then start.`
			: data.needsPlan
				? "Pick a plan to get started -- you'll be in a scenario in one click."
				: undefined}
	>
		{#snippet titleSuffix()}
			<PageHelp pageId="session-start" />
		{/snippet}
		{#snippet actions()}
			<Button variant="ghost" href={ROUTES.DASHBOARD}>Cancel</Button>
		{/snippet}
	</PageHeader>

	{#if data.needsPlan}
		{#if presetError}
			<Banner tone="danger" title="Couldn't start the session">{presetError}</Banner>
		{/if}

		<PresetGalleryPanel {presets} />
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
			<EmptyState
				title="Nothing to study yet"
				body="Add cards or scenarios first, or wait for the knowledge graph to populate."
			>
				{#snippet actions()}
					<Button variant="secondary" href={ROUTES.MEMORY_NEW}>New card</Button>
					<Button variant="secondary" href={ROUTES.REPS_NEW}>New scenario</Button>
				{/snippet}
			</EmptyState>
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
											<span class="detail">-- {item.reasonDetail}</span>
										{/if}
										{#if item.kind === SESSION_ITEM_KINDS.NODE_START}
											<a class="id id-link" href={ROUTES.KNOWLEDGE_SLUG(item.nodeId)}>{item.nodeId}</a>
										{:else if item.kind === SESSION_ITEM_KINDS.CARD}
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

	/* Existing in-plan UI */
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

	/*
	 * Selector values track SESSION_ITEM_KINDS.NODE_START and
	 * SESSION_ITEM_KINDS.REP in @ab/constants. Scoped CSS cannot interpolate
	 * TS constants, so the coupling is expressed via the data-kind attribute
	 * writer above (`data-kind={item.kind}` -- the value comes straight from
	 * the constant).
	 */
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

</style>
