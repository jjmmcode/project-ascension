import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors } from '@/theme';

export interface RadarAxis {
  label: string;
  /** 0–100, o null si aún no hay datos (se dibuja en gris). */
  value: number | null;
}

/** Radar de 5 ejes estilo ficha de personaje. */
export function StatRadar({ axes, size = 260, color = colors.violet }: { axes: RadarAxis[]; size?: number; color?: string }) {
  // Más ancho que alto para que las etiquetas laterales («Constancia 100») no se corten.
  const w = size + 96;
  const cx = w / 2;
  const c = size / 2;
  const r = size * 0.32;
  const n = axes.length;
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r * f, c + Math.sin(a) * r * f] as const;
  };
  const ring = (f: number) => axes.map((_, i) => pt(i, f).join(',')).join(' ');
  const shape = axes.map((a, i) => pt(i, Math.max(0.04, (a.value ?? 0) / 100)).join(',')).join(' ');
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={axes.map((a) => `${a.label}: ${a.value == null ? 'sin datos' : Math.round(a.value)}`).join(', ')}
      style={{ alignItems: 'center' }}
    >
      <Svg width={w} height={size} viewBox={`0 0 ${w} ${size}`} style={{ maxWidth: '100%' }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <Polygon key={f} points={ring(f)} fill="none" stroke={colors.border} strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <Line key={i} x1={cx} y1={c} x2={x} y2={y} stroke={colors.border} strokeWidth={1} />;
        })}
        <Polygon points={shape} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} />
        {axes.map((a, i) => {
          const [x, y] = pt(i, Math.max(0.04, (a.value ?? 0) / 100));
          return <Circle key={i} cx={x} cy={y} r={3.5} fill={a.value == null ? colors.textFaint : color} />;
        })}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.28);
          return (
            <SvgText
              key={`t${i}`}
              x={x}
              y={y}
              fill={a.value == null ? colors.textFaint : colors.text}
              fontSize={11}
              fontWeight="700"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {`${a.label} ${a.value == null ? '—' : Math.round(a.value)}`}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
