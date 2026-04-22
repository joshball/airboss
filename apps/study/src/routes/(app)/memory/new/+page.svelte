<script lang="ts">
import { CARD_TYPE_LABELS, CARD_TYPES, DOMAIN_LABELS, DOMAIN_VALUES, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { tick } from 'svelte';
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
// user can keep typing. The `void createdId` read is intentional: it
// registers `createdId` as a dependency so the effect re-fires after each
// "Save and add another" round-trip (a new query param rewrites
// `createdId`). Null on first mount is fine -- focus applies anyway.
$effect(() => {
	void createdId;
	void tick().then(() => frontInput?.focus());
});

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function domainLabel(slug: string): string {
	const known = (DOMAIN_LABELS as Record<string, string>)[slug];
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
		gap: 1.25rem;
	}

	.hd {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.9375rem;
	}

	.back {
		color: #475569;
		text-decoration: none;
		font-size: 0.875rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
	}

	.back:hover {
		background: #f1f5f9;
	}

	.banner {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		color: #1e3a8a;
		padding: 0.625rem 0.875rem;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	.banner a {
		color: #1d4ed8;
		font-weight: 600;
	}

	.error {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #991b1b;
		padding: 0.625rem 0.875rem;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1.5rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #334155;
	}

	.hint {
		font-weight: 400;
		color: #94a3b8;
	}

	textarea,
	input[type='text'],
	select {
		font: inherit;
		padding: 0.625rem 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		background: white;
		color: #0f172a;
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
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	:disabled {
		background: #f1f5f9;
		cursor: not-allowed;
	}

	.row {
		display: grid;
		grid-template-columns: 2fr 1fr;
		gap: 1rem;
	}

	.err {
		font-size: 0.8125rem;
		color: #b91c1c;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		margin-top: 0.5rem;
		flex-wrap: wrap;
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.secondary:hover:not(:disabled) {
		background: #e2e8f0;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
	}

	.btn.ghost:hover {
		background: #f1f5f9;
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
