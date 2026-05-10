/**
 * ESRI world file parser.
 *
 * A world file is six numeric lines defining the affine transform from
 * pixel space (px, py) -> world space (x, y). Convention:
 *
 *   line 1: A  -- pixel size in the X direction (west-east, positive)
 *   line 2: D  -- rotation about the Y axis (typically 0)
 *   line 3: B  -- rotation about the X axis (typically 0)
 *   line 4: E  -- pixel size in the Y direction (typically negative,
 *                 since image rows count down while latitude counts up)
 *   line 5: C  -- world X coord of the centre of the upper-left pixel
 *   line 6: F  -- world Y coord of the centre of the upper-left pixel
 *
 * For a Plate Carree (EPSG:4326) raster, the world coords are degrees
 * longitude / latitude. For a projected raster, they are projected
 * units (e.g., metres).
 *
 * Source: ESRI world-file spec
 * https://en.wikipedia.org/wiki/World_file
 *
 * Browser-safe: pure parsing of a string, no Node imports.
 */

export interface WorldFile {
	/** Pixel width in world units (X direction, typically positive). */
	pixelWidth: number;
	/** Rotation about the Y axis in world units / pixel. Typically 0. */
	rotationY: number;
	/** Rotation about the X axis in world units / pixel. Typically 0. */
	rotationX: number;
	/** Pixel height in world units (Y direction). Typically negative. */
	pixelHeight: number;
	/** World X coordinate of the centre of the upper-left pixel. */
	upperLeftX: number;
	/** World Y coordinate of the centre of the upper-left pixel. */
	upperLeftY: number;
}

/**
 * Parse the contents of an ESRI world file (.wld / .pgw / .jgw / .tfw).
 * Whitespace separates the six numbers; line endings are flexible.
 *
 * Throws when the file does not parse to exactly six finite numbers.
 */
export function parseWorldFile(text: string): WorldFile {
	const tokens = text.trim().split(/\s+/);
	if (tokens.length !== 6) {
		throw new Error(`worldfile: expected 6 numeric values, got ${tokens.length}`);
	}
	const values = tokens.map((t) => Number(t));
	for (let i = 0; i < values.length; i += 1) {
		if (!Number.isFinite(values[i])) {
			throw new Error(`worldfile: token ${i + 1} is not a finite number ('${tokens[i]}')`);
		}
	}
	return {
		pixelWidth: values[0],
		rotationY: values[1],
		rotationX: values[2],
		pixelHeight: values[3],
		upperLeftX: values[4],
		upperLeftY: values[5],
	};
}

/**
 * Convert a pixel coordinate `(px, py)` (raster space, 0-indexed) to
 * world coordinates `(x, y)` via the world file's affine transform.
 * The (0, 0) pixel maps to (`upperLeftX`, `upperLeftY`).
 *
 * For pure Plate Carree rasters with no rotation this collapses to the
 * familiar `lon = upperLeftX + px * pixelWidth`,
 * `lat = upperLeftY + py * pixelHeight` form.
 */
export function pixelToWorld(world: WorldFile, px: number, py: number): [number, number] {
	const x = world.pixelWidth * px + world.rotationY * py + world.upperLeftX;
	const y = world.rotationX * px + world.pixelHeight * py + world.upperLeftY;
	return [x, y];
}

/**
 * Inverse: convert a world coordinate `(x, y)` to fractional pixel
 * coordinates `(px, py)`. Useful for inverse-projection warps that need
 * to sample the source raster from output pixels.
 *
 * Throws when the affine transform is degenerate (det == 0), which
 * indicates a malformed world file.
 */
export function worldToPixel(world: WorldFile, x: number, y: number): [number, number] {
	const a = world.pixelWidth;
	const b = world.rotationY;
	const c = world.rotationX;
	const d = world.pixelHeight;
	const det = a * d - b * c;
	if (det === 0) {
		throw new Error('worldfile: degenerate affine transform (determinant is zero)');
	}
	const dx = x - world.upperLeftX;
	const dy = y - world.upperLeftY;
	const px = (d * dx - b * dy) / det;
	const py = (-c * dx + a * dy) / det;
	return [px, py];
}
