/**
 * Time decoding for hazard products.
 *
 * Aviation products timestamp with DDHHMM tokens where DD is the
 * day-of-month in UTC. Bulletins do not embed the month or year --
 * the caller passes a reference instant (usually "now") and we infer
 * the year + month, sliding back one month when the day-of-month
 * exceeds the reference's day (i.e. a product issued at the end of
 * last month, decoded today).
 *
 * The output is always a JS Date (UTC instant). Render-time
 * formatting in Zulu + local is done in `format-cli.ts`.
 *
 * Browser-safe.
 */

/**
 * Parse a `DDHHMM` token (e.g. "192055") into a UTC Date relative to
 * `now`. Returns null when the token is malformed.
 */
export function parseDdhhmm(token: string, now: Date): Date | null {
	if (!/^[0-9]{6}$/.test(token)) return null;
	const dd = Number.parseInt(token.slice(0, 2), 10);
	const hh = Number.parseInt(token.slice(2, 4), 10);
	const mm = Number.parseInt(token.slice(4, 6), 10);
	if (dd < 1 || dd > 31) return null;
	if (hh > 23) return null;
	if (mm > 59) return null;
	let year = now.getUTCFullYear();
	let month = now.getUTCMonth();
	if (dd > now.getUTCDate() + 1) {
		// Token's day-of-month is in the past; slide back a month.
		if (month === 0) {
			month = 11;
			year -= 1;
		} else {
			month -= 1;
		}
	}
	const ms = Date.UTC(year, month, dd, hh, mm, 0);
	return new Date(ms);
}

/**
 * Parse a `HHMMZ` validity token (e.g. "2255Z") into a UTC Date,
 * anchored to `referenceDate`'s UTC day. When the time-of-day is
 * before the reference's time-of-day we advance one day.
 */
export function parseHhmmZ(token: string, referenceDate: Date): Date | null {
	const match = /^([0-9]{4})Z?$/.exec(token);
	if (!match) return null;
	const hh = Number.parseInt(match[1].slice(0, 2), 10);
	const mm = Number.parseInt(match[1].slice(2, 4), 10);
	if (hh > 23 || mm > 59) return null;
	const refYear = referenceDate.getUTCFullYear();
	const refMonth = referenceDate.getUTCMonth();
	const refDay = referenceDate.getUTCDate();
	let candidate = Date.UTC(refYear, refMonth, refDay, hh, mm, 0);
	if (candidate < referenceDate.getTime() - 60_000) {
		// Advance one day -- the validity wraps past midnight Z.
		candidate += 86_400_000;
	}
	return new Date(candidate);
}

/**
 * Format a UTC Date as Zulu (DDHHMMZ) display. Pure UTC.
 *
 *   formatZulu(new Date("2026-05-19T20:55:00Z")) === "2055Z 19 May 2026"
 */
export function formatZulu(d: Date): string {
	const dd = String(d.getUTCDate()).padStart(2, '0');
	const hh = String(d.getUTCHours()).padStart(2, '0');
	const mm = String(d.getUTCMinutes()).padStart(2, '0');
	const monthName = MONTH_NAMES[d.getUTCMonth()];
	return `${hh}${mm}Z ${dd} ${monthName} ${d.getUTCFullYear()}`;
}

/**
 * Format a UTC Date for a local IANA timezone, returning a short
 * pilot-friendly string like "16:55 EDT".
 */
export function formatLocalShort(d: Date, tz: string): string {
	const formatter = new Intl.DateTimeFormat('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: tz,
		timeZoneName: 'short',
	});
	const parts = formatter.formatToParts(d);
	const hour = parts.find((p) => p.type === 'hour')?.value ?? '??';
	const minute = parts.find((p) => p.type === 'minute')?.value ?? '??';
	const zone = parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
	return `${hour}:${minute} ${zone}`;
}

/**
 * Format a duration in minutes as a compact human string.
 *
 *   formatDuration(125) === "2h 5m"
 *   formatDuration(45)  === "45m"
 */
export function formatDuration(minutes: number): string {
	if (minutes < 1) return '<1m';
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes - h * 60);
	if (h === 0) return `${m}m`;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}

/**
 * Relative time vs `now`: returns a phrase like "now" / "in 1h 5m" /
 * "1h 5m remaining" / "expired 12m ago".
 */
export function describeRelative(target: Date, now: Date, kind: 'starts' | 'ends'): string {
	const minutes = Math.round((target.getTime() - now.getTime()) / 60_000);
	if (kind === 'starts') {
		if (Math.abs(minutes) <= 1) return 'now';
		if (minutes > 0) return `in ${formatDuration(minutes)}`;
		return `started ${formatDuration(-minutes)} ago`;
	}
	if (minutes > 0) return `${formatDuration(minutes)} remaining`;
	return `expired ${formatDuration(-minutes)} ago`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
