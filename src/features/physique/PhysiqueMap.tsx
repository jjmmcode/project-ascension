import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '@/components/ui';
import { colors, rankColors, spacing } from '@/theme';
import { BODY_MAP_STYLE as S, REGION_PATHS, SILHOUETTE, type BodyRegion } from '@/features/exercises/bodyMap/regions';
import { MUSCLE_GROUP_LABEL, type MuscleGroup } from '@/features/exercises/library';
import type { MuscleRank } from './physique';
import { MUSCLE_REGIONS } from './regions';
import { RANKS } from './physique';

export interface MuscleFill {
  color: string;
  /** 0–1 */
  opacity: number;
}

/** Mapa corporal frontal y posterior con un relleno por músculo. */
export function MuscleMap({
  fills,
  legend,
  label,
  height = 280,
}: {
  fills: Partial<Record<MuscleGroup, MuscleFill>>;
  legend: Array<{ color: string; text: string; opacity?: number }>;
  label: string;
  height?: number;
}) {
  const byRegion = new Map<BodyRegion, MuscleFill>();
  for (const [m, f] of Object.entries(fills) as Array<[MuscleGroup, MuscleFill]>) {
    for (const region of MUSCLE_REGIONS[m]) byRegion.set(region, f);
  }
  const regions = Object.keys(REGION_PATHS) as BodyRegion[];
  return (
    <View style={styles.wrap}>
      <View accessible accessibilityRole="image" accessibilityLabel={label}>
        <Svg width="100%" height={height} viewBox="0 0 200 210">
          {SILHOUETTE.map((d, i) => (
            <Path key={`s${i}`} d={d} fill={S.silhouette} stroke={S.silhouetteStroke} strokeWidth={0.8} />
          ))}
          {regions.flatMap((r) =>
            REGION_PATHS[r].map((d, i) => {
              const f = byRegion.get(r);
              const on = f && f.opacity > 0;
              return [
                on ? <Path key={`${r}${i}g`} d={d} fill="none" stroke={f.color} strokeOpacity={0.35 * f.opacity} strokeWidth={4} /> : null,
                <Path
                  key={`${r}${i}`}
                  d={d}
                  fill={on ? f.color : S.idle}
                  fillOpacity={on ? 0.25 + 0.65 * f.opacity : 1}
                  stroke={on ? f.color : S.idleStroke}
                  strokeWidth={0.6}
                />,
              ];
            }),
          )}
        </Svg>
        <View style={styles.views}>
          <AppText variant="label" color={colors.textFaint}>
            Frente
          </AppText>
          <AppText variant="label" color={colors.textFaint}>
            Espalda
          </AppText>
        </View>
      </View>
      <View style={styles.legend}>
        {legend.map((l) => (
          <View key={l.text} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: l.color, opacity: l.opacity ?? 1 }]} />
            <AppText variant="caption">{l.text}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Mapa coloreado según el rank de fuerza de cada músculo. */
export function PhysiqueMap({ ranks, height = 280 }: { ranks: MuscleRank[]; height?: number }) {
  const fills: Partial<Record<MuscleGroup, MuscleFill>> = {};
  for (const r of ranks) fills[r.muscle] = { color: rankColors[r.rank], opacity: 1 };
  const label = ranks.map((r) => `${MUSCLE_GROUP_LABEL[r.muscle]} rango ${r.rank}`).join(', ');
  return (
    <MuscleMap
      fills={fills}
      height={height}
      label={`Mapa de fuerza por músculo. ${label || 'Sin datos aún'}`}
      legend={[...RANKS.map((r) => ({ color: rankColors[r], text: r })), { color: S.idle, text: 'sin datos' }]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  views: { flexDirection: 'row', justifyContent: 'space-around', marginTop: -spacing.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
