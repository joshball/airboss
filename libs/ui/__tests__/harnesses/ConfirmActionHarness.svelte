<script lang="ts">
import ConfirmAction from '../../src/components/ConfirmAction.svelte';

let {
	label = 'Delete',
	confirmLabel,
	cancelLabel,
	disabled = false,
	loading = false,
	loadingLabel,
	onConfirm,
	formAction,
}: {
	label?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	disabled?: boolean;
	loading?: boolean;
	loadingLabel?: string;
	onConfirm?: () => void;
	formAction?: string;
} = $props();
</script>

<ConfirmAction {label} {confirmLabel} {cancelLabel} {disabled} {loading} {loadingLabel} {onConfirm} {formAction} />
