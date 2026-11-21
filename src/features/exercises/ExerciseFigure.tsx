import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Pattern, Rect, Path } from 'react-native-svg';
import { sampleTimeline } from './figure/kinematics';
import { buildScene, FIGURE_STYLE, type Primitive } from './figure/scene';
import type { ExerciseTechnique } from './catalog';

interface ExerciseFigureProps {
  exercise: ExerciseTechnique;
  playing: boolean;
  speed: number;
  /** Con movimiento reducido o en pausa se muestra este keyframe. */
  stepIndex: number;
  onPhase?: (phase: string, index: number) => void;
  height?: number;
}

/** Bucle de animación a la tasa de refresco de la pantalla. */
function useClock(running: boolean, speed: number) {
  const [ms, setMs] = useState(0);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!running) {
      last.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (last.current !== null) {
        const dt = now - last.current;
        setMs((m) => m + dt * speed);
      }
      last.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);
  return [ms, setMs] as const;
}

function renderPrim(p: Primitive, key: number) {
  if (p.k === 'line') {
    return [
      p.glow ? (
        <Line key={`${key}g`} x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke={p.color} strokeWidth={p.w * 3} strokeLinecap="round" opacity={0.25} />
      ) : null,
      <Line key={key} x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke={p.color} strokeWidth={p.w} strokeLinecap="round" opacity={p.opacity} />,
    ];
  }
  if (p.k === 'circle') {
    return <Circle key={key} cx={p.c.x} cy={p.c.y} r={p.r} stroke={p.stroke} strokeWidth={p.w} fill={p.fill} opacity={p.opacity} />;
  }
  return <Rect key={key} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={p.color} opacity={p.opacity} />;
}

export function ExerciseFigure({ exercise, playing, speed, stepIndex, onPhase, height = 300 }: ExerciseFigureProps) {
  const reduceMotion = useReducedMotion();
  const animate = playing && !reduceMotion;
  const [ms, setMs] = useClock(animate, speed);

  // Al cambiar de ejercicio o de variante, la animación empieza desde arriba.
  useEffect(() => setMs(0), [exercise.id, setMs]);

  const sample = useMemo(() => {
    if (animate) return sampleTimeline(exercise.keyframes, ms);
    const i = Math.min(stepIndex, exercise.keyframes.length - 1);
    const kf = exercise.keyframes[i]!;
    return { pose: kf.pose, phase: kf.phase, index: i };
  }, [animate, exercise, ms, stepIndex]);

  const lastPhase = useRef<string>('');
  useEffect(() => {
    if (sample.phase !== lastPhase.current) {
      lastPhase.current = sample.phase;
      onPhase?.(sample.phase, sample.index);
    }
  }, [sample.phase, sample.index, onPhase]);

  const prims = useMemo(
    () => buildScene(sample.pose, { props: exercise.props, muscles: exercise.primary }).prims,
    [sample.pose, exercise.props, exercise.primary],
  );

  const [x, y, w, h] = exercise.viewBox;

  return (
    <Svg
      width="100%"
      height={height}
      viewBox={`${x} ${y} ${w} ${h}`}
      accessibilityRole="image"
      accessibilityLabel={`Animación de ${exercise.name}${exercise.variantLabel ? `, ${exercise.variantLabel}` : ''}. ${sample.phase}`}
    >
      <Defs>
        <Pattern id="grid" width={10} height={10} patternUnits="userSpaceOnUse">
          <Path d="M 10 0 L 0 0 0 10" fill="none" stroke={FIGURE_STYLE.grid} strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect x={x} y={y} width={w} height={h} fill="url(#grid)" />
      {prims.map(renderPrim)}
    </Svg>
  );
}
