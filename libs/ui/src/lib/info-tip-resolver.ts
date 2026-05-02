/**
 * `InfoTip` runs a dev-only authoring guard that warns when its `helpId`
 * doesn't resolve to a registered help page. The actual help registry lives
 * in `@ab/help`, which itself imports from `@ab/ui` (Drawer for PageHelp).
 * To avoid a circular dependency between `@ab/ui` and `@ab/help`, the
 * registry edge is inverted: apps register a resolver here from outside
 * `@ab/ui`, and `InfoTip` consumes it through this module-local reference.
 *
 * Apps wire the resolver alongside the rest of their help bootstrap (see
 * `apps/study/src/lib/help/register.ts`). When no resolver has been set
 * (e.g. tests, or apps that don't ship a help corpus), `InfoTip` simply
 * skips the dev warning -- it never breaks rendering or runtime behavior.
 *
 * The resolver returns `boolean` (does this id exist in the registry) on
 * purpose: `InfoTip` only needs the existence check, not the page body.
 * Keeping the contract narrow lets us swap registry implementations
 * without changing `@ab/ui`.
 */

/**
 * Resolver contract: given a help-page id, return `true` if the id exists
 * in the consuming app's help registry. `false` (or no registered
 * resolver) means the id wasn't found / can't be checked.
 */
export type InfoTipHelpResolver = (helpId: string) => boolean;

let resolver: InfoTipHelpResolver | null = null;

/**
 * Register the resolver used by `InfoTip` to verify `helpId` props at dev
 * time. Calling this twice replaces the previous resolver; pass `null` to
 * clear (used by tests).
 */
export function setInfoTipHelpResolver(next: InfoTipHelpResolver | null): void {
	resolver = next;
}

/**
 * Read the current resolver. `InfoTip` is the only intended caller. Returns
 * `null` when no resolver is registered.
 */
export function getInfoTipHelpResolver(): InfoTipHelpResolver | null {
	return resolver;
}
