import { ulid } from 'ulidx';

/**
 * Generic prefixed ULID generator.
 * Produces lowercase `${prefix}_${ulid}` strings.
 */
export function createId(prefix: string): string {
	return `${prefix}_${ulid().toLowerCase()}`;
}

// Identity layer (better-auth): plain ULID, no prefix -- better-auth manages its own tables
export const generateAuthId = (): string => ulid().toLowerCase();

// Study BC
export const generateCardId = (): string => createId('crd');
export const generateReviewId = (): string => createId('rev');
