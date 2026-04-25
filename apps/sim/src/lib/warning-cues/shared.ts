/**
 * Shared Web Audio helpers for the cockpit warning-cue library. Keeping the
 * AudioContext resolver in one place means the stall horn, engine sound,
 * and every warning cue agree on the same cross-browser detection path.
 */

interface WindowWithWebkit {
	AudioContext?: typeof AudioContext;
	webkitAudioContext?: typeof AudioContext;
}

export function getAudioContextCtor(): typeof AudioContext | null {
	if (typeof window === 'undefined') return null;
	const win = window as unknown as WindowWithWebkit;
	return win.AudioContext ?? win.webkitAudioContext ?? null;
}
