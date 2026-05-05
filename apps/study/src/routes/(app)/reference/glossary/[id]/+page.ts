import { getReferenceById } from '@ab/aviation';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const reference = getReferenceById(params.id);
	if (!reference) {
		error(404, `Reference not found: ${params.id}`);
	}

	// Resolve related ids to their full reference objects (or omit the ones
	// that don't exist -- the symmetry gate should have caught that, but be
	// defensive at render time).
	const related = reference.related
		.map((id) => getReferenceById(id))
		.filter((ref): ref is NonNullable<typeof ref> => ref !== undefined);

	return { reference, related };
};
