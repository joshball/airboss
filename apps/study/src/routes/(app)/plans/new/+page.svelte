<script lang="ts">
import {
	CERT_LABELS,
	CERT_VALUES,
	type Cert,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCE_LABELS,
	DEPTH_PREFERENCE_VALUES,
	type DepthPreference,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	type Domain,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	ROUTES,
	SESSION_MODE_LABELS,
	SESSION_MODE_VALUES,
	type SessionMode,
} from '@ab/constants';
import { enhance } from '$app/forms';
import type { ActionData } from './$types';

let { form }: { form: ActionData } = $props();

let sessionLength = $state<number>(DEFAULT_SESSION_LENGTH);
let submitting = $state(false);

// Live state mirrors of the form so the preview can reflect what the user sees.
// Seeded from `form.values` when a prior submit failed; otherwise defaults.
// svelte-ignore state_referenced_locally -- initial seed is the authoritative source; subsequent updates via bindings
const seedFormValues = form?.values;

let title = $state<string>((seedFormValues?.title as string | undefined) ?? '');
let selectedCerts = $state<Set<string>>(new Set((seedFormValues?.certGoals ?? []) as string[]));
let selectedFocus = $state<Set<string>>(new Set((seedFormValues?.focusDomains ?? []) as string[]));
let selectedSkip = $state<Set<string>>(new Set((seedFormValues?.skipDomains ?? []) as string[]));
let depthPreference = $state<DepthPreference>('working');
let defaultMode = $state<SessionMode>('mixed');

function toggleCert(cert: string, checked: boolean) {
	const next = new Set(selectedCerts);
	if (checked) next.add(cert);
	else next.delete(cert);
	selectedCerts = next;
}

function toggleFocus(d: string, checked: boolean) {
	const next = new Set(selectedFocus);
	if (checked) next.add(d);
	else next.delete(d);
	selectedFocus = next;
}

function toggleSkip(d: string, checked: boolean) {
	const next = new Set(selectedSkip);
	if (checked) next.add(d);
	else next.delete(d);
	selectedSkip = next;
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? slug;
}

function certLabel(slug: string): string {
	return (CERT_LABELS as Record<string, string>)[slug] ?? slug;
}

// Preview: sorted labels so the summary is stable regardless of click order.
const certPreview = $derived([...selectedCerts].sort().map((c) => certLabel(c)));
const focusPreview = $derived([...selectedFocus].sort().map((d) => domainLabel(d)));
const skipPreview = $derived([...selectedSkip].sort().map((d) => domainLabel(d)));
</script>

<svelte:head>
	<title>New plan -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>New study plan</h1>
			<p class="sub">Pick goals, focus areas, and session length. Activating this plan archives any existing one.</p>
		</div>
	</header>

	<form
		method="post"
		class="wizard"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		{#if form?.error}
			<div class="error" role="alert">{form.error}</div>
		{/if}

		<fieldset>
			<legend>Plan name (optional)</legend>
			<input type="text" name="title" placeholder="Default Plan" maxlength="200" bind:value={title} />
		</fieldset>

		<fieldset>
			<legend>Certifications you're studying toward</legend>
			<p class="help">
				Pick one or more, or leave all unchecked for general practice across every domain. Items shown will be scoped
				to the selected certs.
			</p>
			<div class="choice-row">
				{#each CERT_VALUES as cert (cert)}
					<label class="choice">
						<input
							type="checkbox"
							name="certGoals"
							value={cert}
							checked={selectedCerts.has(cert)}
							onchange={(e) => toggleCert(cert, (e.currentTarget as HTMLInputElement).checked)}
						/>
						<span>{CERT_LABELS[cert as Cert]}</span>
					</label>
				{/each}
			</div>
			<p class="help subtle">
				No cert selected = cert-agnostic plan (general practice, no filter). Matches the "Quick reps" preset shape.
			</p>
		</fieldset>

		<fieldset>
			<legend>Focus domains (optional)</legend>
			<p class="help">Items in these domains get a slight score boost. Leave blank for balanced study.</p>
			<div class="choice-grid">
				{#each DOMAIN_VALUES as d (d)}
					<label class="choice">
						<input
							type="checkbox"
							name="focusDomains"
							value={d}
							checked={selectedFocus.has(d)}
							onchange={(e) => toggleFocus(d, (e.currentTarget as HTMLInputElement).checked)}
						/>
						<span>{DOMAIN_LABELS[d as Domain]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Skip domains (optional)</legend>
			<p class="help">Domains you don't want to see. Cannot overlap with focus.</p>
			<div class="choice-grid">
				{#each DOMAIN_VALUES as d (d)}
					<label class="choice">
						<input
							type="checkbox"
							name="skipDomains"
							value={d}
							checked={selectedSkip.has(d)}
							onchange={(e) => toggleSkip(d, (e.currentTarget as HTMLInputElement).checked)}
						/>
						<span>{DOMAIN_LABELS[d as Domain]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Depth preference</legend>
			<div class="choice-row">
				{#each DEPTH_PREFERENCE_VALUES as d (d)}
					<label class="choice radio">
						<input type="radio" name="depthPreference" value={d} bind:group={depthPreference} />
						<span>{DEPTH_PREFERENCE_LABELS[d as DepthPreference]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Default session mode</legend>
			<div class="choice-row">
				{#each SESSION_MODE_VALUES as m (m)}
					<label class="choice radio">
						<input type="radio" name="defaultMode" value={m} bind:group={defaultMode} />
						<span>{SESSION_MODE_LABELS[m as SessionMode]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Items per session: {sessionLength}</legend>
			<input
				type="range"
				name="sessionLength"
				min={MIN_SESSION_LENGTH}
				max={MAX_SESSION_LENGTH}
				bind:value={sessionLength}
			/>
			<div class="range-caps">
				<span>{MIN_SESSION_LENGTH}</span>
				<span>{MAX_SESSION_LENGTH}</span>
			</div>
		</fieldset>

		<aside class="preview" aria-label="Plan preview">
			<h2 class="preview-h">Plan preview</h2>
			<p class="preview-help">Review before you create. Activating this plan archives any existing one.</p>
			<dl class="preview-meta">
				<div>
					<dt>Name</dt>
					<dd>{title.trim().length > 0 ? title : 'Default Plan'}</dd>
				</div>
				<div>
					<dt>Cert goals</dt>
					<dd>{certPreview.length > 0 ? certPreview.join(', ') : 'General practice (no cert filter)'}</dd>
				</div>
				<div>
					<dt>Focus domains</dt>
					<dd>{focusPreview.length > 0 ? focusPreview.join(', ') : 'Balanced (all domains)'}</dd>
				</div>
				<div>
					<dt>Skip domains</dt>
					<dd>{skipPreview.length > 0 ? skipPreview.join(', ') : 'None'}</dd>
				</div>
				<div>
					<dt>Depth</dt>
					<dd>{DEPTH_PREFERENCE_LABELS[depthPreference]}</dd>
				</div>
				<div>
					<dt>Mode</dt>
					<dd>{SESSION_MODE_LABELS[defaultMode]}</dd>
				</div>
				<div>
					<dt>Session length</dt>
					<dd>{sessionLength} items</dd>
				</div>
			</dl>
		</aside>

		<div class="actions">
			<a class="btn ghost" href={ROUTES.PLANS}>Cancel</a>
			<button type="submit" class="btn primary" disabled={submitting}>
				{submitting ? 'Creating…' : 'Create plan'}
			</button>
		</div>
	</form>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.sub {
		margin: 0.25rem 0 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-body);
	}

	.wizard {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	fieldset {
		border: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	legend {
		font-weight: 600;
		color: var(--ab-color-fg);
	}

	.help {
		margin: 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-sm);
	}

	.help.subtle {
		color: var(--ab-color-fg-faint);
		font-size: 0.75rem;
		font-style: italic;
	}

	.preview {
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.preview-h {
		margin: 0;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.preview-help {
		margin: 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-sm);
	}

	.preview-meta {
		margin: 0;
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 0.875rem;
		font-size: var(--ab-font-size-sm);
	}

	.preview-meta > div {
		display: contents;
	}

	.preview-meta dt {
		font-weight: 600;
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: var(--ab-font-size-xs);
	}

	.preview-meta dd {
		margin: 0;
		color: var(--ab-color-fg);
	}

	input[type='text'] {
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-md);
		padding: 0.5rem 0.75rem;
		font-size: var(--ab-font-size-body);
	}

	.choice-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.choice-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.375rem;
	}

	.choice {
		display: inline-flex;
		gap: 0.375rem;
		align-items: center;
		padding: 0.375rem 0.75rem;
		background: var(--ab-color-surface-muted);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		cursor: pointer;
		font-size: var(--ab-font-size-sm);
	}

	.choice:hover {
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.choice input {
		accent-color: var(--ab-color-primary);
	}

	.range-caps {
		display: flex;
		justify-content: space-between;
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-subtle);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.error {
		background: var(--ab-color-danger-subtle);
		color: var(--ab-color-danger-hover);
		padding: 0.625rem 0.875rem;
		border-radius: var(--ab-radius-md);
		border: 1px solid var(--ab-color-danger-subtle-border);
		font-size: var(--ab-font-size-sm);
	}

	.btn {
		padding: 0.5rem 1rem;
		font-size: var(--ab-font-size-body);
		font-weight: 600;
		border-radius: var(--ab-radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.btn.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--ab-color-primary-hover);
	}

	.btn.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}

	.btn.ghost:hover {
		background: var(--ab-color-surface-sunken);
	}
</style>
