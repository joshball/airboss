<script lang="ts">
import type { SessionItem } from '@ab/bc-study';
import {
	ROUTES,
	SESSION_ITEM_KINDS,
	SESSION_REASON_CODE_DEFINITIONS,
	SESSION_REASON_CODE_LABELS,
	SESSION_SLICE_LABELS,
	SESSION_SLICES,
	type SessionItemKind,
	type SessionReasonCode,
	type SessionSlice,
} from '@ab/constants';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import { humanize } from '@ab/utils';

/**
 * Renders the queued session items, grouped by slice. Each slice header
 * carries an InfoTip that drops into the matching subsection of the
 * concept-session-slices help page; each item shows kind/reason/detail
 * with InfoTips to explain the engine's labelling.
 */

let { items }: { items: readonly SessionItem[] } = $props();

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
	[SESSION_ITEM_KINDS.TEACHING_EXERCISE]:
		'A free-response prompt for CFI-style teach-back evidence. Explain or demonstrate the concept; record the outcome.',
};

const KIND_LABELS: Record<SessionItemKind, string> = {
	[SESSION_ITEM_KINDS.CARD]: 'Card',
	[SESSION_ITEM_KINDS.REP]: 'Rep',
	[SESSION_ITEM_KINDS.NODE_START]: 'Node',
	[SESSION_ITEM_KINDS.TEACHING_EXERCISE]: 'Teaching',
};

const KIND_HELP: Record<SessionItemKind, { helpId: string; helpSection: string }> = {
	[SESSION_ITEM_KINDS.CARD]: { helpId: 'memory-review', helpSection: 'fsrs-in-one-paragraph' },
	[SESSION_ITEM_KINDS.REP]: { helpId: 'reps-session', helpSection: '' },
	[SESSION_ITEM_KINDS.NODE_START]: { helpId: 'concept-knowledge-graph', helpSection: '' },
	[SESSION_ITEM_KINDS.TEACHING_EXERCISE]: { helpId: 'concept-knowledge-graph', helpSection: '' },
};

function kindHelpSection(kind: SessionItemKind): string | undefined {
	const s = KIND_HELP[kind].helpSection;
	return s === '' ? undefined : s;
}

function reasonLabel(code: SessionReasonCode): string {
	return SESSION_REASON_CODE_LABELS[code] ?? humanize(code);
}

// Group items by slice for preview rendering.
const bySlice = $derived.by<Record<SessionSlice, SessionItem[]>>(() => {
	const out: Record<SessionSlice, SessionItem[]> = {
		[SESSION_SLICES.CONTINUE]: [],
		[SESSION_SLICES.STRENGTHEN]: [],
		[SESSION_SLICES.EXPAND]: [],
		[SESSION_SLICES.DIVERSIFY]: [],
	};
	for (const item of items) out[item.slice].push(item);
	return out;
});
</script>

<article class="preview">
	<h2>Preview</h2>
	{#each Object.values(SESSION_SLICES) as slice (slice)}
		{@const sliceItems = bySlice[slice]}
		{#if sliceItems && sliceItems.length > 0}
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
					<span class="count">{sliceItems.length}</span>
				</header>
				<ol class="items">
					{#each sliceItems as item, idx (idx)}
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
								<a class="id id-link" href={ROUTES.REFERENCE_KNOWLEDGE_SLUG(item.nodeId)}>{item.nodeId}</a>
							{:else if item.kind === SESSION_ITEM_KINDS.CARD}
								<a class="id id-link" href={ROUTES.MEMORY_CARD(item.cardId)}>{item.cardId}</a>
							{:else if item.kind === SESSION_ITEM_KINDS.REP}
								<a class="id id-link" href={ROUTES.REP_DETAIL(item.scenarioId)}>{item.scenarioId}</a>
							{:else}
								<!-- teaching-exercise: engine does not yet generate them (evidence-kind-data-layer
								     ships the substrate; runtime pickup is a follow-on WP). Render the id as
								     plain text until that WP adds a `/teaching/[id]` route. -->
								<span class="id">{item.teachingExerciseId}</span>
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{/each}
</article>

<style>
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
</style>
