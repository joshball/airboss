<script lang="ts">
import { domainLabel, ROUTES } from '@ab/constants';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import { enhance } from '$app/forms';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const drafts = $derived(data.drafts);
let busyId = $state<string | null>(null);

function shorten(text: string, n: number): string {
	const trimmed = text.trim();
	if (trimmed.length <= n) return trimmed;
	return `${trimmed.slice(0, n - 1)}…`;
}
</script>

<svelte:head>
	<title>Card drafts -- Memory</title>
</svelte:head>

<section class="page" data-testid="memory-drafts-page">
	<PageHeader
		eyebrow="Memory"
		title="Card drafts"
		subtitle="Cards you queued from the flightbag selection toolbar. Edit + promote, promote as-is, or discard."
	>
		{#snippet actions()}
			<a class="btn ghost" href={ROUTES.MEMORY_BROWSE}>Back to browse</a>
			<a class="btn primary" href={ROUTES.MEMORY_NEW}>+ New card</a>
		{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}
		<p class="error" role="alert">{form.error}</p>
	{/if}

	{#if drafts.length === 0}
		<div class="empty" data-testid="memory-drafts-empty">
			<h2>No drafts yet.</h2>
			<p>
				Open the <a href="/">flightbag</a>, highlight a passage, and pick "Card later" from the selection toolbar to
				queue a draft here.
			</p>
		</div>
	{:else}
		<ul class="draft-list" data-testid="memory-drafts-list">
			{#each drafts as draft (draft.id)}
				<li class="draft" data-draft-id={draft.id} data-testid="memory-draft-row">
					<header class="draft-head">
						<div class="draft-front">
							<span class="label">Front</span>
							{#if draft.front.trim().length > 0}
								<p>{draft.front}</p>
							{:else}
								<p><em>(blank)</em></p>
							{/if}
						</div>
						<div class="draft-meta">
							{#if draft.domain}
								<span class="chip" data-testid="draft-domain">{domainLabel(draft.domain)}</span>
							{:else}
								<span class="chip warn" data-testid="draft-no-domain">Pick a domain</span>
							{/if}
							{#if draft.tags.length > 0}
								{#each draft.tags as tag (tag)}
									<span class="chip subtle">{tag}</span>
								{/each}
							{/if}
						</div>
					</header>

					<div class="draft-body">
						<span class="label">Back</span>
						<p>{shorten(draft.back, 320)}</p>
					</div>

					{#if draft.sourceTitle}
						<p class="source">
							Source:
							{#if draft.sourceUrl}
								<a href={draft.sourceUrl}>{draft.sourceTitle}</a>
							{:else}
								<span>{draft.sourceTitle}</span>
							{/if}
						</p>
					{/if}

					<div class="actions">
						<a class="btn primary" href={draft.editHref} data-testid="draft-edit-link"
							>Edit + promote</a
						>
						<form
							method="POST"
							action="?/promote"
							use:enhance={() => {
								busyId = draft.id;
								return async ({ update }) => {
									busyId = null;
									await update();
								};
							}}
						>
							<input type="hidden" name="draftId" value={draft.id} />
							<button
								type="submit"
								class="btn secondary"
								disabled={!draft.canPromoteAsIs || busyId !== null}
								title={draft.canPromoteAsIs ? 'Create card with the prefill as-is' : 'Front, back, and domain are required'}
								data-testid="draft-promote-as-is"
							>
								Promote as-is
							</button>
						</form>
						<ConfirmAction
							formAction="?/discard"
							label="Discard"
							confirmLabel="Discard (also removes highlight)"
							triggerVariant="ghost"
							confirmVariant="danger"
							size="md"
							disabled={busyId !== null}
							hiddenFields={{ draftId: draft.id }}
						/>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.error {
		background: var(--action-hazard-wash);
		border: 1px solid var(--action-hazard-edge);
		color: var(--action-hazard-active);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
	}

	.empty {
		padding: var(--space-xl);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-lg);
		text-align: center;
		color: var(--ink-muted);
	}

	.empty h2 {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-lg);
		color: var(--ink-strong);
	}

	.draft-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.draft {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		background: var(--surface-panel);
	}

	.draft-head {
		display: flex;
		gap: var(--space-md);
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.draft-front,
	.draft-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		flex: 1 1 auto;
		min-width: 0;
	}

	.draft p {
		margin: 0;
		color: var(--ink-body);
	}

	.label {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.draft-meta {
		display: flex;
		gap: var(--space-2xs);
		flex-wrap: wrap;
	}

	.chip {
		display: inline-block;
		padding: var(--space-3xs) var(--space-2xs);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}

	.chip.warn {
		background: var(--action-caution-wash);
		border-color: var(--action-caution-edge);
		color: var(--action-caution-ink);
	}

	.chip.subtle {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
	}

	.source {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.source a {
		color: inherit;
		text-decoration: underline;
	}

	.actions {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
		align-items: center;
	}

	.btn {
		appearance: none;
		font: inherit;
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		cursor: pointer;
		text-decoration: none;
		color: inherit;
		background: transparent;
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--action-default-ink);
		border-color: var(--action-default-edge);
	}

	.btn.secondary {
		background: var(--action-default-wash);
		color: var(--action-default-ink);
		border-color: var(--action-default-edge);
	}

	.btn.ghost {
		background: transparent;
	}

	.btn.danger {
		color: var(--signal-danger);
		border-color: var(--signal-danger-edge);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
