/**
 * Convierte una pose en primitivas de dibujo (líneas, círculos, rectángulos) con un
 * único estilo visual. Lo usan tanto el componente de la app (react-native-svg) como
 * el generador de vistas previas de las pruebas: lo que se revisa en PNG es lo que se ve en el teléfono.
 */
import { buildFigure, type FigureGeometry, type Pose, type Segment, type Vec } from './kinematics';

export type Muscle =
  | 'chest'
  | 'triceps'
  | 'biceps'
  | 'frontDelts'
  | 'lats'
  | 'upperBack'
  | 'core'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export type Prop =
  | { type: 'floor'; y: number }
  | { type: 'parallelBars'; at: Vec }
  | { type: 'pullupBar'; at: Vec }
  | { type: 'bench'; x: number; y: number; width: number; height: number }
  | { type: 'dumbbells'; only?: 'near' }
  /** Barra olímpica vista de lado: el disco se ve como un círculo centrado en las manos. */
  | { type: 'barbell' }
  /** Polea: punto de anclaje y cable hasta la mano cercana. */
  | { type: 'cable'; anchor: Vec }
  /** Pieza fija genérica (asiento, almohadilla, respaldo): un segmento grueso. */
  | { type: 'pad'; a: Vec; b: Vec; w?: number };

export const FIGURE_STYLE = {
  body: '#22D3EE',
  bodyFar: '#22D3EE',
  farOpacity: 0.38,
  highlight: '#8B5CF6',
  prop: '#94A3B8',
  propOpacity: 0.55,
  grid: 'rgba(148,163,184,0.08)',
  width: { torso: 9, neck: 6, upperArm: 7, forearm: 6, thigh: 8, shin: 7, foot: 5 },
} as const;

export type Primitive =
  | { k: 'line'; a: Vec; b: Vec; w: number; color: string; opacity: number; glow?: boolean }
  | { k: 'circle'; c: Vec; r: number; stroke: string; fill: string; w: number; opacity: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; rx: number; color: string; opacity: number };

/** Qué porción de qué segmento resalta cada músculo, y hacia qué lado (normal) se desplaza. */
const MUSCLE_MAP: Record<Muscle, { kind: Segment['kind']; from: number; to: number; side: 1 | -1 }> = {
  chest: { kind: 'torso', from: 0.62, to: 0.9, side: 1 },
  core: { kind: 'torso', from: 0.12, to: 0.55, side: 1 },
  lats: { kind: 'torso', from: 0.45, to: 0.85, side: -1 },
  upperBack: { kind: 'torso', from: 0.72, to: 0.96, side: -1 },
  frontDelts: { kind: 'upperArm', from: 0.0, to: 0.3, side: 1 },
  biceps: { kind: 'upperArm', from: 0.3, to: 0.9, side: 1 },
  triceps: { kind: 'upperArm', from: 0.2, to: 0.9, side: -1 },
  glutes: { kind: 'thigh', from: 0.0, to: 0.3, side: -1 },
  quads: { kind: 'thigh', from: 0.2, to: 0.9, side: 1 },
  hamstrings: { kind: 'thigh', from: 0.25, to: 0.9, side: -1 },
  calves: { kind: 'shin', from: 0.15, to: 0.55, side: -1 },
};

const along = (s: Segment, t: number): Vec => ({ x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t });

/**
 * Normal "frontal" del segmento. El tronco mira hacia +x; las extremidades usan
 * como frente el lado hacia el que mira el cuerpo, calculado de forma estable.
 */
function frontNormal(s: Segment, facing: Vec): Vec {
  const dx = s.to.x - s.from.x;
  const dy = s.to.y - s.from.y;
  const len = Math.hypot(dx, dy) || 1;
  let n = { x: -dy / len, y: dx / len };
  if (n.x * facing.x + n.y * facing.y < 0) n = { x: -n.x, y: -n.y };
  return n;
}

export function buildScene(pose: Pose, opts: { props: Prop[]; muscles: Muscle[] }): { prims: Primitive[]; fig: FigureGeometry } {
  const fig = buildFigure(pose);
  const S = FIGURE_STYLE;
  const prims: Primitive[] = [];

  // Dirección "hacia delante" del cuerpo = perpendicular al tronco, hacia +x.
  const tdx = fig.shoulder.x - fig.hip.x;
  const tdy = fig.shoulder.y - fig.hip.y;
  const tl = Math.hypot(tdx, tdy) || 1;
  const facing = { x: -tdy / tl, y: tdx / tl };
  if (facing.x < 0) {
    facing.x *= -1;
    facing.y *= -1;
  }

  // 1. Accesorios del fondo
  for (const p of opts.props) {
    if (p.type === 'floor') {
      prims.push({ k: 'line', a: { x: -20, y: p.y }, b: { x: 400, y: p.y }, w: 2, color: S.prop, opacity: S.propOpacity });
    } else if (p.type === 'parallelBars') {
      // Vista lateral: la barra se ve como un círculo sobre un poste.
      prims.push({ k: 'line', a: { x: p.at.x, y: p.at.y }, b: { x: p.at.x, y: 400 }, w: 4, color: S.prop, opacity: S.propOpacity * 0.6 });
      prims.push({ k: 'circle', c: p.at, r: 5, stroke: S.prop, fill: '#0B1020', w: 2.5, opacity: 0.9 });
    } else if (p.type === 'pullupBar') {
      prims.push({ k: 'line', a: { x: -20, y: p.at.y }, b: { x: p.at.x, y: p.at.y }, w: 3, color: S.prop, opacity: S.propOpacity * 0.6 });
      prims.push({ k: 'circle', c: p.at, r: 5, stroke: S.prop, fill: '#0B1020', w: 2.5, opacity: 0.9 });
    } else if (p.type === 'pad') {
      prims.push({ k: 'line', a: p.a, b: p.b, w: p.w ?? 8, color: S.prop, opacity: S.propOpacity });
    } else if (p.type === 'cable') {
      const h = fig.hands[0];
      prims.push({ k: 'line', a: p.anchor, b: h, w: 1.6, color: S.prop, opacity: 0.8 });
      prims.push({ k: 'circle', c: p.anchor, r: 6, stroke: S.prop, fill: '#0B1020', w: 2.5, opacity: 0.9 });
      prims.push({ k: 'circle', c: h, r: 3, stroke: S.prop, fill: S.prop, w: 0, opacity: 0.9 });
    } else if (p.type === 'bench') {
      prims.push({ k: 'rect', x: p.x, y: p.y, w: p.width, h: 8, rx: 3, color: S.prop, opacity: S.propOpacity });
      prims.push({ k: 'line', a: { x: p.x + 10, y: p.y + 8 }, b: { x: p.x + 10, y: p.y + p.height }, w: 4, color: S.prop, opacity: S.propOpacity });
      prims.push({ k: 'line', a: { x: p.x + p.width - 10, y: p.y + 8 }, b: { x: p.x + p.width - 10, y: p.y + p.height }, w: 4, color: S.prop, opacity: S.propOpacity });
    }
  }

  const segPrims = (side: 'far' | 'near' | 'center') => {
    for (const s of fig.segments.filter((x) => x.side === side)) {
      prims.push({
        k: 'line',
        a: s.from,
        b: s.to,
        w: S.width[s.kind],
        color: side === 'far' ? S.bodyFar : S.body,
        opacity: side === 'far' ? S.farOpacity : 1,
      });
    }
    for (const j of fig.joints.filter((x) => x.side === side)) {
      prims.push({ k: 'circle', c: j.p, r: 2.2, stroke: '#0B1020', fill: '#E0FBFF', w: 0, opacity: side === 'far' ? 0.4 : 0.95 });
    }
  };

  const muscles = (side: 'far' | 'near' | 'center') => {
    for (const m of opts.muscles) {
      const spec = MUSCLE_MAP[m];
      for (const s of fig.segments.filter((x) => x.kind === spec.kind && x.side === side)) {
        const n = frontNormal(s, facing);
        const off = (S.width[s.kind] / 2 + 1.5) * spec.side;
        const a = along(s, spec.from);
        const b = along(s, spec.to);
        prims.push({
          k: 'line',
          a: { x: a.x + n.x * off, y: a.y + n.y * off },
          b: { x: b.x + n.x * off, y: b.y + n.y * off },
          w: 4,
          color: S.highlight,
          opacity: side === 'far' ? 0.35 : 1,
          glow: side !== 'far',
        });
      }
    }
  };

  // 2. Lado lejano (atenuado) → tronco → lado cercano
  segPrims('far');
  muscles('far');
  segPrims('center');
  muscles('center');
  prims.push({ k: 'circle', c: fig.head.c, r: fig.head.r, stroke: S.body, fill: '#0B1020', w: 3.5, opacity: 1 });
  // Visor: indica hacia dónde mira la figura.
  const hd = { x: fig.head.c.x - fig.shoulder.x, y: fig.head.c.y - fig.shoulder.y };
  const hl = Math.hypot(hd.x, hd.y) || 1;
  const hf = { x: -hd.y / hl, y: hd.x / hl };
  if (hf.x * facing.x + hf.y * facing.y < 0) {
    hf.x *= -1;
    hf.y *= -1;
  }
  const vc = { x: fig.head.c.x + hf.x * 4 - (hd.x / hl) * 1, y: fig.head.c.y + hf.y * 4 - (hd.y / hl) * 1 };
  prims.push({
    k: 'line',
    a: { x: vc.x - (hd.x / hl) * 2.5, y: vc.y - (hd.y / hl) * 2.5 },
    b: { x: vc.x + (hd.x / hl) * 2.5 + hf.x * 3, y: vc.y + (hd.y / hl) * 2.5 + hf.y * 3 },
    w: 3,
    color: S.highlight,
    opacity: 0.95,
  });

  const db = opts.props.find((p) => p.type === 'dumbbells');
  if (db && db.type === 'dumbbells') {
    fig.hands.forEach((h, i) => {
      if (db.only === 'near' && i !== 0) return;
      prims.push({ k: 'rect', x: h.x - 9, y: h.y - 3.5, w: 18, h: 7, rx: 2, color: S.prop, opacity: i === 0 ? 0.95 : 0.4 });
    });
  }
  if (opts.props.some((p) => p.type === 'barbell')) {
    const h = fig.hands[0];
    prims.push({ k: 'circle', c: h, r: 15, stroke: S.prop, fill: '#141C2E', w: 3, opacity: 0.95 });
    prims.push({ k: 'circle', c: h, r: 3, stroke: S.prop, fill: S.prop, w: 0, opacity: 0.95 });
  }

  segPrims('near');
  muscles('near');

  return { prims, fig };
}

/** SVG en texto (para vistas previas y pruebas). */
export function sceneToSvg(prims: Primitive[], viewBox: [number, number, number, number], scale = 2): string {
  const [x, y, w, h] = viewBox;
  const body = prims
    .map((p) => {
      if (p.k === 'line') {
        const glow = p.glow
          ? `<line x1="${p.a.x}" y1="${p.a.y}" x2="${p.b.x}" y2="${p.b.y}" stroke="${p.color}" stroke-width="${p.w * 3}" stroke-linecap="round" opacity="0.25"/>`
          : '';
        return `${glow}<line x1="${p.a.x}" y1="${p.a.y}" x2="${p.b.x}" y2="${p.b.y}" stroke="${p.color}" stroke-width="${p.w}" stroke-linecap="round" opacity="${p.opacity}"/>`;
      }
      if (p.k === 'circle') {
        return `<circle cx="${p.c.x}" cy="${p.c.y}" r="${p.r}" stroke="${p.stroke}" stroke-width="${p.w}" fill="${p.fill}" opacity="${p.opacity}"/>`;
      }
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}" fill="${p.color}" opacity="${p.opacity}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="${x} ${y} ${w} ${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0B1020"/>${body}</svg>`;
}
