/**
 * 50 CONUS ASOS stations chosen for spike-3 coverage. Roughly even
 * geographic distribution; coastal stations included; no cluster denser
 * than ~3 stations per 200 nm radius (Northeast and Florida intentionally
 * have a couple of close pairs to test glyph-collision behavior).
 *
 * ICAO + lat/lon (degrees, decimal). Coordinates from the FAA NASR
 * airport data and Wikipedia. Precision is sufficient for plotting; the
 * pixel position will round to integer SVG coords anyway.
 *
 * Mix per spike brief:
 *   Northwest/Pacific: SEA, PDX, SFO, LAX
 *   Mountain West:     SLC, DEN, ABQ, PHX, BOI, BIL
 *   Plains:            OKC, DSM, MSP, OMA, FAR
 *   Great Lakes/Midwest: ORD, MKE, DTW, CLE, IND, STL, MEM
 *   Northeast:         BOS, BDL, JFK, LGA, EWR, PHL, BWI, IAD, DCA, BUF, ALB
 *   Southeast:         ATL, CLT, RDU, JAX, MIA, MCO, TPA, MSY
 *   Texas:             DFW, IAH, AUS, SAT, LUB
 *   Mountain South / fill: GTF, MSO, COD
 *
 * Total: 50 stations.
 *
 * Note: IEM ASOS download IDs use bare 3-letter (e.g. SEA, not KSEA).
 * The METAR body itself uses 4-letter ICAO (KSEA). We carry both.
 */

export interface StationLocation {
	icao: string; // 4-letter ICAO (matches METAR body)
	asos: string; // 3-letter ASOS id (matches IEM download ids)
	lat: number;
	lon: number;
	region: string; // documentary, used in spike-notes
}

export const STATIONS: readonly StationLocation[] = [
	// Northwest/Pacific
	{ icao: 'KSEA', asos: 'SEA', lat: 47.4502, lon: -122.3088, region: 'NW' },
	{ icao: 'KPDX', asos: 'PDX', lat: 45.5887, lon: -122.5975, region: 'NW' },
	{ icao: 'KSFO', asos: 'SFO', lat: 37.6189, lon: -122.375, region: 'CA' },
	{ icao: 'KLAX', asos: 'LAX', lat: 33.9416, lon: -118.4081, region: 'CA' },

	// Mountain West
	{ icao: 'KSLC', asos: 'SLC', lat: 40.7884, lon: -111.9778, region: 'MW' },
	{ icao: 'KDEN', asos: 'DEN', lat: 39.8617, lon: -104.6737, region: 'MW' },
	{ icao: 'KABQ', asos: 'ABQ', lat: 35.0402, lon: -106.6092, region: 'MW' },
	{ icao: 'KPHX', asos: 'PHX', lat: 33.4342, lon: -112.0078, region: 'SW' },
	{ icao: 'KBOI', asos: 'BOI', lat: 43.5644, lon: -116.2228, region: 'NW' },
	{ icao: 'KBIL', asos: 'BIL', lat: 45.8077, lon: -108.5429, region: 'NPL' },

	// Plains
	{ icao: 'KOKC', asos: 'OKC', lat: 35.3931, lon: -97.6007, region: 'SPL' },
	{ icao: 'KDSM', asos: 'DSM', lat: 41.534, lon: -93.6631, region: 'PL' },
	{ icao: 'KMSP', asos: 'MSP', lat: 44.882, lon: -93.2218, region: 'NPL' },
	{ icao: 'KOMA', asos: 'OMA', lat: 41.3032, lon: -95.8941, region: 'PL' },
	{ icao: 'KFAR', asos: 'FAR', lat: 46.9207, lon: -96.8158, region: 'NPL' },

	// Great Lakes / Midwest
	{ icao: 'KORD', asos: 'ORD', lat: 41.9742, lon: -87.9048, region: 'GL' },
	{ icao: 'KMKE', asos: 'MKE', lat: 42.9472, lon: -87.8966, region: 'GL' },
	{ icao: 'KDTW', asos: 'DTW', lat: 42.2124, lon: -83.3534, region: 'GL' },
	{ icao: 'KCLE', asos: 'CLE', lat: 41.4117, lon: -81.8498, region: 'GL' },
	{ icao: 'KIND', asos: 'IND', lat: 39.7173, lon: -86.2944, region: 'MW' },
	{ icao: 'KSTL', asos: 'STL', lat: 38.7487, lon: -90.37, region: 'MW' },
	{ icao: 'KMEM', asos: 'MEM', lat: 35.0421, lon: -89.9792, region: 'SE' },

	// Northeast
	{ icao: 'KBOS', asos: 'BOS', lat: 42.3656, lon: -71.0096, region: 'NE' },
	{ icao: 'KBDL', asos: 'BDL', lat: 41.9389, lon: -72.6832, region: 'NE' },
	{ icao: 'KJFK', asos: 'JFK', lat: 40.6413, lon: -73.7781, region: 'NE' },
	{ icao: 'KLGA', asos: 'LGA', lat: 40.7769, lon: -73.874, region: 'NE' },
	{ icao: 'KEWR', asos: 'EWR', lat: 40.6925, lon: -74.1687, region: 'NE' },
	{ icao: 'KPHL', asos: 'PHL', lat: 39.8729, lon: -75.2437, region: 'NE' },
	{ icao: 'KBWI', asos: 'BWI', lat: 39.1754, lon: -76.6683, region: 'NE' },
	{ icao: 'KIAD', asos: 'IAD', lat: 38.9445, lon: -77.4558, region: 'NE' },
	{ icao: 'KDCA', asos: 'DCA', lat: 38.8512, lon: -77.0402, region: 'NE' },
	{ icao: 'KBUF', asos: 'BUF', lat: 42.9405, lon: -78.7322, region: 'NE' },
	{ icao: 'KALB', asos: 'ALB', lat: 42.7483, lon: -73.8017, region: 'NE' },

	// Southeast
	{ icao: 'KATL', asos: 'ATL', lat: 33.6407, lon: -84.4277, region: 'SE' },
	{ icao: 'KCLT', asos: 'CLT', lat: 35.214, lon: -80.9431, region: 'SE' },
	{ icao: 'KRDU', asos: 'RDU', lat: 35.8801, lon: -78.7881, region: 'SE' },
	{ icao: 'KJAX', asos: 'JAX', lat: 30.4941, lon: -81.6879, region: 'SE' },
	{ icao: 'KMIA', asos: 'MIA', lat: 25.7959, lon: -80.2906, region: 'FL' },
	{ icao: 'KMCO', asos: 'MCO', lat: 28.4294, lon: -81.3089, region: 'FL' },
	{ icao: 'KTPA', asos: 'TPA', lat: 27.9755, lon: -82.5332, region: 'FL' },
	{ icao: 'KMSY', asos: 'MSY', lat: 29.9934, lon: -90.258, region: 'GULF' },

	// Texas
	{ icao: 'KDFW', asos: 'DFW', lat: 32.8998, lon: -97.0403, region: 'TX' },
	{ icao: 'KIAH', asos: 'IAH', lat: 29.9844, lon: -95.3414, region: 'TX' },
	{ icao: 'KAUS', asos: 'AUS', lat: 30.1945, lon: -97.6699, region: 'TX' },
	{ icao: 'KSAT', asos: 'SAT', lat: 29.5337, lon: -98.4698, region: 'TX' },
	{ icao: 'KLBB', asos: 'LBB', lat: 33.6636, lon: -101.8228, region: 'TX' },

	// Mountain South / fill
	{ icao: 'KGTF', asos: 'GTF', lat: 47.482, lon: -111.3711, region: 'MW' },
	{ icao: 'KMSO', asos: 'MSO', lat: 46.9163, lon: -114.0906, region: 'MW' },
	{ icao: 'KCOD', asos: 'COD', lat: 44.5202, lon: -109.0238, region: 'MW' },
];
