/**
 * Aviation synonym map. Query-side rewrite -- typing `wx` should find rows
 * tagged "weather" and vice versa; typing `tstm` should find "thunderstorm".
 *
 * The map is bidirectional: every alias on the right resolves to the
 * canonical on the left, and the canonical also resolves to every alias.
 *
 * Seed list is the ~100-entry table from the palette design note
 * (`docs/work/plans/2026-05-10-command-palette-design.md` Appendix A).
 */

interface SynonymEntry {
	canonical: string;
	aliases: readonly string[];
}

export const AVIATION_SYNONYMS: readonly SynonymEntry[] = [
	// --- Weather ---
	{ canonical: 'weather', aliases: ['wx'] },
	{ canonical: 'overcast', aliases: ['ovc', 'ovx'] },
	{ canonical: 'broken', aliases: ['bkn'] },
	{ canonical: 'scattered', aliases: ['sct'] },
	{ canonical: 'clear', aliases: ['clr', 'skc'] },
	{ canonical: 'thunderstorm', aliases: ['tstm', 'tsra', 'ts'] },
	{ canonical: 'turbulence', aliases: ['turb', 'ltb'] },
	{ canonical: 'icing', aliases: ['ice', 'ic'] },
	{ canonical: 'visibility', aliases: ['vis'] },
	{ canonical: 'ceiling', aliases: ['ceil', 'cig'] },
	{ canonical: 'wind', aliases: ['wnd'] },
	{ canonical: 'gust', aliases: ['gst'] },
	{ canonical: 'precipitation', aliases: ['pcpn', 'precip'] },
	{ canonical: 'rain', aliases: ['ra'] },
	{ canonical: 'snow', aliases: ['sn'] },
	{ canonical: 'fog', aliases: ['fg'] },
	{ canonical: 'mist', aliases: ['br'] },
	{ canonical: 'haze', aliases: ['hz'] },
	{ canonical: 'freezing', aliases: ['fz'] },
	{ canonical: 'dewpoint', aliases: ['dwpt', 'td'] },
	{ canonical: 'temperature', aliases: ['temp', 't'] },
	{ canonical: 'altimeter', aliases: ['altimeter setting', 'kollsman'] },
	{ canonical: 'sea level pressure', aliases: ['slp'] },

	// --- Flight rules ---
	{ canonical: 'visual flight rules', aliases: ['vfr'] },
	{ canonical: 'instrument flight rules', aliases: ['ifr'] },
	{ canonical: 'marginal vfr', aliases: ['mvfr'] },
	{ canonical: 'low ifr', aliases: ['lifr'] },

	// --- Reports / charts ---
	{ canonical: 'metar', aliases: ['meteorological aerodrome report', 'aviation routine weather report'] },
	{ canonical: 'taf', aliases: ['terminal aerodrome forecast'] },
	{ canonical: 'airmet', aliases: ["airmen's meteorological information"] },
	{ canonical: 'sigmet', aliases: ['significant meteorological information'] },
	{ canonical: 'pirep', aliases: ['pilot report', 'urgent pirep'] },
	{ canonical: 'cwa', aliases: ['center weather advisory'] },
	{ canonical: 'afd', aliases: ['area forecast discussion'] },
	{ canonical: 'prog chart', aliases: ['prog', 'prognostic chart'] },
	{ canonical: 'surface analysis', aliases: ['sfc anl', 'surface chart'] },
	{ canonical: 'winds aloft', aliases: ['fb', 'winds and temps aloft'] },

	// --- Aircraft / performance ---
	{ canonical: 'maneuvering speed', aliases: ['va', 'design maneuvering speed'] },
	{ canonical: 'never exceed speed', aliases: ['vne'] },
	{ canonical: 'maximum structural cruise', aliases: ['vno'] },
	{ canonical: 'flap extended speed', aliases: ['vfe'] },
	{ canonical: 'landing gear extended speed', aliases: ['vle'] },
	{ canonical: 'landing gear operating speed', aliases: ['vlo'] },
	{ canonical: 'best angle of climb', aliases: ['vx'] },
	{ canonical: 'best rate of climb', aliases: ['vy'] },
	{ canonical: 'minimum control speed', aliases: ['vmc', 'vmca', 'vmcl'] },
	{ canonical: 'stall speed', aliases: ['vs', 'vs0', 'vs1'] },
	{ canonical: 'rotation speed', aliases: ['vr'] },
	{ canonical: 'takeoff safety speed', aliases: ['v2'] },
	{ canonical: 'decision speed', aliases: ['v1'] },
	{ canonical: 'density altitude', aliases: ['da'] },
	{ canonical: 'pressure altitude', aliases: ['pa'] },
	{ canonical: 'indicated airspeed', aliases: ['ias'] },
	{ canonical: 'true airspeed', aliases: ['tas'] },
	{ canonical: 'calibrated airspeed', aliases: ['cas'] },
	{ canonical: 'ground speed', aliases: ['gs'] },

	// --- Navigation / airspace ---
	{ canonical: 'nondirectional beacon', aliases: ['ndb'] },
	{ canonical: 'vor', aliases: ['very high frequency omnidirectional range'] },
	{ canonical: 'distance measuring equipment', aliases: ['dme'] },
	{ canonical: 'instrument landing system', aliases: ['ils'] },
	{ canonical: 'area navigation', aliases: ['rnav', 'gps nav'] },
	{ canonical: 'required navigation performance', aliases: ['rnp'] },
	{ canonical: 'localizer', aliases: ['loc'] },
	{ canonical: 'glideslope', aliases: ['gp', 'glide path'] },
	{ canonical: 'class bravo', aliases: ['class b'] },
	{ canonical: 'class charlie', aliases: ['class c'] },
	{ canonical: 'class delta', aliases: ['class d'] },
	{ canonical: 'class echo', aliases: ['class e'] },
	{ canonical: 'class golf', aliases: ['class g'] },
	{ canonical: 'military operations area', aliases: ['moa'] },
	{ canonical: 'temporary flight restriction', aliases: ['tfr'] },
	{ canonical: 'notam', aliases: ['notice to air missions', 'notice to airmen'] },

	// --- Documents / standards ---
	{ canonical: 'phak', aliases: ["pilot's handbook of aeronautical knowledge", 'pilots handbook'] },
	{ canonical: 'afh', aliases: ['airplane flying handbook'] },
	{ canonical: 'ifh', aliases: ['instrument flying handbook'] },
	{ canonical: 'iph', aliases: ['instrument procedures handbook'] },
	{ canonical: 'avwx', aliases: ['aviation weather handbook', 'aviation weather'] },
	{ canonical: 'rmh', aliases: ['risk management handbook'] },
	{ canonical: 'aih', aliases: ["aviation instructor's handbook", 'aviation instructors handbook', 'iah'] },
	{ canonical: 'aim', aliases: ['aeronautical information manual'] },
	{ canonical: 'pcg', aliases: ['pilot controller glossary'] },
	{ canonical: 'acs', aliases: ['airman certification standards'] },
	{ canonical: 'pts', aliases: ['practical test standards'] },

	// --- Certificates ---
	{ canonical: 'private pilot license', aliases: ['ppl', 'private pilot certificate'] },
	{ canonical: 'instrument rating', aliases: ['ir'] },
	{ canonical: 'commercial pilot license', aliases: ['cpl', 'commercial pilot certificate'] },
	{ canonical: 'certified flight instructor', aliases: ['cfi'] },
	{ canonical: 'airline transport pilot', aliases: ['atp'] },
	{ canonical: 'flight review', aliases: ['bfr', 'biennial flight review'] },

	// --- Operations ---
	{ canonical: 'takeoff', aliases: ['tko', 'departure', 'dep'] },
	{ canonical: 'landing', aliases: ['ldg', 'arrival', 'arr'] },
	{ canonical: 'go around', aliases: ['ga'] },
	{ canonical: 'missed approach', aliases: ['missed'] },
	{ canonical: 'approach', aliases: ['appr', 'app'] },
	{ canonical: 'runway', aliases: ['rwy'] },
	{ canonical: 'taxiway', aliases: ['twy'] },
	{ canonical: 'line up and wait', aliases: ['luaw'] },

	// --- Human factors / safety ---
	{ canonical: 'aeronautical decision making', aliases: ['adm'] },
	{ canonical: 'single pilot resource management', aliases: ['srm'] },
	{ canonical: 'crew resource management', aliases: ['crm'] },
	{ canonical: 'controlled flight into terrain', aliases: ['cfit'] },
	{ canonical: 'loss of control inflight', aliases: ['loc-i', 'loc i'] },
	{ canonical: 'spatial disorientation', aliases: ['sd'] },
	{ canonical: 'hypoxia', aliases: [] },

	// --- Aircraft systems ---
	{ canonical: 'pilot operating handbook', aliases: ['poh', 'airplane flight manual', 'afm'] },
	{ canonical: 'angle of attack', aliases: ['aoa'] },
	{ canonical: 'minimum equipment list', aliases: ['mel'] },
	{ canonical: 'service ceiling', aliases: [] },

	// --- Communications ---
	{ canonical: 'automatic terminal information service', aliases: ['atis'] },
	{ canonical: 'common traffic advisory frequency', aliases: ['ctaf'] },
	{ canonical: 'unicom', aliases: [] },
	{ canonical: 'flight following', aliases: ['vfr flight following'] },
	{ canonical: 'mayday', aliases: ['emergency'] },
	{ canonical: 'pan-pan', aliases: ['urgency'] },
];

/** Build a query-side rewrite map: token -> all forms to also try. */
function buildRewriteMap(): Map<string, Set<string>> {
	const map = new Map<string, Set<string>>();
	const add = (from: string, to: string): void => {
		const key = from.toLowerCase();
		let set = map.get(key);
		if (!set) {
			set = new Set();
			map.set(key, set);
		}
		set.add(to.toLowerCase());
	};

	for (const entry of AVIATION_SYNONYMS) {
		for (const alias of entry.aliases) {
			add(entry.canonical, alias);
			add(alias, entry.canonical);
			for (const other of entry.aliases) {
				if (other !== alias) add(alias, other);
			}
		}
	}
	return map;
}

const REWRITE_MAP = buildRewriteMap();

/**
 * Given a query token, return the original token plus every synonym form to
 * also try. Always includes the input itself.
 *
 * Examples:
 *   expandToken("wx")       -> ["wx", "weather"]
 *   expandToken("weather")  -> ["weather", "wx"]
 *   expandToken("avwx")     -> ["avwx", "aviation weather handbook", "aviation weather"]
 *   expandToken("foo")      -> ["foo"]
 */
export function expandToken(token: string): readonly string[] {
	const lower = token.toLowerCase();
	const expansions = REWRITE_MAP.get(lower);
	if (!expansions) return [token];
	return [token, ...expansions];
}

/**
 * Expand a multi-word query by trying single-token and adjacent multi-word
 * matches against the synonym map. Returns all candidate query strings,
 * deduped, with the original first.
 */
export function expandQuery(query: string): readonly string[] {
	const trimmed = query.trim();
	if (!trimmed) return [trimmed];
	const lower = trimmed.toLowerCase();
	const out = new Set<string>([trimmed]);

	// Full-query synonyms first ("aviation weather" -> "avwx").
	const fullMatches = REWRITE_MAP.get(lower);
	if (fullMatches) for (const m of fullMatches) out.add(m);

	// Per-token: split on whitespace, expand each, recombine cartesian-style.
	// For single-token queries this is the only path.
	const tokens = lower.split(/\s+/).filter(Boolean);
	if (tokens.length === 1) {
		const first = tokens[0];
		if (first) {
			const expansions = REWRITE_MAP.get(first);
			if (expansions) for (const e of expansions) out.add(e);
		}
	} else {
		// For multi-token queries, try replacing each token with its synonym in
		// turn, leaving the rest unchanged. We don't combinatorially expand all
		// tokens at once -- that explodes too fast.
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (!token) continue;
			const expansions = REWRITE_MAP.get(token);
			if (!expansions) continue;
			for (const e of expansions) {
				const variant = [...tokens];
				variant[i] = e;
				out.add(variant.join(' '));
			}
		}
	}

	return [...out];
}

/** Test-only helper -- expose the internal map shape for assertions. */
export function __getSynonymMapSizeForTests(): number {
	return REWRITE_MAP.size;
}
