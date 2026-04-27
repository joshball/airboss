<script lang="ts">
/**
 * Lesson body renderer for ADR 019 references.
 *
 * Consumes the payload produced by `loadLessonReferences` (server-side) and
 * substitutes tokens at render time. The substitution runs both server-side
 * (during SSR) and client-side (during hydration) over the same input, so
 * SSR/hydration agree without extra plumbing.
 *
 * Source of truth: ADR 019 §2.5 + Phase 4 WP.
 */

import { fromSerializable, type RenderMode, type SerializableResolvedMap, substituteTokens } from '@ab/sources';

let {
	body,
	resolved,
	mode = 'web' as RenderMode,
}: {
	body: string;
	resolved: SerializableResolvedMap;
	mode?: RenderMode;
} = $props();

const map = $derived(fromSerializable(resolved));
const html = $derived(substituteTokens(body, map, mode));
</script>

{@html html}
