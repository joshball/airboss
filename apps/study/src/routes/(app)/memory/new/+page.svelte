<script lang="ts">
import {
	CARD_TYPE_LABELS,
	CARD_TYPES,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	type Domain,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import { humanize } from '@ab/utils';
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

function domainLabel(slug: string): string {
	const known = (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain];
	return known ?? humanize(slug);
}

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
			<h1>New card</h1>
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
				<span class="label">Domain</span>
				<select name="domain" required disabled={loading} value={seededDomain}>
					<option value="" disabled>Pick a domain</option>
					{#each DOMAIN_VALUES as opt (opt)}
						<option value={opt}>{domainLabel(opt)}</option>
					{/each}
				</select>
				{#if fieldErrors.domain}<span class="err">{fieldErrors.domain}</span>{/if}
			</label>

			<label class="field">
				<span class="label">Type</span>
				<select name="cardType" required disabled={loading} value={seededCardType}>
					{#each cardTypeOptions as opt (opt)}
						<option value={opt}>{CARD_TYPE_LABELS[opt]}</option>
					{/each}
				</select>
				{#if fieldErrors.cardType}<span class="err">{fieldErrors.cardType}</span>{/if}
			</label>
		</div>

		<label class="field">
			<span class="label">Tags <span class="hint" id="tags-hint">(comma-separated, optional)</span></span>
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
		gap: var(--ab-space-xl-alt);
	}

	.hd {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--ab-space-lg);
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.sub {
		margin: var(--ab-space-2xs) 0 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-body);
	}

	.back {
		color: var(--ab-color-fg-muted);
		text-decoration: none;
		font-size: var(--ab-font-size-sm);
		padding: var(--ab-space-xs) var(--ab-space-md);
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-sm);
	}

	.back:hover {
		background: var(--ab-color-surface-sunken);
	}

	.banner {
		background: var(--ab-color-primary-subtle);
		border: 1px solid var(--ab-color-primary-subtle-border);
		color: var(--ab-color-primary-active);
		padding: var(--ab-space-sm-alt) var(--ab-space-md-alt);
		border-radius: var(--ab-radius-md);
		font-size: var(--ab-font-size-sm);
	}

	.banner a {
		color: var(--ab-color-primary-hover);
		font-weight: 600;
	}

	.error {
		background: var(--ab-color-danger-subtle);
		border: 1px solid var(--ab-color-danger-subtle-border);
		color: var(--ab-color-danger-active);
		padding: var(--ab-space-sm-alt) var(--ab-space-md-alt);
		border-radius: var(--ab-radius-md);
		font-size: var(--ab-font-size-sm);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-lg);
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-xl);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xs);
	}

	.label {
		font-size: var(--ab-font-size-sm);
		font-weight: 500;
		color: var(--ab-color-fg-strong);
	}

	.hint {
		font-weight: 400;
		color: var(--ab-color-fg-faint);
	}

	textarea,
	input[type='text'],
	select {
		font: inherit;
		padding: var(--ab-space-sm-alt) var(--ab-space-md);
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-md);
		background: white;
		color: var(--ab-color-fg);
		transition: border-color 120ms, box-shadow 120ms;
	}

	textarea {
		resize: vertical;
		min-height: 3rem;
	}

	textarea:focus,
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--ab-color-primary);
		box-shadow: var(--ab-shadow-focus-ring);
	}

	:disabled {
		background: var(--ab-color-surface-sunken);
		cursor: not-allowed;
	}

	.row {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: var(--ab-space-lg);
	}

	.err {
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-danger-hover);
	}

	.actions {
		display: flex;
		gap: var(--ab-space-sm);
		justify-content: flex-end;
		margin-top: var(--ab-space-sm);
		flex-wrap: wrap;
	}

	.btn {
		padding: var(--ab-space-sm) var(--ab-space-lg);
		font-size: var(--ab-font-size-body);
		font-weight: 600;
		border-radius: var(--ab-radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--ab-color-primary-hover);
	}

	.btn.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}

	.btn.secondary:hover:not(:disabled) {
		background: var(--ab-color-border);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}

	.btn.ghost:hover {
		background: var(--ab-color-surface-sunken);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 480px) { /* --ab-breakpoint-sm */
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
