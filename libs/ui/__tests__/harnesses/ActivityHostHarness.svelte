<script lang="ts">
import ActivityHost from '../../src/components/ActivityHost.svelte';

let { activityId }: { activityId: string } = $props();
</script>

<ActivityHost {activityId} />
