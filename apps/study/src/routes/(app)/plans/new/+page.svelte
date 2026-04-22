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

const seedCerts = $derived(new Set((form?.values?.certGoals ?? []) as string[]));
const seedFocus = $derived(new Set((form?.values?.focusDomains ?? []) as string[]));
const seedSkip = $derived(new Set((form?.values?.skipDomains ?? []) as string[]));
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
			<input
				type="text"
				name="title"
				placeholder="Default Plan"
				maxlength="200"
				value={form?.values?.title ?? ''}
			/>
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
						<input type="checkbox" name="certGoals" value={cert} checked={seedCerts.has(cert)} />
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
						<input type="checkbox" name="focusDomains" value={d} checked={seedFocus.has(d)} />
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
						<input type="checkbox" name="skipDomains" value={d} checked={seedSkip.has(d)} />
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
						<input type="radio" name="depthPreference" value={d} checked={d === 'working'} />
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
						<input type="radio" name="defaultMode" value={m} checked={m === 'mixed'} />
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
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.9375rem;
	}

	.wizard {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
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
		color: #0f172a;
	}

	.help {
		margin: 0;
		color: #64748b;
		font-size: 0.8125rem;
	}

	.help.subtle {
		color: #94a3b8;
		font-size: 0.75rem;
		font-style: italic;
	}

	input[type='text'] {
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		font-size: 0.9375rem;
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
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.choice:hover {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.choice input {
		accent-color: #2563eb;
	}

	.range-caps {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		color: #64748b;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.error {
		background: #fef2f2;
		color: #b91c1c;
		padding: 0.625rem 0.875rem;
		border-radius: 8px;
		border: 1px solid #fecaca;
		font-size: 0.875rem;
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
		justify-content: center;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn.primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn.ghost {
		background: transparent;
		color: #475569;
	}

	.btn.ghost:hover {
		background: #f1f5f9;
	}
</style>
