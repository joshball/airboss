/**
 * Type-only shapes for the KnowledgeNodePicker (course-reader-and-editor
 * WP, Phase 7). Lifted out of the section editor's +page.server.ts so the
 * `.svelte` picker can import the type without dragging the loader's
 * server-side imports into the browser bundle.
 */

export interface PickerNode {
	id: string;
	title: string;
	domain: string;
	lifecycle: string | null;
}
