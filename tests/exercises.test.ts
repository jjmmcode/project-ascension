/**
 * @jest-environment node
 */
import { buildFigure, cycleDuration, sampleTimeline, solveTwoBone, BONES } from '@/features/exercises/figure/kinematics';
import { buildScene } from '@/features/exercises/figure/scene';
import { EXERCISE_TECHNIQUES, getVariants } from '@/features/exercises/catalog';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('cinemática', () => {
  it('IK alcanza el objetivo y respeta las longitudes', () => {
    const base = { x: 0, y: 0 };
    const target = { x: 20, y: 40 };
    const { mid, end } = solveTwoBone(base, target, 30, 28, 1);
    expect(dist(end, target)).toBeLessThan(1e-6);
    expect(dist(base, mid)).toBeCloseTo(30, 5);
    expect(dist(mid, end)).toBeCloseTo(28, 5);
  });

  it('fuera de alcance: se estira hacia el objetivo sin romper longitudes', () => {
    const { mid, end } = solveTwoBone({ x: 0, y: 0 }, { x: 0, y: 200 }, 30, 28, 1);
    expect(dist({ x: 0, y: 0 }, mid)).toBeCloseTo(30, 3);
    expect(dist(mid, end)).toBeCloseTo(28, 3);
  });

  it('los huesos mantienen su longitud en todos los fotogramas de todos los ejercicios', () => {
    for (const ex of EXERCISE_TECHNIQUES) {
      const total = cycleDuration(ex.keyframes);
      for (let ms = 0; ms < total; ms += total / 40) {
        const fig = buildFigure(sampleTimeline(ex.keyframes, ms).pose);
        for (const s of fig.segments) {
          if (s.kind === 'neck') continue;
          expect(dist(s.from, s.to)).toBeCloseTo(BONES[s.kind], 3);
        }
      }
    }
  });
});

describe('catálogo de técnica', () => {
  it('ids únicos, al menos 2 keyframes y textos de técnica', () => {
    const ids = EXERCISE_TECHNIQUES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EXERCISE_TECHNIQUES) {
      expect(e.keyframes.length).toBeGreaterThanOrEqual(2);
      expect(e.cues.focus.length).toBeGreaterThan(0);
      expect(e.cues.execution.length).toBeGreaterThan(0);
      expect(e.primary.length).toBeGreaterThan(0);
    }
  });

  it('en fondos las manos permanecen sobre la barra durante todo el ciclo', () => {
    for (const ex of getVariants('dips')) {
      const bar = ex.props.find((p) => p.type === 'parallelBars');
      if (!bar || bar.type !== 'parallelBars') throw new Error('sin barra');
      const total = cycleDuration(ex.keyframes);
      for (let ms = 0; ms < total; ms += total / 40) {
        const fig = buildFigure(sampleTimeline(ex.keyframes, ms).pose);
        expect(dist(fig.hands[0], bar.at)).toBeLessThan(0.5);
      }
    }
  });

  it('variante pecho inclina el torso bastante más que la de tríceps', () => {
    const [chest, tri] = [getVariants('dips').find((e) => e.id === 'dips-chest')!, getVariants('dips').find((e) => e.id === 'dips-triceps')!];
    const maxLean = (ex: typeof chest) => Math.max(...ex.keyframes.map((k) => k.pose.torso));
    expect(maxLean(chest) - maxLean(tri)).toBeGreaterThanOrEqual(25);
  });

  it('la escena siempre dibuja la figura y resalta el músculo principal', () => {
    for (const ex of EXERCISE_TECHNIQUES) {
      const { prims } = buildScene(ex.keyframes[0]!.pose, { props: ex.props, muscles: ex.primary });
      expect(prims.filter((p) => p.k === 'line' && p.glow).length).toBeGreaterThan(0);
    }
  });
});
