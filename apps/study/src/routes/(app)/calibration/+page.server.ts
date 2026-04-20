import { requireAuth } from '@ab/auth';
import { getCalibration, getCalibrationPointCount, getCalibrationTrend } from '@ab/bc-study';
import { CALIBRATION_TREND_WINDOW_DAYS } from '@ab/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	// Point count first: cheap and drives the empty state. The full
	// calibration read still runs so the client has data when it switches
	// out of the empty state after the next review. Parallelizing the three
	// reads keeps the load time bounded by the slowest query.
	const [pointCount, calibration, trend] = await Promise.all([
		getCalibrationPointCount(user.id),
		getCalibration(user.id),
		getCalibrationTrend(user.id, CALIBRATION_TREND_WINDOW_DAYS),
	]);

	return { pointCount, calibration, trend };
};
