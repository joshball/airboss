/**
 * Warning cue library. Each cue is a small class backed by a Web Audio graph
 * and -- for a11y -- pushes a caption into `captionStore` while active.
 * Gesture-started, shares the cockpit's mute flag, stops on scenario outcome.
 */

export { AltitudeAlert } from './altitude-alert.svelte';
export { ApDisconnect } from './ap-disconnect.svelte';
export { type CaptionEntry, captionStore } from './audio-captions.svelte';
export { FlapMotor } from './flap-motor.svelte';
export { GearWarning } from './gear-warning.svelte';
export { MarkerBeacon } from './marker-beacon.svelte';
