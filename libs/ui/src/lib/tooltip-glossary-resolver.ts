/**
 * `Tooltip` reads short definitions from a glossary registry that lives in
 * `@ab/help/glossary`. To keep `libs/ui` a leaf in the dependency graph
 * (`@ab/help` already depends on `@ab/ui`), the registry edge is inverted:
 * the consuming app registers a resolver here at boot and `Tooltip`
 * consumes it through this module-local reference.
 *
 * Mirrors the pattern in `./info-tip-resolver.ts`. When no resolver has
 * been set (e.g. tests, apps without a glossary), callers can still pass
 * a literal `definition` prop and `Tooltip` falls back to that.
 */

/** What the resolver returns for a given key. `null` = unknown key. */
export interface TooltipGlossaryEntry {
	/** Display label. Title-cased. */
	term: string;
	/** One-line plain-English definition. */
	short: string;
}

/** Resolver contract: given a glossary key, return its term + short, or null. */
export type TooltipGlossaryResolver = (key: string) => TooltipGlossaryEntry | null;

let resolver: TooltipGlossaryResolver | null = null;

/**
 * Register the resolver used by `Tooltip` to resolve glossary `for=` props.
 * Calling twice replaces the previous resolver; pass `null` to clear (used
 * by tests).
 */
export function setTooltipGlossaryResolver(next: TooltipGlossaryResolver | null): void {
	resolver = next;
}

/** Read the current resolver. Returns `null` when none is registered. */
export function getTooltipGlossaryResolver(): TooltipGlossaryResolver | null {
	return resolver;
}
