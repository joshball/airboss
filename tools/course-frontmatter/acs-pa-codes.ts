/**
 * Canonical leaf codes for the FAA Private Pilot -- Airplane ACS
 * (FAA-S-ACS-6C). Used by the course-frontmatter validator so a lesson
 * may cite an ACS leaf the seed doesn't yet carry: the seed pipeline
 * (`course/syllabi/ppl-airplane-acs-6c/`) only ingests Area V today, but
 * the FAR-navigation course's regulatory content maps primarily to
 * Areas I, III, and IX.
 *
 * Codes follow the project's `PA.<area>.<task>.<triad><ordinal>`
 * shorthand:
 *
 *   PA.I.A.K1   = Private Airplane, Area I (Preflight Preparation),
 *                 Task A (Pilot Qualifications), element K1.
 *
 * Codes that exist in the seeded `study.syllabus_node` table are
 * verified by the validator against the DB; codes that don't yet exist
 * but are valid against this list pass the shape check and are
 * surfaced as authored against the FAA document directly.
 *
 * Source: FAA-S-ACS-6C, https://www.faa.gov/training_testing/testing/acs/ ,
 * Areas of Operation I through IX.
 */

export const PA_AREA_TITLES: Readonly<Record<string, string>> = {
	I: 'Preflight Preparation',
	II: 'Preflight Procedures',
	III: 'Airport and Seaplane Base Operations',
	IV: 'Takeoffs, Landings, and Go-Arounds',
	V: 'Performance Maneuvers and Ground Reference Maneuvers',
	VI: 'Navigation',
	VII: 'Slow Flight and Stalls',
	VIII: 'Basic Instrument Maneuvers',
	IX: 'Emergency Operations',
	X: 'Multiengine Operations', // ASEL has no X; AMEL does. Listed for shape.
	XI: 'Night Operations',
	XII: 'Postflight Procedures',
};

/**
 * Per-area, per-task title map. Tasks are addressed by `<area>.<task>`
 * (e.g. `'I.A'` -> `'Pilot Qualifications'`). The map covers the full
 * FAA-S-ACS-6C Areas I-IX plus Area XII (Postflight). This is the
 * authoritative shape; the validator accepts only `(area, task)` pairs
 * that appear in this map.
 */
export const PA_TASK_TITLES: Readonly<Record<string, string>> = {
	// Area I -- Preflight Preparation
	'I.A': 'Pilot Qualifications',
	'I.B': 'Airworthiness Requirements',
	'I.C': 'Weather Information',
	'I.D': 'Cross-Country Flight Planning',
	'I.E': 'National Airspace System',
	'I.F': 'Performance and Limitations',
	'I.G': 'Operation of Systems',
	'I.H': 'Human Factors',
	// Area II -- Preflight Procedures
	'II.A': 'Preflight Inspection',
	'II.B': 'Flight Deck Management',
	'II.C': 'Engine Starting',
	'II.D': 'Taxiing',
	'II.E': 'Before Takeoff Check',
	// Area III -- Airport and Seaplane Base Operations
	'III.A': 'Communications, Light Signals, and Runway Lighting Systems',
	'III.B': 'Traffic Patterns',
	// Area IV -- Takeoffs, Landings, Go-Arounds
	'IV.A': 'Normal Takeoff and Climb',
	'IV.B': 'Normal Approach and Landing',
	'IV.C': 'Soft-Field Takeoff and Climb',
	'IV.D': 'Soft-Field Approach and Landing',
	'IV.E': 'Short-Field Takeoff and Maximum Performance Climb',
	'IV.F': 'Short-Field Approach and Landing',
	'IV.M': 'Forward Slip to a Landing',
	'IV.N': 'Go-Around / Rejected Landing',
	// Area V -- Performance Maneuvers / Ground Reference (matches the seed)
	'V.A': 'Steep Turns',
	'V.B': 'Ground Reference Maneuvers',
	// Area VI -- Navigation
	'VI.A': 'Pilotage and Dead Reckoning',
	'VI.B': 'Navigation Systems and Radar Services',
	'VI.C': 'Diversion',
	'VI.D': 'Lost Procedures',
	// Area VII -- Slow Flight and Stalls
	'VII.A': 'Maneuvering During Slow Flight',
	'VII.B': 'Power-Off Stalls',
	'VII.C': 'Power-On Stalls',
	'VII.D': 'Spin Awareness',
	// Area VIII -- Basic Instrument Maneuvers
	'VIII.A': 'Straight-and-Level Flight',
	'VIII.B': 'Constant Airspeed Climbs',
	'VIII.C': 'Constant Airspeed Descents',
	'VIII.D': 'Turns to Headings',
	'VIII.E': 'Recovery from Unusual Flight Attitudes',
	'VIII.F': 'Radio Communications, Navigation Systems / Facilities, and Radar Services',
	// Area IX -- Emergency Operations
	'IX.A': 'Emergency Descent',
	'IX.B': 'Emergency Approach and Landing',
	'IX.C': 'Systems and Equipment Malfunctions',
	'IX.D': 'Emergency Equipment and Survival Gear',
	// Area XII -- Postflight Procedures
	'XII.A': 'After Landing, Parking, and Securing',
};

/** Closed set of ACS triad letters. */
export const PA_TRIADS = ['K', 'R', 'S'] as const;
export type PaTriad = (typeof PA_TRIADS)[number];

/**
 * Validate an authored `acs_leaves` code against the FAA-S-ACS-6C shape:
 *
 *   PA.<area>.<task>.<triad><ordinal>
 *
 * Returns null on a well-formed code; otherwise an error message.
 */
export function validateAcsLeafCode(code: string): string | null {
	const match = code.match(/^PA\.(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.([A-Z])\.([KRS])(\d+)$/);
	if (match === null) {
		return `not a PA ACS leaf code: ${code}`;
	}
	const area = match[1];
	const task = match[2];
	if (PA_TASK_TITLES[`${area}.${task}`] === undefined) {
		return `unknown PA task: ${area}.${task}`;
	}
	return null;
}
