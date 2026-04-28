/**
 * Credential and syllabus vocabulary -- ADR 016 phases 1-6.
 *
 * Credentials model the FAA-ish DAG of pilot certs / instructor certs /
 * ratings / endorsements. A `credential` row is one node in that graph;
 * `credential_prereq` rows are the edges. `credential_syllabus` links a
 * credential to one or more syllabi (an ACS / PTS / school / personal
 * track), with a `primacy` flag picking the primary syllabus per credential.
 *
 * Syllabi model the authored tree (areas / tasks / elements for ACS, or
 * generic chapters / sections / subsections for non-ACS), with leaves
 * pointing at knowledge graph nodes via `syllabus_node_link`. The K/R/S
 * triad is the FAA's element categorization on ACS / PTS leaves.
 *
 * See `docs/work-packages/cert-syllabus-and-goal-composer/spec.md` and
 * `docs/decisions/016-cert-syllabus-goal-model/decision.md`.
 */

/**
 * `credential.kind` values. Closed enum mirrored by a DB CHECK.
 *
 * - `pilot-cert`: airman certificate (private / commercial / atp / etc.).
 * - `instructor-cert`: CFI / CFII / MEI / etc.
 * - `category-rating`: airplane category, rotorcraft category, etc.
 * - `class-rating`: single-engine-land, multi-engine-sea, etc.
 * - `endorsement`: 14 CFR 61.31 endorsements (complex, high-perf, tailwheel,
 *   high-altitude, spin, glass-cockpit). One row per endorsement.
 * - `student`: the placeholder credential learners hold before any rating.
 *   Useful as a prereq target.
 */
export const CREDENTIAL_KINDS = {
	PILOT_CERT: 'pilot-cert',
	INSTRUCTOR_CERT: 'instructor-cert',
	CATEGORY_RATING: 'category-rating',
	CLASS_RATING: 'class-rating',
	ENDORSEMENT: 'endorsement',
	STUDENT: 'student',
} as const;

export type CredentialKind = (typeof CREDENTIAL_KINDS)[keyof typeof CREDENTIAL_KINDS];

export const CREDENTIAL_KIND_VALUES: readonly CredentialKind[] = Object.values(CREDENTIAL_KINDS);

export const CREDENTIAL_KIND_LABELS: Record<CredentialKind, string> = {
	[CREDENTIAL_KINDS.PILOT_CERT]: 'Pilot certificate',
	[CREDENTIAL_KINDS.INSTRUCTOR_CERT]: 'Instructor certificate',
	[CREDENTIAL_KINDS.CATEGORY_RATING]: 'Category rating',
	[CREDENTIAL_KINDS.CLASS_RATING]: 'Class rating',
	[CREDENTIAL_KINDS.ENDORSEMENT]: 'Endorsement',
	[CREDENTIAL_KINDS.STUDENT]: 'Student',
};

/**
 * `credential.category`. Aviation category. Closed enum.
 *
 * Category defines the aircraft family: airplane, rotorcraft, glider,
 * lighter-than-air, powered-lift, weight-shift-control, powered-parachute.
 * Most credentials user-zero pursues are `airplane`; the enum is closed so
 * a future rotorcraft addition needs an explicit extension.
 */
export const CREDENTIAL_CATEGORIES = {
	AIRPLANE: 'airplane',
	ROTORCRAFT: 'rotorcraft',
	GLIDER: 'glider',
	LIGHTER_THAN_AIR: 'lighter-than-air',
	POWERED_LIFT: 'powered-lift',
	WEIGHT_SHIFT_CONTROL: 'weight-shift-control',
	POWERED_PARACHUTE: 'powered-parachute',
	NONE: 'none',
} as const;

export type CredentialCategory = (typeof CREDENTIAL_CATEGORIES)[keyof typeof CREDENTIAL_CATEGORIES];

export const CREDENTIAL_CATEGORY_VALUES: readonly CredentialCategory[] = Object.values(CREDENTIAL_CATEGORIES);

export const CREDENTIAL_CATEGORY_LABELS: Record<CredentialCategory, string> = {
	[CREDENTIAL_CATEGORIES.AIRPLANE]: 'Airplane',
	[CREDENTIAL_CATEGORIES.ROTORCRAFT]: 'Rotorcraft',
	[CREDENTIAL_CATEGORIES.GLIDER]: 'Glider',
	[CREDENTIAL_CATEGORIES.LIGHTER_THAN_AIR]: 'Lighter than air',
	[CREDENTIAL_CATEGORIES.POWERED_LIFT]: 'Powered lift',
	[CREDENTIAL_CATEGORIES.WEIGHT_SHIFT_CONTROL]: 'Weight-shift control',
	[CREDENTIAL_CATEGORIES.POWERED_PARACHUTE]: 'Powered parachute',
	[CREDENTIAL_CATEGORIES.NONE]: 'None',
};

/**
 * `credential.class` values. Closed enum mirrored by a DB CHECK; nullable
 * (some credentials -- a pilot cert without an associated class rating, an
 * endorsement -- have no class).
 */
export const CREDENTIAL_CLASSES = {
	SINGLE_ENGINE_LAND: 'single-engine-land',
	SINGLE_ENGINE_SEA: 'single-engine-sea',
	MULTI_ENGINE_LAND: 'multi-engine-land',
	MULTI_ENGINE_SEA: 'multi-engine-sea',
	HELICOPTER: 'helicopter',
	GYROPLANE: 'gyroplane',
	GLIDER: 'glider',
	AIRSHIP: 'airship',
	BALLOON: 'balloon',
} as const;

export type CredentialClass = (typeof CREDENTIAL_CLASSES)[keyof typeof CREDENTIAL_CLASSES];

export const CREDENTIAL_CLASS_VALUES: readonly CredentialClass[] = Object.values(CREDENTIAL_CLASSES);

export const CREDENTIAL_CLASS_LABELS: Record<CredentialClass, string> = {
	[CREDENTIAL_CLASSES.SINGLE_ENGINE_LAND]: 'Single-engine land',
	[CREDENTIAL_CLASSES.SINGLE_ENGINE_SEA]: 'Single-engine sea',
	[CREDENTIAL_CLASSES.MULTI_ENGINE_LAND]: 'Multi-engine land',
	[CREDENTIAL_CLASSES.MULTI_ENGINE_SEA]: 'Multi-engine sea',
	[CREDENTIAL_CLASSES.HELICOPTER]: 'Helicopter',
	[CREDENTIAL_CLASSES.GYROPLANE]: 'Gyroplane',
	[CREDENTIAL_CLASSES.GLIDER]: 'Glider',
	[CREDENTIAL_CLASSES.AIRSHIP]: 'Airship',
	[CREDENTIAL_CLASSES.BALLOON]: 'Balloon',
};

/**
 * `credential.status` values. Closed enum.
 *
 * - `active`: published, learners can target this credential.
 * - `draft`: authored but not yet published; not selectable.
 * - `archived`: superseded credential, retained for historical goals.
 */
export const CREDENTIAL_STATUSES = {
	ACTIVE: 'active',
	DRAFT: 'draft',
	ARCHIVED: 'archived',
} as const;

export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[keyof typeof CREDENTIAL_STATUSES];

export const CREDENTIAL_STATUS_VALUES: readonly CredentialStatus[] = Object.values(CREDENTIAL_STATUSES);

/**
 * `credential_prereq.kind` values. Closed enum.
 *
 * - `required`: FAA-required prereq (you must hold private before commercial).
 * - `recommended`: practice recommendation, not a CFR requirement.
 * - `experience`: experience-based prereq, not a credential check.
 */
export const CREDENTIAL_PREREQ_KINDS = {
	REQUIRED: 'required',
	RECOMMENDED: 'recommended',
	EXPERIENCE: 'experience',
} as const;

export type CredentialPrereqKind = (typeof CREDENTIAL_PREREQ_KINDS)[keyof typeof CREDENTIAL_PREREQ_KINDS];

export const CREDENTIAL_PREREQ_KIND_VALUES: readonly CredentialPrereqKind[] = Object.values(CREDENTIAL_PREREQ_KINDS);

/**
 * `syllabus.kind` values. Closed enum.
 *
 * - `acs`: FAA Airman Certification Standard.
 * - `pts`: FAA Practical Test Standards (CFI / CFII still ship as PTS, not
 *   yet ACS as of mid-2026).
 * - `school`: partner-school syllabus (none today; reserved).
 * - `personal`: per-user authored syllabus, owned by a goal (not seeded).
 */
export const SYLLABUS_KINDS = {
	ACS: 'acs',
	PTS: 'pts',
	SCHOOL: 'school',
	PERSONAL: 'personal',
} as const;

export type SyllabusKind = (typeof SYLLABUS_KINDS)[keyof typeof SYLLABUS_KINDS];

export const SYLLABUS_KIND_VALUES: readonly SyllabusKind[] = Object.values(SYLLABUS_KINDS);

export const SYLLABUS_KIND_LABELS: Record<SyllabusKind, string> = {
	[SYLLABUS_KINDS.ACS]: 'ACS',
	[SYLLABUS_KINDS.PTS]: 'PTS',
	[SYLLABUS_KINDS.SCHOOL]: 'School',
	[SYLLABUS_KINDS.PERSONAL]: 'Personal',
};

/**
 * `syllabus.status` values. Closed enum.
 *
 * - `active`: visible to learners, used by lenses, included in relevance
 *   cache rebuild.
 * - `draft`: authored but not yet published.
 * - `superseded`: a newer edition replaced this one. Retained for goals
 *   that pinned the older edition.
 */
export const SYLLABUS_STATUSES = {
	ACTIVE: 'active',
	DRAFT: 'draft',
	SUPERSEDED: 'superseded',
} as const;

export type SyllabusStatus = (typeof SYLLABUS_STATUSES)[keyof typeof SYLLABUS_STATUSES];

export const SYLLABUS_STATUS_VALUES: readonly SyllabusStatus[] = Object.values(SYLLABUS_STATUSES);

/**
 * `syllabus_node.level` values. Closed enum mirrored by a DB CHECK.
 *
 * - `area`: top of an ACS / PTS tree (Roman-numeral codes: I, II, ... V).
 * - `task`: child of an area (letter codes: A, B, C).
 * - `element`: leaf of an ACS / PTS tree (K1, R1, S1).
 * - `chapter` / `section` / `subsection`: generic non-ACS levels.
 */
export const SYLLABUS_NODE_LEVELS = {
	AREA: 'area',
	TASK: 'task',
	ELEMENT: 'element',
	CHAPTER: 'chapter',
	SECTION: 'section',
	SUBSECTION: 'subsection',
} as const;

export type SyllabusNodeLevel = (typeof SYLLABUS_NODE_LEVELS)[keyof typeof SYLLABUS_NODE_LEVELS];

export const SYLLABUS_NODE_LEVEL_VALUES: readonly SyllabusNodeLevel[] = Object.values(SYLLABUS_NODE_LEVELS);

export const SYLLABUS_NODE_LEVEL_LABELS: Record<SyllabusNodeLevel, string> = {
	[SYLLABUS_NODE_LEVELS.AREA]: 'Area',
	[SYLLABUS_NODE_LEVELS.TASK]: 'Task',
	[SYLLABUS_NODE_LEVELS.ELEMENT]: 'Element',
	[SYLLABUS_NODE_LEVELS.CHAPTER]: 'Chapter',
	[SYLLABUS_NODE_LEVELS.SECTION]: 'Section',
	[SYLLABUS_NODE_LEVELS.SUBSECTION]: 'Subsection',
};

/**
 * `credential_syllabus.primacy` values. A credential has at most one
 * `primary` syllabus (enforced via partial UNIQUE in DB) and any number of
 * `supplemental` syllabi.
 */
export const SYLLABUS_PRIMACY = {
	PRIMARY: 'primary',
	SUPPLEMENTAL: 'supplemental',
} as const;

export type SyllabusPrimacy = (typeof SYLLABUS_PRIMACY)[keyof typeof SYLLABUS_PRIMACY];

export const SYLLABUS_PRIMACY_VALUES: readonly SyllabusPrimacy[] = Object.values(SYLLABUS_PRIMACY);

/**
 * ACS K/R/S triad. Closed enum on `syllabus_node.triad`. Required for
 * `level='element'` rows on ACS / PTS syllabi; null on internal nodes and
 * on non-ACS leaves.
 *
 * - `knowledge`: factual / conceptual element (K1, K2, ...).
 * - `risk_management`: risk-identification element (R1, R2, ...).
 * - `skill`: skill / demonstration element (S1, S2, ...).
 */
export const ACS_TRIAD = {
	KNOWLEDGE: 'knowledge',
	RISK_MANAGEMENT: 'risk_management',
	SKILL: 'skill',
} as const;

export type ACSTriad = (typeof ACS_TRIAD)[keyof typeof ACS_TRIAD];

export const ACS_TRIAD_VALUES: readonly ACSTriad[] = Object.values(ACS_TRIAD);

export const ACS_TRIAD_LABELS: Record<ACSTriad, string> = {
	[ACS_TRIAD.KNOWLEDGE]: 'Knowledge',
	[ACS_TRIAD.RISK_MANAGEMENT]: 'Risk management',
	[ACS_TRIAD.SKILL]: 'Skill',
};

/**
 * Lens framework kinds. Closed enum, extensible.
 *
 * v1 ships `acs` and `domain`. The follow-on lenses (`handbook`, `weakness`,
 * `bloom`, `phase-of-flight`, `custom`) are tracked in ADR 016 phase 8.
 */
export const LENS_KINDS = {
	ACS: 'acs',
	DOMAIN: 'domain',
	HANDBOOK: 'handbook',
	WEAKNESS: 'weakness',
	BLOOM: 'bloom',
	PHASE_OF_FLIGHT: 'phase-of-flight',
	CUSTOM: 'custom',
} as const;

export type LensKind = (typeof LENS_KINDS)[keyof typeof LENS_KINDS];

export const LENS_KIND_VALUES: readonly LensKind[] = Object.values(LENS_KINDS);

export const LENS_KIND_LABELS: Record<LensKind, string> = {
	[LENS_KINDS.ACS]: 'ACS',
	[LENS_KINDS.DOMAIN]: 'Domain',
	[LENS_KINDS.HANDBOOK]: 'Handbook',
	[LENS_KINDS.WEAKNESS]: 'Weakness',
	[LENS_KINDS.BLOOM]: 'Bloom',
	[LENS_KINDS.PHASE_OF_FLIGHT]: 'Phase of flight',
	[LENS_KINDS.CUSTOM]: 'Custom',
};

/**
 * Weakness severity buckets for the weakness lens.
 *
 * - `severe`: top priority -- highest weakness score; surface first.
 * - `moderate`: secondary -- material gap, not critical.
 * - `mild`: backlog -- worth addressing eventually.
 *
 * Scores below the `mild` threshold are not surfaced. Threshold values
 * live in `WEAKNESS_SEVERITY_THRESHOLDS`.
 */
export const WEAKNESS_SEVERITY = {
	SEVERE: 'severe',
	MODERATE: 'moderate',
	MILD: 'mild',
} as const;

export type WeaknessSeverity = (typeof WEAKNESS_SEVERITY)[keyof typeof WEAKNESS_SEVERITY];

export const WEAKNESS_SEVERITY_VALUES: readonly WeaknessSeverity[] = Object.values(WEAKNESS_SEVERITY);

export const WEAKNESS_SEVERITY_LABELS: Record<WeaknessSeverity, string> = {
	[WEAKNESS_SEVERITY.SEVERE]: 'Severe',
	[WEAKNESS_SEVERITY.MODERATE]: 'Moderate',
	[WEAKNESS_SEVERITY.MILD]: 'Mild',
};

/**
 * Score cutoffs for severity buckets. Score is in [0, 1] (clamped).
 * Default semantics: severe >= 0.70, moderate >= 0.40, mild >= 0.15;
 * below 0.15 is not surfaced.
 */
export const WEAKNESS_SEVERITY_THRESHOLDS: Record<WeaknessSeverity, number> = {
	[WEAKNESS_SEVERITY.SEVERE]: 0.7,
	[WEAKNESS_SEVERITY.MODERATE]: 0.4,
	[WEAKNESS_SEVERITY.MILD]: 0.15,
};

/** Top-N caps for the weakness lens index page (per bucket) and bucket page. */
export const WEAKNESS_INDEX_LIMIT = 10;
export const WEAKNESS_BUCKET_LIMIT = 100;

/**
 * `goal.status` values. Closed enum mirrored by a DB CHECK.
 *
 * - `active`: in pursuit; the engine will target nodes inside this goal's
 *   union when the goal is also `is_primary=true`.
 * - `paused`: not actively pursued, retained for restart.
 * - `completed`: reached; archived state.
 * - `abandoned`: abandoned; archived state.
 */
export const GOAL_STATUSES = {
	ACTIVE: 'active',
	PAUSED: 'paused',
	COMPLETED: 'completed',
	ABANDONED: 'abandoned',
} as const;

export type GoalStatus = (typeof GOAL_STATUSES)[keyof typeof GOAL_STATUSES];

export const GOAL_STATUS_VALUES: readonly GoalStatus[] = Object.values(GOAL_STATUSES);

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
	[GOAL_STATUSES.ACTIVE]: 'Active',
	[GOAL_STATUSES.PAUSED]: 'Paused',
	[GOAL_STATUSES.COMPLETED]: 'Completed',
	[GOAL_STATUSES.ABANDONED]: 'Abandoned',
};

/** Bounds on `goal_syllabus.weight`. Above the upper bound is rejected at
 * validation time; the user almost certainly wants to archive the others
 * if they want a 10:1 contrast. */
export const GOAL_SYLLABUS_WEIGHT_MIN = 0;
export const GOAL_SYLLABUS_WEIGHT_MAX = 10;

/** Default `syllabus_node_link.weight` -- a leaf fully exercises its linked
 * knowledge node unless the syllabus author explicitly downweights it. */
export const SYLLABUS_NODE_LINK_DEFAULT_WEIGHT = 1.0;

/** ID prefixes -- composed via `@ab/utils createId`. */
export const CREDENTIAL_ID_PREFIX = 'cred';
export const SYLLABUS_ID_PREFIX = 'syl';
export const SYLLABUS_NODE_ID_PREFIX = 'sln';
export const SYLLABUS_NODE_LINK_ID_PREFIX = 'snl';
export const GOAL_ID_PREFIX = 'goal';

/**
 * Airplane class scoping for `syllabus_node.classes`. Closed enum mirrored by
 * a DB CHECK over the JSONB array values.
 *
 * Reality: the FAA publishes one ACS per cert+category (e.g. PPL Airplane is a
 * single ACS-6C document covering ASEL + AMEL; CFI Airplane ACS-25 covers all
 * four classes ASEL/AMEL/ASES/AMES). Class scope lives on individual tasks,
 * parsed from FAA's parenthetical class tags (e.g.
 * `Task A. Maneuvering with One Engine Inoperative (AMEL, AMES)`).
 *
 * `syllabus_node.classes` is NULL for class-agnostic rows (most knowledge and
 * risk-management elements; areas / tasks that apply to every class) and is a
 * non-empty array of these slugs for class-restricted rows. The lens framework
 * filters by class when a goal targets a class-specific credential.
 *
 * - `asel`: airplane single-engine land
 * - `amel`: airplane multi-engine land
 * - `ases`: airplane single-engine sea
 * - `ames`: airplane multi-engine sea
 *
 * Helicopter / glider / etc. are not in this enum -- they get their own ACS
 * documents (separate syllabi) with their own class scoping. If a future
 * publication needs intra-doc class scoping for non-airplane categories, the
 * enum extends explicitly.
 */
export const AIRPLANE_CLASSES = {
	ASEL: 'asel',
	AMEL: 'amel',
	ASES: 'ases',
	AMES: 'ames',
} as const;

export type AirplaneClass = (typeof AIRPLANE_CLASSES)[keyof typeof AIRPLANE_CLASSES];

export const AIRPLANE_CLASS_VALUES: readonly AirplaneClass[] = Object.values(AIRPLANE_CLASSES);

export const AIRPLANE_CLASS_LABELS: Record<AirplaneClass, string> = {
	[AIRPLANE_CLASSES.ASEL]: 'ASEL',
	[AIRPLANE_CLASSES.AMEL]: 'AMEL',
	[AIRPLANE_CLASSES.ASES]: 'ASES',
	[AIRPLANE_CLASSES.AMES]: 'AMES',
};
