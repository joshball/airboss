import { ulid } from 'ulidx';

export function createId(prefix: string): string {
	return `${prefix}_${ulid()}`;
}
