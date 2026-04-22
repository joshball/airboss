<script lang="ts">
import {
	CERT_LABELS,
	CERT_VALUES,
	type Cert,
	DEPTH_PREFERENCE_LABELS,
	DEPTH_PREFERENCE_VALUES,
	type DepthPreference,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	type Domain,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	PLAN_STATUSES,
	QUERY_PARAMS,
	ROUTES,
	SESSION_MODE_LABELS,
	SESSION_MODE_VALUES,
	type SessionMode,
} from '@ab/constants';
import { enhance } from '$app/forms';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const plan = $derived(data.plan);
const isActive = $derived(plan.status === PLAN_STATUSES.ACTIVE);

// `?created=1` lands here straight from /plans/new. Show a one-shot creation
// banner -- keep it dismissible so the user can clear it without navigating.
// See DESIGN_PRINCIPLES.md #7.
let createdBannerShown = $state(page.url.searchParams.get(QUERY_PARAMS.CREATED) === '1');

// Edit-success toast: auto-dismisses after ~3s so it never lingers into the
// next interaction. The effect reruns whenever `form` changes; on each
// successful update, restart the visibility window.
let editToastVisible = $state(false);

$effect(() => {
	const success = Boolean(form && 'success' in form && form.success);
	if (!success) return;
	editToastVisible = true;
	const timer = setTimeout(() => {
		editToastVisible = false;
	}, 3000);
	return () => clearTimeout(timer);
});

// svelte-ignore state_referenced_locally -- seeding initial slider from data; treat as independent thereafter
let sessionLength = $state<number>(data.plan.sessionLength);
let submitting = $state(false);

const certSet = $derived(new Set<string>(plan.certGoals));
const focusSet = $derived(new Set<string>(plan.focusDomains));
const skipSet = $derived(new Set<string>(plan.skipDomains));

const focusableDomains = $derived(DOMAIN_VALUES.filter((d) => !skipSet.has(d)));
const skippableDomains = $derived(DOMAIN_VALUES.filter((d) => !focusSet.has(d)));
</script>

<svelte:head>
	<title>{plan.title} -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>{plan.title}</h1>
			<p class="sub">
				<span class="badge" class:active={isActive}>{plan.status}</span>
				{#if isActive}<a class="link" href={ROUTES.SESSION_START}>Start a session</a>{/if}
			</p>
		</div>
		<nav class="quick">
			<a class="btn ghost" href={ROUTES.PLANS}>Back to plans</a>
		</nav>
	</header>

	{#if createdBannerShown}
		<div class="banner" role="status">
			<span>Plan saved. {isActive ? '' : 'Activate it to start a session.'}</span>
			{#if isActive}
				<a class="banner-action" href={ROUTES.SESSION_START}>Start a session</a>
			{/if}
			<button type="button" class="banner-dismiss" onclick={() => (createdBannerShown = false)} aria-label="Dismiss">
				×
			</button>
		</div>
	{/if}
	{#if editToastVisible}
		<div class="success" role="status">Plan updated.</div>
	{/if}
	{#if form && 'error' in form && form.error}
		<div class="error" role="alert">{form.error}</div>
	{/if}

	<form
		method="post"
		action="?/update"
		class="wizard"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<fieldset>
			<legend>Plan name</legend>
			<input type="text" name="title" value={plan.title} maxlength="200" />
		</fieldset>

		<fieldset>
			<legend>Certifications</legend>
			<p class="muted">Leave all unchecked for a cert-agnostic plan (general practice, no cert filter).</p>
			<div class="choice-row">
				{#each CERT_VALUES as cert (cert)}
					<label class="choice">
						<input type="checkbox" name="certGoals" value={cert} checked={certSet.has(cert)} />
						<span>{CERT_LABELS[cert as Cert]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Focus domains</legend>
			<div class="choice-grid">
				{#each focusableDomains as d (d)}
					<label class="choice">
						<input type="checkbox" name="focusDomains" value={d} checked={focusSet.has(d)} />
						<span>{DOMAIN_LABELS[d as Domain]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Skip domains</legend>
			<div class="choice-grid">
				{#each skippableDomains as d (d)}
					<label class="choice">
						<input type="checkbox" name="skipDomains" value={d} checked={skipSet.has(d)} />
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
						<input
							type="radio"
							name="depthPreference"
							value={d}
							checked={plan.depthPreference === d}
						/>
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
						<input type="radio" name="defaultMode" value={m} checked={plan.defaultMode === m} />
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
		</fieldset>

		<div class="actions">
			<button type="submit" class="btn primary" disabled={submitting}>
				{submitting ? 'Saving…' : 'Save changes'}
			</button>
		</div>
	</form>

	<article class="card skip-list">
		<h2>Skipped nodes</h2>
		{#if plan.skipNodes.length === 0}
			<p class="muted">You haven't skipped any individual nodes yet.</p>
		{:else}
			<ul class="pills">
				{#each plan.skipNodes as id (id)}
					<li>
						<span class="pill-label">{id}</span>
						<form method="post" action="?/removeSkipNode" use:enhance>
							<input type="hidden" name="nodeId" value={id} />
							<button type="submit" class="pill-btn">Reactivate</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</article>

	<article class="card danger-zone">
		<h2>Lifecycle</h2>
		<div class="row">
			{#if isActive}
				<form method="post" action="?/archive" use:enhance>
					<button type="submit" class="btn secondary">Archive plan</button>
				</form>
			{:else}
				<form method="post" action="?/activate" use:enhance>
					<button type="submit" class="btn primary">Make this plan active</button>
				</form>
			{/if}
		</div>
		<p class="muted">Activating this plan archives any other active plan for you.</p>
	</article>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-2xl);
		color: var(--ab-color-fg);
	}

	.sub {
		margin: 0.25rem 0 0;
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-body);
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.badge {
		display: inline-block;
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: var(--ab-radius-pill);
		background: var(--ab-color-border);
		color: var(--ab-color-fg-muted);
	}

	.badge.active {
		background: var(--ab-color-primary-hover);
		color: white;
	}

	.link {
		color: var(--ab-color-primary-hover);
		font-weight: 500;
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.wizard,
	.card {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
	}

	input[type='text'] {
		border: 1px solid var(--ab-color-border-strong);
		border-radius: var(--ab-radius-md);
		padding: 0.5rem 0.75rem;
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

	.choice input {
		accent-color: var(--ab-color-primary);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	.success {
		background: var(--ab-color-success-subtle);
		color: var(--ab-color-success-active);
		padding: 0.625rem 0.875rem;
		border-radius: var(--ab-radius-md);
		border: 1px solid var(--ab-color-success-subtle-border);
		font-size: var(--ab-font-size-sm);
	}

	.banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: var(--ab-color-primary-subtle);
		border: 1px solid var(--ab-color-primary-subtle-border);
		color: var(--ab-color-primary-active);
		padding: 0.625rem 0.875rem;
		border-radius: var(--ab-radius-md);
		font-size: var(--ab-font-size-sm);
	}

	.banner-action {
		margin-left: auto;
		color: var(--ab-color-primary-hover);
		font-weight: 600;
		text-decoration: none;
	}

	.banner-action:hover {
		text-decoration: underline;
	}

	.banner-dismiss {
		background: transparent;
		border: none;
		color: var(--ab-color-primary-active);
		font-size: var(--ab-font-size-2xl);
		line-height: 1;
		cursor: pointer;
		padding: 0 0.25rem;
	}

	.banner-dismiss:hover {
		color: var(--ab-color-primary-hover);
	}

	.error {
		background: var(--ab-color-danger-subtle);
		color: var(--ab-color-danger-hover);
		padding: 0.625rem 0.875rem;
		border-radius: var(--ab-radius-md);
		border: 1px solid var(--ab-color-danger-subtle-border);
		font-size: var(--ab-font-size-sm);
	}

	h2 {
		margin: 0;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.pills {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.pills li {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: var(--ab-color-surface-sunken);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-pill);
		padding: 0.25rem 0.5rem 0.25rem 0.75rem;
		font-size: var(--ab-font-size-sm);
	}

	.pill-btn {
		background: transparent;
		border: none;
		color: var(--ab-color-primary-hover);
		cursor: pointer;
		font-size: var(--ab-font-size-xs);
		padding: 0.25rem 0.5rem;
	}

	.pill-btn:hover {
		text-decoration: underline;
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	.muted {
		color: var(--ab-color-fg-faint);
		margin: 0;
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

	.btn.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ab-color-fg-muted);
	}

	.btn.ghost:hover {
		background: var(--ab-color-surface-sunken);
	}
</style>
