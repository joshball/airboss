<script lang="ts">
/**
 * 3D outside-the-cockpit horizon view. Pure prop-driven component --
 * accepts attitude / heading / altitude as primitives and renders a
 * Three.js scene. Has no awareness of the FDM worker, scenarios, or
 * any other sim plumbing. Drop into any page that can produce these
 * five numbers and it will render.
 *
 * Loose-coupling contract:
 * - No imports from `@ab/bc-sim` or sim-internal libs. Props are
 *   plain SI/radian primitives.
 * - Renders into its own canvas; the parent provides the bounding box
 *   via CSS. The component handles resize via ResizeObserver.
 * - No globals, no module state. Multiple instances are safe.
 * - Cleans up Three.js resources (renderer / geometries / materials /
 *   ResizeObserver / animation handle) on unmount.
 *
 * Scene composition (kept intentionally simple for Phase 7 MVP):
 * - Sky dome: large hemisphere, two-tone vertex shader (blue at top,
 *   pale haze at horizon).
 * - Ground plane: large flat disk, single matte color, grid lines for
 *   speed cues.
 * - Horizon line: implicit at the sky/ground boundary.
 * - Camera: perspective, parented to a yaw-pitch-roll Object3D rig
 *   that the props drive directly.
 *
 * Cloud layer is intentionally omitted in this initial version --
 * adding it later is a single optional Mesh; the perf-budget gate
 * lives in the loop already.
 */

import { onMount } from 'svelte';
import {
	BackSide,
	Color,
	DoubleSide,
	GridHelper,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	WebGLRenderer,
} from 'three';

interface Props {
	/** Pitch in radians, nose-up positive. */
	pitchRadians: number;
	/** Bank in radians, right-wing-down positive. */
	rollRadians: number;
	/** True heading in radians, 0 = north, increases clockwise looking down. */
	headingRadians: number;
	/** Altitude MSL in meters. Drives camera height for foreground parallax. */
	altitudeMeters: number;
	/** Ground elevation MSL in meters under the aircraft. AGL = altitude - groundElevation. */
	groundElevationMeters: number;
}

let { pitchRadians, rollRadians, headingRadians, altitudeMeters, groundElevationMeters }: Props = $props();

let canvas: HTMLCanvasElement;
let container: HTMLDivElement;

const SKY_HORIZON_COLOR = new Color('#a8c4d6');
const SKY_TOP_COLOR = new Color('#3a5d80');
const GROUND_COLOR = new Color('#3d4a3a');
const GRID_COLOR = new Color('#5a6e5a');
const SCENE_RADIUS = 50_000; // meters; larger than any sim scenario will ever drift

// Vertex/fragment for a two-tone sky dome -- y in clip space goes 0 at the
// horizon, 1 at zenith. Shader gradient avoids the banding a CSS-style
// fixed-color sphere would show on rotation.
const SKY_VERTEX_SHADER = `
varying float vWorldY;
void main() {
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vWorldY = worldPos.y;
	gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const SKY_FRAGMENT_SHADER = `
uniform vec3 horizonColor;
uniform vec3 zenithColor;
uniform float radius;
varying float vWorldY;
void main() {
	float t = clamp(vWorldY / radius, 0.0, 1.0);
	gl_FragColor = vec4(mix(horizonColor, zenithColor, t), 1.0);
}
`;

onMount(() => {
	const renderer = new WebGLRenderer({ canvas, antialias: true });
	// Cap pixel ratio at 2 to keep retina perf reasonable -- the horizon view
	// is a fairly large viewport, and uncapped DPR on a 4K display will tank
	// frame rate without visible benefit.
	renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
	renderer.setSize(container.clientWidth, container.clientHeight, false);

	const scene = new Scene();

	// Camera rig: a parent Object3D handles yaw (heading), and the camera
	// itself takes pitch + roll. This way prop deltas map directly to a
	// single transform per frame -- no quaternion math, no gimbal surprises
	// inside the typical flight envelope (<= 90 deg pitch / 180 deg roll).
	const yawRig = new Object3D();
	const camera = new PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, SCENE_RADIUS * 2);
	yawRig.add(camera);
	scene.add(yawRig);

	// Sky dome: large hemisphere rendered from the inside.
	const skyGeometry = new SphereGeometry(SCENE_RADIUS, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
	const skyMaterial = new ShaderMaterial({
		uniforms: {
			horizonColor: { value: SKY_HORIZON_COLOR },
			zenithColor: { value: SKY_TOP_COLOR },
			radius: { value: SCENE_RADIUS },
		},
		vertexShader: SKY_VERTEX_SHADER,
		fragmentShader: SKY_FRAGMENT_SHADER,
		side: BackSide,
		depthWrite: false,
	});
	const sky = new Mesh(skyGeometry, skyMaterial);
	scene.add(sky);

	// Ground plane: large square below the camera. PlaneGeometry default
	// orientation is XY; rotate -PI/2 around X so it lies on the XZ plane
	// (Three.js convention: Y is up).
	const groundGeometry = new PlaneGeometry(SCENE_RADIUS * 2, SCENE_RADIUS * 2);
	const groundMaterial = new MeshBasicMaterial({ color: GROUND_COLOR, side: DoubleSide });
	const ground = new Mesh(groundGeometry, groundMaterial);
	ground.rotation.x = -Math.PI / 2;
	scene.add(ground);

	// Grid lines on the ground give speed and altitude cues (the eye reads
	// the grid spacing as you climb / descend / move forward).
	const grid = new GridHelper(SCENE_RADIUS * 2, 200, GRID_COLOR, GRID_COLOR);
	const gridMaterial = grid.material;
	if (Array.isArray(gridMaterial)) {
		for (const mat of gridMaterial) {
			mat.transparent = true;
			mat.opacity = 0.4;
		}
	} else {
		gridMaterial.transparent = true;
		gridMaterial.opacity = 0.4;
	}
	scene.add(grid);

	// Apply current props to the camera/yaw rig. Called every animation
	// frame -- props are reactive but the loop drives reads to keep cost
	// at one mat update per frame regardless of how many props change.
	function applyPose(): void {
		const aglMeters = Math.max(0, altitudeMeters - groundElevationMeters);
		// Camera y in scene space corresponds to AGL: ground sits at y=0.
		// Use AGL not MSL so the ground plane's relative position to the
		// camera matches what the pilot sees out the window regardless of
		// scenario terrain height.
		yawRig.position.y = aglMeters;
		yawRig.rotation.y = -headingRadians; // negate: heading is clockwise-from-north, scene yaw is CCW.
		camera.rotation.order = 'YXZ';
		camera.rotation.x = pitchRadians;
		camera.rotation.z = -rollRadians; // negate: right-wing-down should rotate the world right-up.
	}

	let frame = 0;
	function loop(): void {
		applyPose();
		renderer.render(scene, camera);
		frame = requestAnimationFrame(loop);
	}
	frame = requestAnimationFrame(loop);

	const resizeObserver = new ResizeObserver(() => {
		const w = container.clientWidth;
		const h = container.clientHeight;
		if (w > 0 && h > 0) {
			renderer.setSize(w, h, false);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
		}
	});
	resizeObserver.observe(container);

	return () => {
		cancelAnimationFrame(frame);
		resizeObserver.disconnect();
		skyGeometry.dispose();
		skyMaterial.dispose();
		groundGeometry.dispose();
		groundMaterial.dispose();
		grid.geometry.dispose();
		if (Array.isArray(grid.material)) {
			for (const mat of grid.material) mat.dispose();
		} else {
			grid.material.dispose();
		}
		renderer.dispose();
	};
});
</script>

<div bind:this={container} class="horizon-3d-container">
	<canvas bind:this={canvas} class="horizon-3d-canvas" aria-label="3D horizon view"></canvas>
</div>

<style>
	.horizon-3d-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--surface-panel);
	}
	.horizon-3d-canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
