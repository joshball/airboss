<script lang="ts">
import ConfirmAction from '../../src/components/ConfirmAction.svelte';

let {
	label = 'Delete',
	confirmLabel,
	cancelLabel,
	disabled = false,
	onConfirm,
	formAction,
}: {
	label?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	disabled?: boolean;
	onConfirm?: () => void;
	formAction?: string;
} = $props();
</script>

<ConfirmAction {label} {confirmLabel} {cancelLabel} {disabled} {onConfirm} {formAction} />
