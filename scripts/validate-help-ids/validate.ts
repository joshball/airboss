/**
 * Validate a flat list of extracted help-id references against the set of
 * registered help-page ids. Pure, synchronous, no I/O. Caller owns file
 * discovery and registry loading so this function is trivially testable.
 */

import type { HelpIdRef } from './extract';

/** A single unregistered-id finding. */
export interface HelpIdValidationError {
	readonly propName: string;
	readonly helpId: string;
	readonly filePath: string;
	readonly line: number;
}

/** Result of a validation pass. */
export interface HelpIdValidationResult {
	/** Unregistered ids. Empty array means the gate passes. */
	readonly errors: readonly HelpIdValidationError[];
	/** Count of dynamic references skipped (for visibility in the report). */
	readonly dynamicSkipped: number;
	/** Count of static references checked. */
	readonly staticChecked: number;
}

export function validateHelpIds(
	refs: readonly HelpIdRef[],
	registeredIds: ReadonlySet<string>,
): HelpIdValidationResult {
	const errors: HelpIdValidationError[] = [];
	let dynamicSkipped = 0;
	let staticChecked = 0;
	for (const ref of refs) {
		if (ref.kind === 'dynamic') {
			dynamicSkipped += 1;
			continue;
		}
		staticChecked += 1;
		if (registeredIds.has(ref.helpId)) continue;
		errors.push({
			propName: ref.propName,
			helpId: ref.helpId,
			filePath: ref.filePath,
			line: ref.line,
		});
	}
	return { errors, dynamicSkipped, staticChecked };
}
