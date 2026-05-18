/**
 * Control-component shared types.
 *
 * `.svelte` components cannot export plain types from their instance
 * `<script>` block, so the pan/zoom transform type lives here.
 */

/** A pan/zoom transform: a uniform scale + an (x, y) translation. */
export interface CanvasTransform {
	scale: number;
	x: number;
	y: number;
}
