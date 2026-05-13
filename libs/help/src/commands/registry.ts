/**
 * In-memory `PaletteCommandRegistry` implementation -- Phase 4.
 *
 * Holds the singleton command map. Apps register their declarative commands
 * (study/sim/hangar/flightbag/avionics) on layout mount; the palette consumes
 * the registry in `command` mode and as a lower-priority bucket in `search`
 * mode.
 *
 * Browser-safe by construction: pure in-memory state + functions. No I/O,
 * no DB, no `node:*`. Safe to import from `.svelte` files via the runtime
 * barrel.
 */

import type { AppId } from '@ab/constants';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteCommand, PaletteCommandRegistry } from './types';

function createRegistry(): PaletteCommandRegistry {
	// Insertion-ordered map; `list()` returns in this order.
	const byId = new Map<string, PaletteCommand>();

	function register(cmd: PaletteCommand): void {
		if (byId.has(cmd.id)) {
			throw new Error(`PaletteCommandRegistry: duplicate id "${cmd.id}"`);
		}
		byId.set(cmd.id, cmd);
	}

	function unregister(id: string): void {
		byId.delete(id);
	}

	function list(): readonly PaletteCommand[] {
		return [...byId.values()];
	}

	function search(parsed: ParsedQuery, hostSurface: AppId): readonly PaletteCommand[] {
		const needle = parsed.freeText.trim().toLowerCase();
		const matches: PaletteCommand[] = [];
		for (const cmd of byId.values()) {
			if (commandMatches(cmd, needle)) matches.push(cmd);
		}
		matches.sort((a, b) => {
			const aHost = a.surface === hostSurface ? 0 : 1;
			const bHost = b.surface === hostSurface ? 0 : 1;
			if (aHost !== bHost) return aHost - bHost;
			return a.label.localeCompare(b.label);
		});
		return matches;
	}

	function clear(): void {
		byId.clear();
	}

	return { register, unregister, list, search, clear };
}

/**
 * Substring match across label + keywords. Empty needle matches every
 * command (mirrors the existing `search` mode behaviour of "no query =>
 * show everything in the eligible bucket").
 */
function commandMatches(cmd: PaletteCommand, needle: string): boolean {
	if (needle.length === 0) return true;
	if (cmd.label.toLowerCase().includes(needle)) return true;
	for (const kw of cmd.keywords) {
		if (kw.toLowerCase().includes(needle)) return true;
	}
	return false;
}

/**
 * Singleton instance. Apps mount their commands against this one registry
 * during layout setup. Tests can `clear()` it between cases.
 */
export const paletteCommands: PaletteCommandRegistry = createRegistry();
