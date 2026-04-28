import type { PageLoad } from './$types';

// PFD route. The layout server load already exposes `selectedAircraftId`
// from the aircraft cookie; this page just inherits that data.
export const load: PageLoad = () => {
	return {};
};
