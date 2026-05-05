import { requireAuth } from '@ab/auth';
import { getCalibrationPageData } from '@ab/bc-study';
import { CALIBRATION_TREND_WINDOW_DAYS } from '@ab/constants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	// Single user-scoped union over review + session_item_result drives all
	// three calibration-page outputs (point count, summary, per-day trend).
	// Previously this dispatched three separate reads in parallel; two of them
	// scanned the same per-user data.
	const { pointCount, calibration, trend } = await getCalibrationPageData(user.id, CALIBRATION_TREND_WINDOW_DAYS);

	return { pointCount, calibration, trend };
};
