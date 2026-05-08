/**
 * Plugin registration barrel.
 *
 * Imported by the server barrel on cold start. Each plugin's module
 * registers itself as a side effect of its `import` line; the runtime
 * registry (in `../plugin.ts`) ends up keyed by `kind`.
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

import { registerPlugin } from '../plugin';
import { handbookCaptionOrphanPlugin } from './handbook-caption-orphan';
import { handbookImageOrphanPlugin } from './handbook-image-orphan';

let registered = false;

/**
 * Idempotent boot. Registers every shipping plugin on first call;
 * subsequent calls are no-ops. Tests that need a fresh registry call
 * `resetPluginRegistry` before invoking `registerAllPlugins` again.
 */
export function registerAllPlugins(): void {
	if (registered) return;
	registerPlugin(handbookCaptionOrphanPlugin);
	registerPlugin(handbookImageOrphanPlugin);
	registered = true;
}

// Side-effect register on first import. Server cold-start path.
registerAllPlugins();
