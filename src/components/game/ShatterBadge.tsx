import { useEffect, useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { colors, rankColors } from '@/theme';
import type { Rank } from '@/features/progression/leveling';

/**
 * Emblema de rango roto (diseño aprobado el 21-11-2026). Daño según niveles por debajo del mínimo del rango:
 * 1 grieta (fisura, esquina desprendida, brillo apagado), 2 fractura (4 pedazos separados, color apagado, parpadeo),
 * 3 destrozado (pedazos sueltos casi sin color). `from` anima el paso desde otro daño (romperse o repararse).
 */
export type Damage = 0 | 1 | 2 | 3;

// Lienzo 200×200; el emblema ocupa 40–160.
const PIECES = {
  p1: '0,0 118,0 104,62 92,98 0,120',
  p2: '118,0 200,0 200,96 132,108 92,98 104,62',
  p2chip: '118,0 146,0 146,40 152,50 160,54 200,54 200,96 132,108 92,98 104,62',
  p3: '0,120 92,98 132,108 120,200 0,200',
  p4: '132,108 200,96 200,200 120,200',
};
const OFFSETS: Record<Damage, Record<'p1' | 'p2' | 'p3' | 'p4', [number, number, number]>> = {
  0: { p1: [0, 0, 0], p2: [0, 0, 0], p3: [0, 0, 0], p4: [0, 0, 0] },
  1: { p1: [0, 0, 0], p2: [1.5, -1, 1.5], p3: [0, 0, 0], p4: [0, 0, 0] },
  2: { p1: [-2, -1, -2], p2: [4, -3, 4], p3: [-1, 2, -1], p4: [2, 3, 2] },
  3: { p1: [-7, -4, -6], p2: [9, -7, 9], p3: [-5, 7, -4], p4: [8, 9, 7] },
};
const CRACKS: Array<{ pts: string; w: number; min: Damage; light?: boolean }> = [
  { pts: '118,40 112,52 104,62 98,80 92,98', w: 3, min: 1 },
  { pts: '119,41 113,53 105,63 99,81 93,99', w: 0.8, min: 1, light: true },
  { pts: '104,62 122,70 134,66', w: 1.6, min: 1 },
  { pts: '92,98 70,106 52,112 40,116', w: 2.6, min: 2 },
  { pts: '92,98 112,104 132,108 150,104 160,101', w: 2.6, min: 2 },
  { pts: '70,106 64,124 58,134', w: 1.4, min: 2 },
  { pts: '132,108 128,130 124,150 122,160', w: 2.4, min: 3 },
];
const SATURATION: Record<Damage, number> = { 0: 1, 1: 0.75, 2: 0.45, 3: 0.15 };

function desaturate(hex: string, s: number): string {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const g = c[0]! * 0.3 + c[1]! * 0.59 + c[2]! * 0.11;
  return `#${c.map((v) => Math.round(g + (v - g) * s).toString(16).padStart(2, '0')).join('')}`;
}

function Piece({
  id,
  points,
  progress,
  from,
  to,
  size,
  children,
}: {
  id: string;
  points: string;
  progress: SharedValue<number>;
  from: [number, number, number];
  to: [number, number, number];
  size: number;
  children: React.ReactNode;
}) {
  const k = size / 120; // unidades del lienzo → px
  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    const r = from[2] + (to[2] - from[2]) * t;
    return { transform: [{ translateX: x * k }, { translateY: y * k }, { rotate: `${r}deg` }] };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 200 200">
        <Defs>
          <ClipPath id={id}>
            <Polygon points={points} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${id})`}>{children}</G>
      </Svg>
    </Animated.View>
  );
}

export function ShatterBadge({ rank, damage, size = 52, from }: { rank: Rank; damage: Damage; size?: number; from?: Damage }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduce = useReducedMotion();
  const start = from ?? damage;
  const progress = useSharedValue(reduce || from == null ? 1 : 0);
  const crackShown = useSharedValue(reduce || from == null ? 1 : 0);
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (reduce || from == null) return;
    progress.value = withDelay(150, withSpring(1, { damping: 7, stiffness: 140 }));
    crackShown.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) });
  }, [from, damage, reduce, progress, crackShown]);

  useEffect(() => {
    if (damage === 2 && !reduce) {
      flicker.value = withRepeat(withSequence(withTiming(0.7, { duration: 120 }), withTiming(1, { duration: 300 }), withTiming(0.85, { duration: 90 })), -1);
    } else flicker.value = 1;
  }, [damage, reduce, flicker]);

  const base = rankColors[rank];
  const col = desaturate(base, SATURATION[damage]);
  const face = useMemo(
    () => (
      <>
        <Rect x={40} y={40} width={120} height={120} rx={18} fill={colors.surface} />
        <Rect x={40} y={40} width={120} height={120} rx={18} fill={col} fillOpacity={0.12} />
        <Rect x={40} y={40} width={120} height={120} rx={18} fill="none" stroke={col} strokeWidth={3} />
        <Rect x={48} y={48} width={104} height={104} rx={13} fill="none" stroke={col} strokeOpacity={0.35} strokeWidth={1} />
        <SvgText
          x={100}
          y={100}
          fill={col}
          fontSize={rank.length === 1 ? 72 : rank.length === 2 ? 58 : rank.length === 3 ? 46 : 38}
          fontWeight="800"
          textAnchor="middle"
          alignmentBaseline="central"
        >
          {rank}
        </SvgText>
      </>
    ),
    [col, rank],
  );

  const flickerStyle = useAnimatedStyle(() => ({ opacity: flicker.value }));
  const crackStyle = useAnimatedStyle(() => ({ opacity: crackShown.value }));
  const show = Math.max(damage, start) as Damage;
  const canvas = (size * 200) / 120;
  const off = -(size * 40) / 120;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel={`Rango ${rank}${damage ? `, emblema ${['', 'agrietado', 'fracturado', 'destrozado'][damage]}` : ''}`}
    >
      <Animated.View style={[{ position: 'absolute', left: off, top: off, width: canvas, height: canvas }, flickerStyle]} pointerEvents="none">
        {(['p1', 'p2', 'p3', 'p4'] as const).map((p) => (
          <Piece
            key={p}
            id={`${uid}${p}`}
            points={p === 'p2' && damage >= 1 ? PIECES.p2chip : PIECES[p]}
            progress={progress}
            from={OFFSETS[start][p]}
            to={OFFSETS[damage][p]}
            size={size}
          >
            {face}
          </Piece>
        ))}
        <Animated.View style={[StyleSheet.absoluteFill, crackStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 200 200">
            {CRACKS.filter((c) => c.min <= (from != null && from > damage ? damage : show)).map((c, i) => (
              <Polyline
                key={i}
                points={c.pts}
                fill="none"
                stroke={c.light ? '#E2E8F0' : '#020409'}
                strokeOpacity={c.light ? 0.55 : 1}
                strokeWidth={c.w}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
