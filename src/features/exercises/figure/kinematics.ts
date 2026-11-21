/**
 * Motor de la figura de técnica (lógica pura, sin React).
 *
 * La figura es un esqueleto 2D en vista lateral que mira hacia +x (derecha).
 * Coordenadas de pantalla: y crece hacia abajo.
 * Todas las animaciones usan este mismo esqueleto, con las mismas proporciones,
 * grosores y colores: el estilo es idéntico en todos los ejercicios.
 */

export interface Vec {
  x: number;
  y: number;
}

export const BONES = {
  torso: 52, // cadera → hombro
  neck: 7,
  headR: 9,
  upperArm: 30,
  forearm: 28,
  thigh: 42,
  shin: 42,
  foot: 10,
} as const;

/**
 * Extremidad definida por ángulos o por un objetivo (cinemática inversa).
 * - `angle`: ángulo absoluto del segmento superior respecto de la vertical hacia abajo
 *   (0 = colgando; positivo = hacia delante). `flex`: flexión de la articulación media (0 = recta).
 * - `target`: punto donde debe quedar la mano o el pie (barra, suelo…). `bend` elige hacia
 *   dónde se dobla la articulación media: 'back' (codo atrás) o 'front' (rodilla delante).
 */
export type Limb =
  | { angle: number; flex: number }
  | { target: Vec; bend: 'front' | 'back' };

export interface Pose {
  hip: Vec;
  /** Inclinación del tronco respecto de la vertical (+ = hacia delante). */
  torso: number;
  /** Inclinación de la cabeza respecto del tronco (+ = mentón hacia el pecho). */
  head: number;
  /** [lado cercano, lado lejano] */
  arms: [Limb, Limb];
  legs: [Limb, Limb];
}

export type SegmentKind = 'torso' | 'neck' | 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'foot';

export interface Segment {
  kind: SegmentKind;
  side: 'near' | 'far' | 'center';
  from: Vec;
  to: Vec;
}

export interface FigureGeometry {
  segments: Segment[];
  head: { c: Vec; r: number };
  joints: Array<{ p: Vec; side: 'near' | 'far' | 'center' }>;
  /** Posiciones útiles para dibujar accesorios (mancuernas en las manos, etc.). */
  hands: [Vec, Vec];
  feet: [Vec, Vec];
  shoulder: Vec;
  hip: Vec;
}

const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
/** Vector de longitud `len` con ángulo `deg` desde la vertical hacia abajo (+ hacia delante). */
const down = (deg: number, len: number): Vec => ({ x: Math.sin(rad(deg)) * len, y: Math.cos(rad(deg)) * len });
/** Igual, pero desde la vertical hacia arriba. */
const up = (deg: number, len: number): Vec => ({ x: Math.sin(rad(deg)) * len, y: -Math.cos(rad(deg)) * len });

/** Cinemática inversa de dos huesos. Si el objetivo está fuera de alcance, la extremidad se estira hacia él. */
export function solveTwoBone(base: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1): { mid: Vec; end: Vec } {
  const dx = target.x - base.x;
  const dy = target.y - base.y;
  const raw = Math.hypot(dx, dy);
  if (raw >= l1 + l2) {
    // Fuera de alcance: extremidad completamente estirada hacia el objetivo.
    const ux = dx / raw;
    const uy = dy / raw;
    return {
      mid: { x: base.x + ux * l1, y: base.y + uy * l1 },
      end: { x: base.x + ux * (l1 + l2), y: base.y + uy * (l1 + l2) },
    };
  }
  const d = Math.max(raw, Math.abs(l1 - l2) + 1e-3);
  const theta = Math.atan2(dy, dx);
  const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const mid = { x: base.x + l1 * Math.cos(theta + bend * a), y: base.y + l1 * Math.sin(theta + bend * a) };
  return { mid, end: target };
}

function limb(base: Vec, spec: Limb, l1: number, l2: number, kind: 'arm' | 'leg'): { mid: Vec; end: Vec } {
  if ('target' in spec) {
    // En pantalla (y hacia abajo), girar +a es sentido horario. Para una extremidad que
    // apunta hacia abajo, horario = la articulación media se desplaza hacia -x (atrás).
    const goingDown = spec.target.y >= base.y;
    const backIsPlus = goingDown;
    const sign: 1 | -1 = (spec.bend === 'back') === backIsPlus ? 1 : -1;
    return solveTwoBone(base, spec.target, l1, l2, sign);
  }
  const mid = add(base, down(spec.angle, l1));
  // El codo flexiona el antebrazo hacia delante; la rodilla flexiona la pierna hacia atrás.
  const lowerAngle = kind === 'arm' ? spec.angle + spec.flex : spec.angle - spec.flex;
  return { mid, end: add(mid, down(lowerAngle, l2)) };
}

export function buildFigure(pose: Pose): FigureGeometry {
  const hip = pose.hip;
  const shoulder = add(hip, up(pose.torso, BONES.torso));
  const neckTop = add(shoulder, up(pose.torso + pose.head, BONES.neck));
  const headC = add(neckTop, up(pose.torso + pose.head, BONES.headR));

  const segments: Segment[] = [];
  const joints: FigureGeometry['joints'] = [];
  const hands: Vec[] = [];
  const feet: Vec[] = [];

  (['far', 'near'] as const).forEach((side) => {
    const i = side === 'near' ? 0 : 1;
    const leg = limb(hip, pose.legs[i]!, BONES.thigh, BONES.shin, 'leg');
    const shinDir = Math.atan2(leg.end.y - leg.mid.y, leg.end.x - leg.mid.x);
    // El pie sale perpendicular a la tibia, hacia delante.
    const footDir = shinDir - Math.PI / 2;
    const toe = { x: leg.end.x + Math.cos(footDir) * BONES.foot, y: leg.end.y + Math.sin(footDir) * BONES.foot };
    segments.push({ kind: 'thigh', side, from: hip, to: leg.mid });
    segments.push({ kind: 'shin', side, from: leg.mid, to: leg.end });
    segments.push({ kind: 'foot', side, from: leg.end, to: toe });
    joints.push({ p: leg.mid, side });
    feet[i] = leg.end;
  });

  segments.push({ kind: 'torso', side: 'center', from: hip, to: shoulder });
  segments.push({ kind: 'neck', side: 'center', from: shoulder, to: neckTop });

  (['far', 'near'] as const).forEach((side) => {
    const i = side === 'near' ? 0 : 1;
    const arm = limb(shoulder, pose.arms[i]!, BONES.upperArm, BONES.forearm, 'arm');
    segments.push({ kind: 'upperArm', side, from: shoulder, to: arm.mid });
    segments.push({ kind: 'forearm', side, from: arm.mid, to: arm.end });
    joints.push({ p: arm.mid, side });
    hands[i] = arm.end;
  });

  joints.push({ p: hip, side: 'center' }, { p: shoulder, side: 'center' });

  return {
    segments,
    head: { c: headC, r: BONES.headR },
    joints,
    hands: [hands[0]!, hands[1]!],
    feet: [feet[0]!, feet[1]!],
    shoulder,
    hip,
  };
}

// ─── Interpolación ───────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

function lerpLimb(a: Limb, b: Limb, t: number): Limb {
  if ('target' in a && 'target' in b) return { target: lerpV(a.target, b.target, t), bend: a.bend };
  if ('angle' in a && 'angle' in b) return { angle: lerp(a.angle, b.angle, t), flex: lerp(a.flex, b.flex, t) };
  return t < 0.5 ? a : b; // tipos distintos: cambio discreto (evitar en los datos)
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpV(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head, b.head, t),
    arms: [lerpLimb(a.arms[0], b.arms[0], t), lerpLimb(a.arms[1], b.arms[1], t)],
    legs: [lerpLimb(a.legs[0], b.legs[0], t), lerpLimb(a.legs[1], b.legs[1], t)],
  };
}

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export interface Keyframe {
  pose: Pose;
  /** Tiempo (ms) de transición DESDE el keyframe anterior hasta este. */
  moveMs: number;
  /** Tiempo (ms) que se mantiene esta posición. */
  holdMs: number;
  /** Fase que se muestra al usuario mientras se llega a este keyframe y se mantiene. */
  phase: string;
}

export function cycleDuration(frames: Keyframe[]): number {
  return frames.reduce((s, f) => s + f.moveMs + f.holdMs, 0);
}

/** Pose y fase en el instante `ms` de un ciclo en bucle (el último keyframe vuelve al primero). */
export function sampleTimeline(frames: Keyframe[], ms: number): { pose: Pose; phase: string; index: number } {
  const total = cycleDuration(frames);
  let t = ((ms % total) + total) % total;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    const prev = frames[(i - 1 + frames.length) % frames.length]!;
    if (t < f.moveMs) return { pose: lerpPose(prev.pose, f.pose, easeInOut(t / f.moveMs)), phase: f.phase, index: i };
    t -= f.moveMs;
    if (t < f.holdMs) return { pose: f.pose, phase: f.phase, index: i };
    t -= f.holdMs;
  }
  const last = frames[frames.length - 1]!;
  return { pose: last.pose, phase: last.phase, index: frames.length - 1 };
}
