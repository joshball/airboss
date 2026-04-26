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
 * Scene composition (Phase 7):
 * - Sky dome: large hemisphere, two-tone vertex shader (blue at top,
 *   pale haze at horizon).
 * - Ground plane: large flat disk, single matte color, grid lines for
 *   speed cues. Horizon haze (`THREE.Fog`) softens distant grid lines
 *   into the sky color.
 * - Runway: 1500 m by 30 m asphalt strip with painted centerline
 *   stripes, positioned along the body-x axis at the world origin.
 * - Sun: billboard sprite high in the southern sky.
 * - Cloud layer: ~18 sparse cumulus billboards at ~3000 ft AGL.
 * - Camera: perspective, parented to a yaw-pitch-roll Object3D rig
 *   that the props drive directly.
 */

import { onMount } from 'svelte';
import {
	AdditiveBlending,
	BackSide,
	Color,
	DoubleSide,
	Fog,
	GridHelper,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	ShaderMaterial,
	SphereGeometry,
	Sprite,
	SpriteMaterial,
	Texture,
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
const RUNWAY_COLOR = new Color('#2b2e33');
const RUNWAY_STRIPE_COLOR = new Color('#d8d8d8');
const SCENE_RADIUS = 50_000; // meters; larger than any sim scenario will ever drift

// Runway: 1500 m by 30 m, painted with centerline stripes. Positioned
// along the scenario body-x axis at the world origin -- scenarios that
// start above a runway (EFATO, ILS approach) see it directly under
// them; scenarios at altitude (steep turns) see it as a far-away
// reference strip. Generic enough to work for every scenario without
// needing per-scenario airport data.
const RUNWAY_LENGTH_M = 1500;
const RUNWAY_WIDTH_M = 30;
const RUNWAY_CENTERLINE_COUNT = 12;

/**
 * Build a tiny canvas-rendered cloud-puff texture for use on a
 * sprite. Six radial-gradient blobs in white-on-transparent give a
 * passable cumulus shape without needing an external asset (and
 * keeping the sim app's CSP `img-src self+data:` rule clean).
 */
function buildCloudTexture(): Texture {
	const size = 128;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	const texture = new Texture(canvas);
	if (!ctx) {
		texture.needsUpdate = true;
		return texture;
	}
	ctx.clearRect(0, 0, size, size);
	const blobs = [
		{ cx: 64, cy: 70, r: 38, alpha: 0.9 },
		{ cx: 42, cy: 74, r: 26, alpha: 0.8 },
		{ cx: 86, cy: 74, r: 28, alpha: 0.85 },
		{ cx: 56, cy: 56, r: 22, alpha: 0.7 },
		{ cx: 76, cy: 60, r: 20, alpha: 0.65 },
		{ cx: 64, cy: 84, r: 24, alpha: 0.55 },
	];
	for (const b of blobs) {
		const grad = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, b.r);
		grad.addColorStop(0, `rgba(255, 255, 255, ${b.alpha})`);
		grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, size, size);
	}
	texture.needsUpdate = true;
	return texture;
}

/**
 * Build a tiny radial-gradient sun texture: bright white core with a
 * pale-yellow halo fading to transparent. Used as a billboard sprite
 * positioned at the south end of the sky dome.
 */
function buildSunTexture(): Texture {
	const size = 128;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');
	const texture = new Texture(canvas);
	if (!ctx) {
		texture.needsUpdate = true;
		return texture;
	}
	const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
	grad.addColorStop(0, 'rgba(255, 252, 230, 1)');
	grad.addColorStop(0.3, 'rgba(255, 240, 180, 0.8)');
	grad.addColorStop(0.7, 'rgba(255, 220, 150, 0.25)');
	grad.addColorStop(1, 'rgba(255, 220, 150, 0)');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, size, size);
	texture.needsUpdate = true;
	return texture;
}

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
	// Horizon haze: distant geometry fades into the sky color so the
	// sky/ground line is soft, not razor-sharp. Range chosen to leave
	// the runway + nearby clouds crisp while pulling far ground gridlines
	// into atmosphere.
	scene.fog = new Fog(SKY_HORIZON_COLOR, 4_000, SCENE_RADIUS * 0.6);

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

	// Runway: dark asphalt strip along the body-x axis, painted with
	// dashed centerline stripes. Generic geometry that works for every
	// scenario regardless of the authored runway heading -- scenarios
	// align body-x with their runway by convention.
	const runwayGeometry = new PlaneGeometry(RUNWAY_LENGTH_M, RUNWAY_WIDTH_M);
	const runwayMaterial = new MeshBasicMaterial({ color: RUNWAY_COLOR, side: DoubleSide });
	const runway = new Mesh(runwayGeometry, runwayMaterial);
	runway.rotation.x = -Math.PI / 2;
	// Lift the runway 1 cm above the ground plane to avoid z-fighting.
	runway.position.y = 0.01;
	// Place runway's near end at the world origin so scenarios that
	// start at x=0 (most of them) see the runway directly under them.
	runway.position.x = RUNWAY_LENGTH_M / 2;
	scene.add(runway);

	// Centerline stripes: short white planes spaced evenly along the
	// runway. Painting via geometry instead of a texture keeps the
	// app's CSP rule clean (no remote / data-URL textures needed).
	const stripeGeometry = new PlaneGeometry(RUNWAY_LENGTH_M / RUNWAY_CENTERLINE_COUNT / 2, 1);
	const stripeMaterial = new MeshBasicMaterial({ color: RUNWAY_STRIPE_COLOR, side: DoubleSide });
	const stripes: Mesh[] = [];
	for (let i = 0; i < RUNWAY_CENTERLINE_COUNT; i++) {
		const stripe = new Mesh(stripeGeometry, stripeMaterial);
		stripe.rotation.x = -Math.PI / 2;
		stripe.position.y = 0.02;
		stripe.position.x = (RUNWAY_LENGTH_M / RUNWAY_CENTERLINE_COUNT) * (i + 0.5);
		scene.add(stripe);
		stripes.push(stripe);
	}

	// Sun: a billboard sprite high in the southern sky, positioned at
	// roughly 50 deg elevation. Pure visual cue -- there is no
	// directional lighting model in this scene because the ground +
	// sky shaders are unlit, so the sun is decorative.
	const sunTexture = buildSunTexture();
	const sunMaterial = new SpriteMaterial({ map: sunTexture, blending: AdditiveBlending, depthWrite: false });
	const sun = new Sprite(sunMaterial);
	const sunRange = SCENE_RADIUS * 0.85;
	sun.position.set(0, sunRange * 0.6, -sunRange * 0.5);
	sun.scale.set(SCENE_RADIUS * 0.06, SCENE_RADIUS * 0.06, 1);
	scene.add(sun);

	// Sparse cloud layer at ~3000 ft AGL. A handful of billboards
	// scattered around the camera work fine for sim-feel purposes;
	// distant clouds blend into the haze fog.
	const cloudTexture = buildCloudTexture();
	const cloudMaterial = new SpriteMaterial({ map: cloudTexture, depthWrite: false, transparent: true });
	const clouds: Sprite[] = [];
	const cloudCount = 18;
	const cloudAlt = 900; // meters AGL, ~3000 ft
	const cloudSpread = 12_000;
	for (let i = 0; i < cloudCount; i++) {
		const cloud = new Sprite(cloudMaterial);
		const angle = (i / cloudCount) * Math.PI * 2;
		const radius = cloudSpread * (0.4 + Math.random() * 0.6);
		cloud.position.set(Math.cos(angle) * radius, cloudAlt + (Math.random() - 0.5) * 200, Math.sin(angle) * radius);
		const scale = 600 + Math.random() * 600;
		cloud.scale.set(scale, scale * 0.5, 1);
		scene.add(cloud);
		clouds.push(cloud);
	}

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
		runwayGeometry.dispose();
		runwayMaterial.dispose();
		stripeGeometry.dispose();
		stripeMaterial.dispose();
		sunMaterial.dispose();
		sunTexture.dispose();
		cloudMaterial.dispose();
		cloudTexture.dispose();
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
