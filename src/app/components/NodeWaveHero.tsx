import { useEffect, useRef } from "react";
import { mat4, vec3 } from "gl-matrix";
import { WAVE_PARAMS, WAVE_STEEPNESS, floatMotion } from "../lib/gerstner.js";
import nodeWireUrl from "../assets/node_wire.bin?url";
import nodeWireMeta from "../assets/node_wire.json";
import styles from "./NodeWaveHero.module.css";

/**
 * Home-page hero: the Panthalassa node as a sparse wireframe, riding a
 * wireframe Gerstner sea, seen in perspective from a camera low over the
 * water so the sea converges to a true horizon. The sea is displaced in the
 * vertex shader; the node's heave and pitch come from the same wave field
 * evaluated on the CPU under the float (see lib/gerstner.ts). No depth
 * test: everything is translucent and the far side of the node is dimmed.
 *
 * The sea starts just in front of the node, so its near edge is a wavy
 * cut-off line through the float and nothing is drawn over the submerged
 * part. Rows are spaced by their height on screen so they run right up to
 * the horizon without aliasing; columns converge on the vanishing point and
 * fade just before they bunch up. With SEA_FACES on, an opaque surface mesh
 * under the wires closes the last sliver so sea and sky meet with a hard
 * edge.
 *
 * The node line list is exported from the Blender model by
 * scripts/export_node_wire.py (metres, +Z up, float at the top).
 */

type NodeWaveHeroProps = {
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

/** Model z of the mean water line. The float centre sits at z = 63.9. */
export const WATER_Z = 62;
/** Fraction of the canvas height, from the top, where the horizon sits. */
export const HORIZON_FRAC = 0.4;

const PIVOT_Z = 46;                          // model z the node pitches about
const SWAY_GAIN = 0.4;                       // how fully the node follows the surface slope; a spar buoy barely tilts
const FLOAT_SAMPLE_R = 4.5;                  // m, footprint the sway is averaged over

const CAM_HEIGHT = 16;                       // m above the mean water line
const CAM_DISTANCE = 190;                    // m horizontally from the node
const FOV_Y = (40 * Math.PI) / 180;          // vertical field of view
const TILT = Math.atan2(CAM_HEIGHT, CAM_DISTANCE);   // optical axis points at the node's water line
const CAM_DIST = Math.hypot(CAM_HEIGHT, CAM_DISTANCE);
const NODE_NDC_X_WIDE = 0.45;                // node sits right of centre on wide canvases (lens shift)
const WIDE_ASPECT = 1.1;
const ZOOM_MAX = 1.5;                        // a 16:9 canvas is framed 1.5x tighter than a phone, so the node fills the width it has
const MAX_ASPECT = 2.4;                      // widest canvas the grid is sized for
const SPIN_RAD_PER_S = (2 * Math.PI) / 150;  // slow turntable
const INITIAL_SPIN = (-35 * Math.PI) / 180;
const MAX_DPR = 1.5;

const GRID_NEAR = -6;                        // m in front of the node where the sea is cut off
const GRID_SPACING = 8;                      // m between grid lines at the cut-off
const GRID_STEP = 4;                         // m between vertices along a line, near the node
const STEP_GROWTH = 0.02;                    // vertex spacing grows to this fraction of the distance from the camera
const ROW_MIN_SCREEN = 0.004;                // NDC; rows never get closer on screen than this, so they reach the horizon without aliasing
const GRID_COL_FAR = 5000;                   // m behind the node where the columns end
const FACE_FAR = 400_000;                    // m, the last face row is within a pixel of the horizon line

/** Column fade along the camera's depth axis, metres behind the node: opaque until [0], gone by [1]. */
const COL_FADE: [number, number] = [2500, 5000];
const NODE_DEPTH_DIM = 0.55;

/**
 * Experiment: draw the sea as opaque faces under the wires, so it meets
 * the sky with a hard edge at the horizon instead of fading into haze.
 */
const SEA_FACES = true;
const FACE_HAZE_RANGE: [number, number] = [500, 8000];  // m behind the node over which faces tint toward the haze colour

const NODE_COLOR: [number, number, number, number] = [0.953, 0.953, 0.953, 0.82];  // Smoke White
const WAVE_COLOR: [number, number, number, number] = [0.953, 0.953, 0.953, 0.42];  // Smoke White
const SEA_FACE_COLOR: [number, number, number, number] = [0.071, 0.071, 0.071, 1.0];  // Cod Gray
const SEA_HAZE_COLOR: [number, number, number] = [0.36, 0.36, 0.36];  // Cod Gray tint toward the sky
const FAR_PLANE = 400_000;

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const WAVE_COUNT = WAVE_PARAMS.length;

const line_vs = `#version 300 es
in vec3 a_pos;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_proj;
uniform float u_camDist;
uniform int u_isWave;
uniform float u_time;
uniform vec2 u_dir[${WAVE_COUNT}];
uniform float u_k[${WAVE_COUNT}];
uniform float u_amp[${WAVE_COUNT}];
uniform float u_omega[${WAVE_COUNT}];
uniform float u_steep;

out float v_dist;   // view depth relative to the node; positive is farther

void main() {
  vec3 p = a_pos;
  if (u_isWave == 1) {
    vec3 d = vec3(0.0);
    for (int i = 0; i < ${WAVE_COUNT}; i++) {
      float phase = u_k[i] * dot(u_dir[i], a_pos.xy) - u_omega[i] * u_time;
      d.xy += u_steep * u_amp[i] * u_dir[i] * cos(phase);
      d.z += u_amp[i] * sin(phase);
    }
    p += d;
  }
  vec4 view = u_view * u_model * vec4(p, 1.0);
  v_dist = -view.z - u_camDist;
  gl_Position = u_proj * view;
}
`;

const line_fs = `#version 300 es
precision highp float;

in float v_dist;

uniform vec4 u_color;      // straight alpha
uniform vec4 u_fade;       // nearEnd, nearStart, farStart, farEnd (metres)
uniform float u_depthDim;  // how much to dim the far side (0..1)
uniform vec3 u_hazeColor;  // colour the surface tints toward with distance
uniform vec2 u_hazeRange;  // metres behind the node where the tint starts / completes

out vec4 o_color;

void main() {
  float near = smoothstep(u_fade.x, u_fade.y, v_dist);
  float far = 1.0 - smoothstep(u_fade.z, u_fade.w, v_dist);
  float dim = 1.0 - u_depthDim * smoothstep(-8.0, 8.0, v_dist);
  vec3 rgb = mix(u_color.rgb, u_hazeColor, smoothstep(u_hazeRange.x, u_hazeRange.y, v_dist));
  float a = u_color.a * near * far * dim;
  o_color = vec4(rgb * a, a);   // premultiplied
}
`;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/** Unquantize the exported int16 line list into model-space metres. */
function decodeNodeWire(buf: ArrayBuffer): Float32Array {
  const q = new Int16Array(buf);
  const out = new Float32Array(q.length);
  const { min, max } = nodeWireMeta;
  for (let i = 0; i < q.length; i++) {
    const axis = i % 3;
    out[i] = min[axis]! + ((q[i]! + 32768) / 65535) * (max[axis]! - min[axis]!);
  }
  return out;
}

/**
 * Half-width of the canvas, in metres, at `y` metres behind the node, for
 * the widest supported canvas with the node lens-shifted to the right.
 */
function visibleHalfWidth(y: number): number {
  return 1.1 * (1 + NODE_NDC_X_WIDE) * Math.tan(FOV_Y / 2) * MAX_ASPECT * (CAM_DISTANCE + y);
}

/** How far below the horizon, in NDC, a point on the mean water plane `d` metres from the camera projects. */
function dropBelowHorizon(d: number): number {
  return (Math.tan(TILT) + Math.tan(Math.atan(CAM_HEIGHT / d) - TILT)) / Math.tan(FOV_Y / 2);
}

/** Inverse of dropBelowHorizon. */
function distanceForDrop(u: number): number {
  return CAM_HEIGHT / Math.tan(TILT + Math.atan(u * Math.tan(FOV_Y / 2) - Math.tan(TILT)));
}

/** Vertex spacing along a line `y` metres behind the node: GRID_STEP near, growing with distance. */
function stepAt(y: number): number {
  return Math.max(GRID_STEP, STEP_GROWTH * (CAM_DISTANCE + y));
}

type SeaRow = { y: number; xs: number[] };

function rowXs(y: number): number[] {
  const step = stepAt(y);
  const half = Math.ceil(visibleHalfWidth(y) / step) * step;
  const xs: number[] = [];
  for (let x = -half; x <= half + 1e-6; x += step) xs.push(x);
  return xs;
}

/**
 * Rows of the sea, from the cut-off out to the horizon. Rows are placed by
 * their height on screen: GRID_SPACING metres apart at the cut-off, then
 * closing up toward the horizon but never below ROW_MIN_SCREEN, so the last
 * row sits just under the sky and nothing aliases.
 */
function buildSeaRows(): SeaRow[] {
  const u0 = dropBelowHorizon(CAM_DISTANCE + GRID_NEAR);
  const sNear = u0 - dropBelowHorizon(CAM_DISTANCE + GRID_NEAR + GRID_SPACING);
  const rows: SeaRow[] = [];
  let u = u0;
  while (u > ROW_MIN_SCREEN * 0.5) {
    const y = distanceForDrop(u) - CAM_DISTANCE;
    rows.push({ y, xs: rowXs(y) });
    u -= ROW_MIN_SCREEN + (sNear - ROW_MIN_SCREEN) * (u / u0);
  }
  return rows;
}

type SeaGrid = { data: Float32Array; rowVertices: number; colVertices: number };

/**
 * Sea wires as a LINES list; the shader displaces it. Rows come first,
 * then columns, so the two can be drawn with different fades. Columns
 * take their vertices from the row positions (subdivided near the camera)
 * and only start where they can be on screen.
 */
function buildSeaGrid(rows: SeaRow[]): SeaGrid {
  const out: number[] = [];
  for (const { y, xs } of rows) {
    for (let i = 0; i < xs.length - 1; i++) out.push(xs[i]!, y, 0, xs[i + 1]!, y, 0);
  }
  const rowVertices = out.length / 3;

  const ys = rows.map((r) => r.y).filter((y) => y <= GRID_COL_FAR);
  const colHalf = Math.ceil(visibleHalfWidth(GRID_COL_FAR) / GRID_SPACING) * GRID_SPACING;
  for (let x = -colHalf; x <= colHalf + 1e-6; x += GRID_SPACING) {
    // the column first enters the frame at this depth
    const yEnter = Math.abs(x) / (visibleHalfWidth(0) / CAM_DISTANCE) - CAM_DISTANCE - 2 * GRID_SPACING;
    for (let r = 0; r < ys.length - 1; r++) {
      const ya = ys[r]!;
      const yb = ys[r + 1]!;
      if (yb < yEnter) continue;
      const n = Math.max(1, Math.ceil((yb - ya) / stepAt(ya)));
      for (let k = 0; k < n; k++) {
        out.push(x, ya + ((yb - ya) * k) / n, 0, x, ya + ((yb - ya) * (k + 1)) / n, 0);
      }
    }
  }
  return { data: new Float32Array(out), rowVertices, colVertices: out.length / 3 - rowVertices };
}

/**
 * Sea surface as a triangle list under the wires, on the same rows plus a
 * final row at FACE_FAR that closes the last sliver up to the horizon.
 */
function buildSeaFaces(rows: SeaRow[]): Float32Array {
  const out: number[] = [];
  const all = [...rows, { y: FACE_FAR, xs: rowXs(FACE_FAR) }];
  for (let r = 0; r < all.length - 1; r++) {
    const { y: y0, xs: xs0 } = all[r]!;
    const { y: y1, xs: xs1 } = all[r + 1]!;
    // stitch the two rows as a strip: walk both rows by x
    let i = 0;
    let j = 0;
    while (i < xs0.length - 1 || j < xs1.length - 1) {
      const advance0 = j >= xs1.length - 1 || (i < xs0.length - 1 && xs0[i + 1]! <= xs1[j + 1]!);
      if (advance0) {
        out.push(xs0[i]!, y0, 0, xs0[i + 1]!, y0, 0, xs1[j]!, y1, 0);
        i++;
      } else {
        out.push(xs0[i]!, y0, 0, xs1[j + 1]!, y1, 0, xs1[j]!, y1, 0);
        j++;
      }
    }
  }
  return new Float32Array(out);
}

function compileProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(`shader compile failed: ${gl.getShaderInfoLog(s)}`);
    }
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

function makeLineVao(gl: WebGL2RenderingContext, program: WebGLProgram, data: Float32Array) {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, count: data.length / 3 };
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

const TARGET: vec3 = [0, 0, WATER_Z];

function buildView(): mat4 {
  const eye: vec3 = [0, -CAM_DISTANCE, WATER_Z + CAM_HEIGHT];
  return mat4.lookAt(mat4.create(), eye, TARGET, [0, 0, 1]);
}

/**
 * Perspective projection with a lens shift: the horizon (the horizontal
 * direction, which sits TILT above the optical axis) is moved to
 * HORIZON_FRAC from the top, and on wide canvases the node is moved right
 * of centre. Shifting in clip space keeps the horizon level.
 */
function buildProjection(aspect: number): mat4 {
  const fovY = 2 * Math.atan(Math.tan(FOV_Y / 2) / zoomFor(aspect));
  const proj = mat4.perspective(mat4.create(), fovY, aspect, 1, FAR_PLANE);
  const horizonUnshifted = Math.tan(TILT) / Math.tan(fovY / 2);
  const shiftY = 1 - 2 * HORIZON_FRAC - horizonUnshifted;
  const shiftX = aspect >= WIDE_ASPECT ? NODE_NDC_X_WIDE : 0;
  const shift = mat4.fromTranslation(mat4.create(), [shiftX, shiftY, 0]);
  return mat4.multiply(mat4.create(), shift, proj);
}

/**
 * Screen-space magnification by aspect. Portrait canvases use the full FOV_Y;
 * the frame tightens as the canvas widens, so the node keeps a similar share of
 * the width instead of shrinking into an empty sea. The sea geometry is built
 * for the wide FOV, so zooming in only ever shows less of it.
 */
function zoomFor(aspect: number): number {
  return Math.min(ZOOM_MAX, Math.max(1, aspect / WIDE_ASPECT));
}

/** Node transform: turntable spin, then pitch about PIVOT_Z, then ride the surface. */
function buildNodeModel(out: mat4, t: number, spin: number, animate: boolean): mat4 {
  mat4.identity(out);
  if (animate) {
    const m = floatMotion(FLOAT_SAMPLE_R, t);
    const rx = Math.atan(m.slopeY) * SWAY_GAIN;
    const ry = -Math.atan(m.slopeX) * SWAY_GAIN;
    mat4.translate(out, out, [m.surge, m.swayY, m.heave]);
    mat4.translate(out, out, [0, 0, PIVOT_Z]);
    mat4.rotateX(out, out, rx);
    mat4.rotateY(out, out, ry);
    mat4.translate(out, out, [0, 0, -PIVOT_Z]);
  }
  mat4.rotateZ(out, out, spin);
  return out;
}

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

class HeroRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private sea: { vao: WebGLVertexArrayObject; rowVertices: number; colVertices: number };
  private faces: { vao: WebGLVertexArrayObject; count: number } | null = null;
  private node: { vao: WebGLVertexArrayObject; count: number } | null = null;

  private view = buildView();
  private proj = mat4.create();
  private nodeModel = mat4.create();
  private seaModel = mat4.fromTranslation(mat4.create(), [0, 0, WATER_Z]);

  private u: Record<string, WebGLUniformLocation | null>;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = compileProgram(gl, line_vs, line_fs);
    const names = [
      "u_model", "u_view", "u_proj", "u_camDist", "u_isWave", "u_time", "u_steep",
      "u_color", "u_fade", "u_depthDim", "u_hazeColor", "u_hazeRange",
    ];
    this.u = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(this.program, n)]));

    const rows = buildSeaRows();
    const grid = buildSeaGrid(rows);
    this.sea = { ...makeLineVao(gl, this.program, grid.data), rowVertices: grid.rowVertices, colVertices: grid.colVertices };
    if (SEA_FACES) this.faces = makeLineVao(gl, this.program, buildSeaFaces(rows));

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.u.u_view!, false, this.view);
    gl.uniform1f(this.u.u_camDist!, CAM_DIST);
    gl.uniform1f(this.u.u_steep!, WAVE_STEEPNESS);
    gl.uniform2fv(gl.getUniformLocation(this.program, "u_dir"), WAVE_PARAMS.flatMap((w) => [w.dirX, w.dirY]));
    gl.uniform1fv(gl.getUniformLocation(this.program, "u_k"), WAVE_PARAMS.map((w) => w.k));
    gl.uniform1fv(gl.getUniformLocation(this.program, "u_amp"), WAVE_PARAMS.map((w) => w.amplitude));
    gl.uniform1fv(gl.getUniformLocation(this.program, "u_omega"), WAVE_PARAMS.map((w) => w.omega));

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // Everything is premultiplied, composited "over" the page background.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  setNode(positions: Float32Array) {
    this.node = makeLineVao(this.gl, this.program, positions);
  }

  setAspect(aspect: number) {
    this.proj = buildProjection(aspect);
  }

  render(t: number, spin: number, animate: boolean, width: number, height: number) {
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.u.u_proj!, false, this.proj);
    gl.uniform1f(this.u.u_time!, t);

    // sea surface, opaque out to the horizon
    gl.uniformMatrix4fv(this.u.u_model!, false, this.seaModel);
    gl.uniform1i(this.u.u_isWave!, 1);
    gl.uniform1f(this.u.u_depthDim!, 0);
    gl.uniform4f(this.u.u_fade!, -1e9, -1e9 + 1, 1e9 - 1, 1e9);
    if (this.faces) {
      gl.uniform4f(this.u.u_color!, ...SEA_FACE_COLOR);
      gl.uniform3f(this.u.u_hazeColor!, ...SEA_HAZE_COLOR);
      gl.uniform2f(this.u.u_hazeRange!, ...FACE_HAZE_RANGE);
      gl.bindVertexArray(this.faces.vao);
      gl.drawArrays(gl.TRIANGLES, 0, this.faces.count);
    }

    // sea wires: rows run to the horizon, columns fade before they bunch at the vanishing point
    gl.uniform4f(this.u.u_color!, ...WAVE_COLOR);
    gl.uniform2f(this.u.u_hazeRange!, 1e9, 2e9);
    gl.bindVertexArray(this.sea.vao);
    gl.drawArrays(gl.LINES, 0, this.sea.rowVertices);
    gl.uniform4f(this.u.u_fade!, -1e9, -1e9 + 1, ...COL_FADE);
    gl.drawArrays(gl.LINES, this.sea.rowVertices, this.sea.colVertices);

    // node, far side dimmed
    if (this.node) {
      buildNodeModel(this.nodeModel, t, spin, animate);
      gl.uniformMatrix4fv(this.u.u_model!, false, this.nodeModel);
      gl.uniform1i(this.u.u_isWave!, 0);
      gl.uniform4f(this.u.u_color!, ...NODE_COLOR);
      gl.uniform4f(this.u.u_fade!, -1e4, -1e4 + 1, 1e4 - 1, 1e4);
      gl.uniform1f(this.u.u_depthDim!, NODE_DEPTH_DIM);
      gl.bindVertexArray(this.node.vao);
      gl.drawArrays(gl.LINES, 0, this.node.count);
    }
    gl.bindVertexArray(null);
  }

  cleanup() {
    // Deliberately no loseContext(): React StrictMode remounts the effect and
    // getContext would hand the fresh mount the same, now lost, context.
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.sea.vao);
    if (this.faces) gl.deleteVertexArray(this.faces.vao);
    if (this.node) gl.deleteVertexArray(this.node.vao);
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function NodeWaveHero({ className }: NodeWaveHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true });
    let renderer: HeroRenderer | null = null;
    if (gl) {
      try {
        renderer = new HeroRenderer(gl);
      } catch (e) {
        console.error("NodeWaveHero: WebGL setup failed", e);
      }
    }

    // --- sizing --------------------------------------------------------
    let width = 1;
    let height = 1;
    let needsFrame = true;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      renderer?.setAspect(width / height);
      needsFrame = true;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    // --- model ---------------------------------------------------------
    let cancelled = false;
    if (renderer) {
      fetch(nodeWireUrl)
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          if (cancelled || !renderer) return;
          renderer.setNode(decodeNodeWire(buf));
          needsFrame = true;
        })
        .catch((e) => console.error("NodeWaveHero: failed to load node wire", e));
    }

    // --- loop ----------------------------------------------------------
    let visible = true;
    const intersection = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    intersection.observe(canvas);

    const loadedAt = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!renderer) return;
      if ((visible && !reducedMotion) || needsFrame) {
        needsFrame = false;
        const t = reducedMotion ? 0 : (now - loadedAt) / 1000;
        renderer.render(t, INITIAL_SPIN + t * SPIN_RAD_PER_S, !reducedMotion, width, height);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      renderer?.cleanup();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.canvas} ${className ?? ""}`}
      aria-label="Wireframe of a Panthalassa wave-power node floating upright in animated waves."
    />
  );
}
