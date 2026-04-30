<script lang="ts">
import ConfirmDialog from '../../src/components/ConfirmDialog.svelte';

let {
	open = true,
	title,
	confirmLabel,
	cancelLabel,
	variant,
	dangerLevel,
	typedConfirmation,
	formAction,
	hiddenFields,
	onconfirm,
	oncancel = () => {},
	body = 'Are you sure?',
}: {
	open?: boolean;
	title?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: 'primary' | 'danger';
	dangerLevel?: 'caution' | 'danger';
	typedConfirmation?: { label: string; expected: string };
	formAction?: string;
	hiddenFields?: Record<string, string>;
	onconfirm?: () => void;
	oncancel?: () => void;
	body?: string;
} = $props();
</script>

<ConfirmDialog
	{open}
	{title}
	{confirmLabel}
	{cancelLabel}
	{variant}
	{dangerLevel}
	{typedConfirmation}
	{formAction}
	{hiddenFields}
	{onconfirm}
	{oncancel}
>
	<p data-testid="dialog-body">{body}</p>
</ConfirmDialog>
