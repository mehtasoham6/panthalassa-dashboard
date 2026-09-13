/**
 * Deep-water Gerstner wave field shared by the home-page hero.
 *
 * The vertex shader in NodeWaveHero displaces the wireframe sea with exactly
 * these components (fed as uniforms), and the CPU side evaluates the same
 * field under the float so the node heaves and pitches with the water it is
 * drawn in. Coordinates are metres in the node's frame: the sea lies in the
 * XY plane and +Z is up.
 */

export type WaveComponent = {
  /** Propagation direction in the XY plane, radians from +X. */
  direction: number;
  /** Crest-to-crest wavelength, metres. */
  wavelength: number;
  /** Amplitude, metres (half the trough-to-crest height). */
  amplitude: number;
};

const deg = (d: number) => (d * Math.PI) / 180;

export const GRAVITY = 9.81;

/** Fraction of the maximum Gerstner steepness; 0 gives plain sine waves. */
export const WAVE_STEEPNESS = 0.55;

/** One long swell, a crossing sea, and two ripple components for texture. */
export const WAVES: readonly WaveComponent[] = [
  { direction: deg(20), wavelength: 52, amplitude: 1.1 },
  { direction: deg(-38), wavelength: 29, amplitude: 0.55 },
  { direction: deg(72), wavelength: 15, amplitude: 0.25 },
  { direction: deg(-8), wavelength: 7.5, amplitude: 0.09 },
];

export type WaveParams = {
  dirX: number;
  dirY: number;
  k: number;
  omega: number;
  amplitude: number;
};

/** Wavenumber and deep-water angular frequency for each component. */
export const WAVE_PARAMS: readonly WaveParams[] = WAVES.map((w) => {
  const k = (2 * Math.PI) / w.wavelength;
  return {
    dirX: Math.cos(w.direction),
    dirY: Math.sin(w.direction),
    k,
    omega: Math.sqrt(GRAVITY * k),
    amplitude: w.amplitude,
  };
});

export type SurfaceSample = {
  /** Vertical displacement, metres. */
  height: number;
  /** Horizontal Gerstner displacement, metres. */
  shiftX: number;
  shiftY: number;
};

/**
 * Surface displacement at the undisplaced grid position (x, y). This is the
 * same formula the shader applies to each grid vertex.
 */
export function sampleSurface(x: number, y: number, t: number): SurfaceSample {
  let height = 0;
  let shiftX = 0;
  let shiftY = 0;
  for (const w of WAVE_PARAMS) {
    const phase = w.k * (w.dirX * x + w.dirY * y) - w.omega * t;
    const c = Math.cos(phase);
    height += w.amplitude * Math.sin(phase);
    shiftX += WAVE_STEEPNESS * w.amplitude * w.dirX * c;
    shiftY += WAVE_STEEPNESS * w.amplitude * w.dirY * c;
  }
  return { height, shiftX, shiftY };
}

export type FloatMotion = {
  heave: number;
  surge: number;
  swayY: number;
  /** Surface slope across the float footprint, rise over run. */
  slopeX: number;
  slopeY: number;
};

/**
 * Water motion averaged over a float of radius `r` centred on the origin:
 * the mean displacement of five samples, and the slope across the footprint.
 * Averaging drops ripples shorter than the float, which a large buoy would
 * not follow anyway.
 */
export function floatMotion(r: number, t: number): FloatMotion {
  const c = sampleSurface(0, 0, t);
  const px = sampleSurface(r, 0, t);
  const nx = sampleSurface(-r, 0, t);
  const py = sampleSurface(0, r, t);
  const ny = sampleSurface(0, -r, t);
  const all = [c, px, nx, py, ny];
  const mean = (f: (s: SurfaceSample) => number) => all.reduce((acc, s) => acc + f(s), 0) / all.length;
  return {
    heave: mean((s) => s.height),
    surge: mean((s) => s.shiftX),
    swayY: mean((s) => s.shiftY),
    slopeX: (px.height - nx.height) / (2 * r),
    slopeY: (py.height - ny.height) / (2 * r),
  };
}
