<script lang="ts">
import { CARD_TYPE_LABELS, CARD_TYPES, DOMAIN_VALUES, domainLabel, QUERY_PARAMS, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import { onMount, tick } from 'svelte';
import { enhance } from '$app/forms';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();
let loading = $state(false);
let frontInput = $state<HTMLTextAreaElement | null>(null);
let formEl = $state<HTMLFormElement | null>(null);

const cardTypeOptions = Object.values(CARD_TYPES);

interface FieldValues {
	front?: string;
	back?: string;
	domain?: string;
	cardType?: string;
	tags?: string[];
}

const createdId = $derived(page.url.searchParams.get(QUERY_PARAMS.CREATED));
const fieldErrors = $derived<Record<string, string>>(form?.fieldErrors ?? {});
const values = $derived<FieldValues>(form?.values ?? {});

// When the URL carries forward a domain/tags (after "Save and add another"),
// pre-fill the next card so the rhythm of capture keeps moving.
const seededDomain = $derived(values.domain ?? data.seed.domain ?? '');
const seededCardType = $derived(values.cardType ?? data.seed.cardType ?? CARD_TYPES.BASIC);
const seededTags = $derived(values.tags?.join?.(', ') ?? data.seed.tags ?? '');

// After a redirect back from a successful save, put focus on Front so the
// user can keep typing. The `if (createdId)` read registers the dep and
// also gates the focus call to post-save only; first mount is handled by
// the dedicated onMount below so both entry paths land focus on Front.
$effect(() => {
	if (createdId) {
		void tick().then(() => frontInput?.focus());
	}
});

onMount(() => {
	void tick().then(() => frontInput?.focus());
});

function onKeydown(e: KeyboardEvent) {
	// Cmd/Ctrl + Enter submits from any field.
	if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
		e.preventDefault();
		formEl?.requestSubmit();
	}
}
</script>

<svelte:head>
	<title>New card -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<div class="title-row">
				<h1>New card</h1>
				<PageHelp pageId="memory-new" />
			</div>
			<p class="sub">Capture a question and answer now; the scheduler handles when you see it next.</p>
		</div>
		<a class="back" href={ROUTES.MEMORY_BROWSE}>Browse</a>
	</header>

	{#if createdId}
		<div class="banner" role="status">
			Card saved. <a href={ROUTES.MEMORY_CARD(createdId)}>View it</a> or add another below.
		</div>
	{/if}

	{#if fieldErrors._}
		<div class="error" role="alert">{fieldErrors._}</div>
	{/if}

	<!-- Forms bubble keydown from their inputs; Cmd+Enter-to-submit is an
	     intentional shortcut. -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<form
		method="POST"
		bind:this={formEl}
		onkeydown={onKeydown}
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				loading = false;
				await update();
			};
		}}
	>
		<label class="field">
			<span class="label">Front (question)</span>
			<textarea
				name="front"
				required
				rows="3"
				maxlength="10000"
				placeholder="What are the VFR weather minimums in Class C airspace below 10,000 MSL?"
				disabled={loading}
				value={values.front ?? ''}
				bind:this={frontInput}
				aria-invalid={fieldErrors.front ? 'true' : undefined}
				aria-describedby={fieldErrors.front ? 'front-err' : undefined}
			></textarea>
			{#if fieldErrors.front}<span id="front-err" class="err">{fieldErrors.front}</span>{/if}
		</label>

		<label class="field">
			<span class="label">Back (answer)</span>
			<textarea
				name="back"
				required
				rows="4"
				maxlength="10000"
				placeholder="3 SM, 500 below / 1,000 above / 2,000 horizontal from clouds. 14 CFR 91.155."
				disabled={loading}
				value={values.back ?? ''}
				aria-invalid={fieldErrors.back ? 'true' : undefined}
				aria-describedby={fieldErrors.back ? 'back-err' : undefined}
			></textarea>
			{#if fieldErrors.back}<span id="back-err" class="err">{fieldErrors.back}</span>{/if}
		</label>

		<div class="row">
			<label class="field">
				<span class="label">
					Domain
					<InfoTip
						term="Domain"
						definition="The topic bucket this card belongs to. Drives browse filters and session mix."
						helpId="memory-new"
						helpSection="domain"
					/>
				</span>
				<select name="domain" required disabled={loading} value={seededDomain}>
					<option value="" disabled>Pick a domain</option>
					{#each DOMAIN_VALUES as opt (opt)}
						<option value={opt}>{domainLabel(opt)}</option>
					{/each}
				</select>
				{#if fieldErrors.domain}<span class="err">{fieldErrors.domain}</span>{/if}
			</label>

			<label class="field">
				<span class="label">
					Type
					<InfoTip
						term="Type"
						definition="Card format. Basic is a single front/back question-and-answer. More types are coming."
						helpId="memory-new"
						helpSection="type"
					/>
				</span>
				<select name="cardType" required disabled={loading} value={seededCardType}>
					{#each cardTypeOptions as opt (opt)}
						<option value={opt}>{CARD_TYPE_LABELS[opt]}</option>
					{/each}
				</select>
				{#if fieldErrors.cardType}<span class="err">{fieldErrors.cardType}</span>{/if}
			</label>
		</div>

		<label class="field">
			<span class="label">
				Tags <span class="hint" id="tags-hint">(comma-separated, optional)</span>
				<InfoTip
					term="Tags"
					definition="Freeform labels for cross-cutting retrieval. Use them to group cards beyond domain boundaries."
					helpId="memory-new"
					helpSection="tags"
				/>
			</span>
			<input
				type="text"
				name="tags"
				placeholder="far-91, airspace-class-c"
				disabled={loading}
				value={seededTags}
				aria-describedby="tags-hint"
			/>
			{#if fieldErrors.tags}<span class="err">{fieldErrors.tags}</span>{/if}
		</label>

		<div class="actions">
			<a class="btn ghost" href={ROUTES.MEMORY}>Cancel</a>
			<button type="submit" name="intent" value="save-and-add" class="btn secondary" disabled={loading}>
				Save and add another
			</button>
			<button type="submit" name="intent" value="save" class="btn primary" disabled={loading}>
				{loading ? 'Saving...' : 'Save'}
			</button>
		</div>
	</form>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.hd {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-lg);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--type-definition-body-size);
	}

	.back {
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--type-ui-label-size);
		padding: var(--space-xs) var(--space-md);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
	}

	.back:hover {
		background: var(--surface-sunken);
	}

	.banner {
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		color: var(--action-default-active);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
	}

	.banner a {
		color: var(--action-default-hover);
		font-weight: 600;
	}

	.error {
		background: var(--action-hazard-wash);
		border: 1px solid var(--action-hazard-edge);
		color: var(--action-hazard-active);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.label {
		font-size: var(--type-ui-label-size);
		font-weight: 500;
		color: var(--ink-strong);
	}

	.hint {
		font-weight: 400;
		color: var(--ink-faint);
	}

	textarea,
	input[type='text'],
	select {
		font: inherit;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		background: var(--ink-inverse);
		color: var(--ink-body);
		transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
	}

	textarea {
		resize: vertical;
		min-height: 3rem;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}

	:disabled {
		background: var(--surface-sunken);
		cursor: not-allowed;
	}

	.row {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: var(--space-lg);
	}

	.err {
		font-size: var(--type-ui-label-size);
		color: var(--action-hazard-hover);
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
		margin-top: var(--space-sm);
		flex-wrap: wrap;
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--action-default-hover);
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.btn.secondary:hover:not(:disabled) {
		background: var(--edge-default);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 480px) {
		.row {
			grid-template-columns: 1fr;
		}

		.actions {
			flex-direction: column-reverse;
		}

		.btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
