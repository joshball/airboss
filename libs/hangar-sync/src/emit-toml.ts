/**
 * Emit the two TOML seed files from a Reference[] + Source[] snapshot.
 *
 * Thin wrapper over `@ab/aviation`'s deterministic codec. The codec
 * owns byte-identity + stable ordering; this module owns the dev-loop
 * disk write and the commit-file manifest.
 */

import type { Reference, Source } from '@ab/aviation';
import { encodeReferences, encodeSources } from '@ab/aviation';
import { GLOSSARY_TOML_PATH, SOURCES_TOML_PATH } from './paths';
import type { FileWrites } from './types';

/**
 * Serialize `refs` + `sources` into the two TOML bodies.
 * Pure, side-effect free -- the caller writes the returned strings.
 */
export function emitToml(refs: readonly Reference[], sources: readonly Source[]): FileWrites {
	return {
		[GLOSSARY_TOML_PATH]: encodeReferences(refs),
		[SOURCES_TOML_PATH]: encodeSources(sources),
	};
}
