/**
 * Marker beacon cue. Three kinds -- outer (400 Hz, slow dashes), middle
 * (1300 Hz, dot-dash) and inner (3000 Hz, fast dots). One carrier oscillator
 * + one pulse LFO; the kind picks frequencies.
 *
 * The trigger API (`setKind('outer' | 'middle' | 'inner' | null)`) is
 * scaffolded for the Phase 4 nav-environment work. The sim has no navaid
 * model today, so the C172 scenarios never call `setKind`; the cue is
 * dead-coded but wired. See `docs/work/plans/20260422-flight-dynamics-sim-plan.md`
 * Phase 4 for where real ILS triggers will land.
 */

import { SIM_MARKER_BEACON, SIM_MARKER_BEACON_KINDS, SIM_WARNING_CUES, type SimMarkerBeaconKind } from '@ab/constants';
import { captionStore } from './audio-captions.svelte';
import { getAudioContextCtor } from './shared';

interface KindTuning {
	hz: number;
	pulseHz: number;
	cue:
		| typeof SIM_WARNING_CUES.MARKER_OUTER
		| typeof SIM_WARNING_CUES.MARKER_MIDDLE
		| typeof SIM_WARNING_CUES.MARKER_INNER;
}

function tuningFor(kind: SimMarkerBeaconKind): KindTuning {
	if (kind === SIM_MARKER_BEACON_KINDS.OUTER) {
		return {
			hz: SIM_MARKER_BEACON.OUTER_HZ,
			pulseHz: SIM_MARKER_BEACON.OUTER_PULSE_HZ,
			cue: SIM_WARNING_CUES.MARKER_OUTER,
		};
	}
	if (kind === SIM_MARKER_BEACON_KINDS.MIDDLE) {
		return {
			hz: SIM_MARKER_BEACON.MIDDLE_HZ,
			pulseHz: SIM_MARKER_BEACON.MIDDLE_PULSE_HZ,
			cue: SIM_WARNING_CUES.MARKER_MIDDLE,
		};
	}
	return {
		hz: SIM_MARKER_BEACON.INNER_HZ,
		pulseHz: SIM_MARKER_BEACON.INNER_PULSE_HZ,
		cue: SIM_WARNING_CUES.MARKER_INNER,
	};
}

export class MarkerBeacon {
	private ctx: AudioContext | null = null;
	private osc: OscillatorNode | null = null;
	private pulseOsc: OscillatorNode | null = null;
	private masterGain: GainNode | null = null;
	private kind: SimMarkerBeaconKind | null = null;
	private muted = false;
	private started = false;

	ensureStarted(): void {
		if (this.started) {
			if (this.ctx && this.ctx.state === 'suspended') {
				void this.ctx.resume();
			}
			return;
		}
		const Ctor = getAudioContextCtor();
		if (!Ctor) return;
		try {
			const ctx = new Ctor();
			const master = ctx.createGain();
			master.gain.value = 0;
			master.connect(ctx.destination);

			const osc = ctx.createOscillator();
			osc.type = 'sine';
			osc.frequency.value = SIM_MARKER_BEACON.OUTER_HZ;

			const pulseGain = ctx.createGain();
			pulseGain.gain.value = 0.5;
			const pulseLfo = ctx.createOscillator();
			pulseLfo.type = 'square';
			pulseLfo.frequency.value = SIM_MARKER_BEACON.OUTER_PULSE_HZ;
			const pulseAmp = ctx.createGain();
			pulseAmp.gain.value = 0.5;
			pulseLfo.connect(pulseAmp);
			pulseAmp.connect(pulseGain.gain);

			osc.connect(pulseGain);
			pulseGain.connect(master);

			osc.start();
			pulseLfo.start();

			this.ctx = ctx;
			this.osc = osc;
			this.pulseOsc = pulseLfo;
			this.masterGain = master;
			this.started = true;
		} catch {
			this.started = false;
		}
	}

	/** Scenario / nav code calls this when the aircraft enters / leaves a beacon cone. */
	setKind(kind: SimMarkerBeaconKind | null): void {
		if (this.kind === kind) return;
		const previousKind = this.kind;
		this.kind = kind;
		if (previousKind !== null) {
			captionStore.hide(tuningFor(previousKind).cue);
		}
		if (!this.ctx || !this.osc || !this.pulseOsc) {
			this.applyGain();
			return;
		}
		if (kind !== null) {
			const tuning = tuningFor(kind);
			const now = this.ctx.currentTime;
			this.osc.frequency.setTargetAtTime(tuning.hz, now, 0.02);
			this.pulseOsc.frequency.setTargetAtTime(tuning.pulseHz, now, 0.02);
			captionStore.show(tuning.cue);
		}
		this.applyGain();
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
		this.applyGain();
	}

	/** Stop for scenario outcome. */
	stop(): void {
		this.setKind(null);
	}

	private applyGain(): void {
		if (!this.ctx || !this.masterGain) return;
		const target = this.kind !== null && !this.muted ? SIM_MARKER_BEACON.GAIN : 0;
		const now = this.ctx.currentTime;
		this.masterGain.gain.cancelScheduledValues(now);
		this.masterGain.gain.setTargetAtTime(target, now, 0.03);
	}

	destroy(): void {
		try {
			this.osc?.stop();
			this.pulseOsc?.stop();
		} catch {
			// ignore double-stop
		}
		this.osc = null;
		this.pulseOsc = null;
		this.masterGain = null;
		if (this.ctx) {
			void this.ctx.close();
			this.ctx = null;
		}
		this.kind = null;
		this.started = false;
	}
}
