/**
 * UI-layer constants shared across Svelte components. Keep these
 * framework-agnostic (plain numbers / strings); individual components can
 * apply them via inline `style:z-index={Z_INDEX.*}` style directives or
 * template expressions.
 */

/**
 * Z-index ladder. Centralises the stacking contract so component stacking
 * invariants live in one place rather than scattering `z-index: 50` / `100`
 * / `1000` literals across files. Tiers:
 *
 * - `BASE` (0): default document flow.
 * - `STICKY` (10): sticky table headers, sticky section headers, the
 *   top-of-page navigation progress bar (visually subordinate to modals).
 * - `SIDEBAR` (20): app sidebars / off-canvas panels.
 * - `DROPDOWN` (30): menus anchored to a trigger.
 * - `POPOVER` (50): floating popovers (e.g. InfoTip).
 * - `MODAL` (100): dialog scrims + panels.
 * - `COMMAND_PALETTE` (200): global cmd-K palette that must sit above
 *   modals opened from it.
 * - `TOAST` (300): transient notifications, above everything else.
 * - `TOP` (1000): emergency escape hatch for things that absolutely must
 *   win (generally avoid). The nav indicator used to live here; it has
 *   been moved to STICKY so modals can cover it.
 */
export const Z_INDEX = {
	BASE: 0,
	STICKY: 10,
	SIDEBAR: 20,
	DROPDOWN: 30,
	POPOVER: 50,
	MODAL: 100,
	COMMAND_PALETTE: 200,
	TOAST: 300,
	TOP: 1000,
} as const;

export type ZIndexTier = (typeof Z_INDEX)[keyof typeof Z_INDEX];
