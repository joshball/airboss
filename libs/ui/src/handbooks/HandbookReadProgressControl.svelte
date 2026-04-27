<script lang="ts">
import { HANDBOOK_READ_STATUSES, type HandbookReadStatus } from '@ab/constants';

let {
	status,
	comprehended,
	formAction,
}: {
	status: HandbookReadStatus;
	comprehended: boolean;
	formAction: string;
} = $props();

const STATUSES: HandbookReadStatus[] = [
	HANDBOOK_READ_STATUSES.UNREAD,
	HANDBOOK_READ_STATUSES.READING,
	HANDBOOK_READ_STATUSES.READ,
];
const LABELS: Record<HandbookReadStatus, string> = {
	[HANDBOOK_READ_STATUSES.UNREAD]: 'Unread',
	[HANDBOOK_READ_STATUSES.READING]: 'Reading',
	[HANDBOOK_READ_STATUSES.READ]: 'Read',
};

const comprehendedDisabled = $derived(status === HANDBOOK_READ_STATUSES.UNREAD);
</script>

<div class="read-progress">
	<form method="POST" action={`${formAction}set-status`} class="status-form" data-sveltekit-keepfocus>
		<fieldset class="status">
			<legend>Reading progress</legend>
			<div class="segments" role="radiogroup" aria-label="Reading progress">
				{#each STATUSES as s (s)}
					<label class="segment" class:active={status === s}>
						<input
							type="radio"
							name="status"
							value={s}
							checked={status === s}
							onchange={(e) => {
								const form = e.currentTarget.form;
								if (form) form.requestSubmit();
							}}
						/>
						<span>{LABELS[s]}</span>
					</label>
				{/each}
			</div>
		</fieldset>
	</form>

	<form method="POST" action={`${formAction}set-comprehended`} class="comprehended-form" data-sveltekit-keepfocus>
		<label class="comprehended" class:disabled={comprehendedDisabled}>
			<input
				type="checkbox"
				name="comprehended"
				value="true"
				checked={comprehended}
				disabled={comprehendedDisabled}
				onchange={(e) => {
					const form = e.currentTarget.form;
					if (form) form.requestSubmit();
				}}
			/>
			<span>Read but didn't get it</span>
		</label>
	</form>

	<form method="POST" action={`${formAction}mark-reread`} class="reread-form">
		<button type="submit" class="reread-btn">Re-read this section</button>
	</form>
</div>

<style>
	.read-progress {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin-top: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}
	.status {
		border: none;
		padding: 0;
		margin: 0;
	}
	.status legend {
		color: var(--ink-muted);
		margin-bottom: var(--space-xs);
	}
	.segments {
		display: flex;
		gap: var(--space-2xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		padding: var(--space-2xs);
	}
	.segment {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--ink-muted);
		transition:
			background var(--motion-fast) ease,
			color var(--motion-fast) ease;
	}
	.segment.active {
		background: var(--action-default);
		color: var(--action-default-ink);
		font-weight: 500;
	}
	.segment input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.comprehended {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		cursor: pointer;
	}
	.comprehended.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.reread-btn {
		align-self: flex-start;
		background: none;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		color: var(--ink-muted);
		cursor: pointer;
	}
	.reread-btn:hover {
		border-color: var(--action-default-edge);
		color: var(--ink-body);
	}
</style>
