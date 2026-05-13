/**
 * Declarative command registry contracts (Phase 4 of the command palette WP).
 *
 * Apps declare their commands (New plan, Open audit log, Start sim, ...) and
 * register them on layout mount. The command palette in `command` mode
 * (Cmd+Shift+P) renders matching commands from the singleton `paletteCommands`
 * registry; in `search` mode, commands also appear as a lower-priority bucket
 * via the regular search pipeline.
 *
 * Types live in a separate file so `.svelte` consumers that only need the
 * interface can `import type` without loading the registry module (the
 * registry holds module-level state which we never want to evaluate twice
 * across HMR boundaries).
 *
 * Source of truth: `docs/work-packages/command-palette/design.md`
 * ("PaletteCommand").
 */

import type { AppId } from '@ab/constants';
import type { ParsedQuery } from '../schema/help-registry';

/** Command kind. Mirrors the `cmd.*` slice of `SearchResultType`. */
export type PaletteCommandType = 'cmd.action' | 'cmd.goto';

/**
 * A user-invocable command surfaced by the palette in `command` mode (and
 * as a lower-priority bucket in `search` mode).
 *
 * Two flavours:
 *   - `cmd.action`: runs the handler in place (no navigation). Examples:
 *     "Pin to today", "Invite user", "Toggle dark mode".
 *   - `cmd.goto`: navigates somewhere. Handler typically calls `goto(route)`.
 *     Examples: "Go to today's reps", "Open audit log".
 *
 * `surface` is the registering app's `AppId` -- drives the host-surface
 * boost in the ranker (the active app's commands sort above commands from
 * other apps).
 */
export interface PaletteCommand {
	/** Stable id. Convention: `<surface>.<short-action>` (e.g. `study.new-plan`). */
	readonly id: string;
	readonly type: PaletteCommandType;
	/** Human-readable label rendered as the primary row text. */
	readonly label: string;
	/** Optional secondary text (e.g. a keyboard shortcut hint or route). */
	readonly subtitle?: string;
	/**
	 * Extra search keywords beyond the label. Lowercase tokens, matched via
	 * substring against the parsed query free-text.
	 */
	readonly keywords: readonly string[];
	/** Which app registered this command. Drives the host-surface boost. */
	readonly surface: AppId;
	/** Invoked when the user activates the command. */
	readonly handler: () => void | Promise<void>;
	/** Optional icon glyph (rendered to the left of the label). */
	readonly icon?: string;
}

/**
 * Singleton registry contract. The implementation in `./registry.ts` holds an
 * in-memory `Map<string, PaletteCommand>`; consumers register on layout mount
 * and unregister on destroy.
 *
 * `search()` filters by free-text + keyword match (case-insensitive), then
 * applies a host-surface boost: commands with `command.surface === hostSurface`
 * sort above commands from other surfaces. Within a surface, sort is alpha
 * by label for stable ordering.
 */
export interface PaletteCommandRegistry {
	/** Register a command. Throws on duplicate `id`. */
	register(cmd: PaletteCommand): void;
	/** Unregister by id. No-op when the id is not present. */
	unregister(id: string): void;
	/** List every registered command in insertion order. */
	list(): readonly PaletteCommand[];
	/**
	 * Search registered commands against a parsed query, applying the
	 * host-surface boost. Returns matches in display order: host-surface
	 * commands first (alpha by label), then commands from other surfaces
	 * (alpha by label).
	 */
	search(parsed: ParsedQuery, hostSurface: AppId): readonly PaletteCommand[];
	/** Test affordance: wipe the registry. Never call from production code. */
	clear(): void;
}
