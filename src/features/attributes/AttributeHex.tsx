import { View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';
import { colors } from '@/theme';
import { ATTRIBUTE_INFO, ATTRIBUTES, type AttributeKey } from './engine';

/**
 * Hexágono de atributos: relleno = hoy; línea punteada = hace 30 días.
 * La escala crece con tus valores (siguiente múltiplo de 10) para que el avance se note desde el principio.
 */
export function AttributeHex({
  values,
  ghost,
  size = 250,
}: {
  values: Record<AttributeKey, number>;
  ghost?: Record<AttributeKey, number>;
  size?: number;
}) {
  const w = size + 60;
  const cx = w / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const max = Math.max(10, Math.ceil(Math.max(...ATTRIBUTES.map((a) => Math.max(values[a], ghost?.[a] ?? 0))) / 10) * 10);
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + Math.cos(a) * r * f, cy + Math.sin(a) * r * f] as const;
  };
  const poly = (v: Record<AttributeKey, number>) => ATTRIBUTES.map((a, i) => pt(i, Math.max(0.04, v[a] / max)).join(',')).join(' ');
  const ring = (f: number) => ATTRIBUTES.map((_, i) => pt(i, f).join(',')).join(' ');
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Atributos: ${ATTRIBUTES.map((a) => `${ATTRIBUTE_INFO[a].name} ${values[a]}`).join(', ')}. Escala hasta ${max}.`}
      style={{ alignItems: 'center' }}
    >
      <Svg width={w} height={size} viewBox={`0 0 ${w} ${size}`} style={{ maxWidth: '100%' }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <Polygon key={f} points={ring(f)} fill="none" stroke={colors.border} strokeWidth={1} />
        ))}
        {ATTRIBUTES.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={colors.border} strokeWidth={1} />;
        })}
        {ghost ? <Polygon points={poly(ghost)} fill="none" stroke={colors.textFaint} strokeWidth={1.5} strokeDasharray="5,4" /> : null}
        <Polygon points={poly(values)} fill={colors.violet} fillOpacity={0.35} stroke={colors.violet} strokeWidth={2.5} />
        {ATTRIBUTES.map((a, i) => {
          const [x, y] = pt(i, 1.2);
          return (
            <SvgText
              key={a}
              x={x}
              y={y}
              fill={ATTRIBUTE_INFO[a].available ? colors.text : colors.textFaint}
              fontSize={13}
              fontWeight="800"
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {ATTRIBUTE_INFO[a].short}
            </SvgText>
          );
        })}
        <SvgText x={cx} y={size - 4} fill={colors.textFaint} fontSize={10} textAnchor="middle">
          {`escala 0–${max}`}
        </SvgText>
      </Svg>
    </View>
  );
}
