import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { BODY_MAP_STYLE as S, REGION_LABEL, REGION_PATHS, SILHOUETTE, type BodyRegion } from './regions';

interface BodyMapProps {
  primary: BodyRegion[];
  secondary: BodyRegion[];
  height?: number;
}

/** Mapa muscular frontal y posterior con los músculos trabajados resaltados. */
export function BodyMap({ primary, secondary, height = 230 }: BodyMapProps) {
  const level = (r: BodyRegion) => (primary.includes(r) ? 'primary' : secondary.includes(r) ? 'secondary' : null);
  const regions = Object.keys(REGION_PATHS) as BodyRegion[];
  const label = [
    primary.length ? `Principal: ${primary.map((r) => REGION_LABEL[r]).join(', ')}` : '',
    secondary.length ? `Secundario: ${secondary.map((r) => REGION_LABEL[r]).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View style={styles.wrap}>
      <View accessible accessibilityRole="image" accessibilityLabel={`Mapa muscular. ${label}`}>
        <Svg width="100%" height={height} viewBox="0 0 200 210">
          {SILHOUETTE.map((d, i) => (
            <Path key={`s${i}`} d={d} fill={S.silhouette} stroke={S.silhouetteStroke} strokeWidth={0.8} />
          ))}
          {regions.flatMap((r) =>
            REGION_PATHS[r].map((d, i) => {
              const l = level(r);
              const fill = l === 'primary' ? S.primary : l === 'secondary' ? S.secondary : S.idle;
              return [
                l === 'primary' ? <Path key={`${r}${i}g`} d={d} fill="none" stroke={S.glow} strokeWidth={4} /> : null,
                <Path key={`${r}${i}`} d={d} fill={fill} stroke={l ? S.primary : S.idleStroke} strokeWidth={0.6} />,
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
        {primary.map((r) => (
          <View key={r} style={[styles.chip, styles.chipPrimary]}>
            <View style={[styles.dot, { backgroundColor: S.primary }]} />
            <AppText variant="caption" color={colors.text}>
              {REGION_LABEL[r]}
            </AppText>
          </View>
        ))}
        {secondary.map((r) => (
          <View key={r} style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: S.secondary }]} />
            <AppText variant="caption">{REGION_LABEL[r]}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" color={colors.textFaint}>
        Violeta intenso: músculo principal (pon ahí el énfasis). Violeta suave: músculos que ayudan.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  views: { flexDirection: 'row', justifyContent: 'space-around', marginTop: -spacing.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipPrimary: { borderColor: colors.violet, backgroundColor: 'rgba(139,92,246,0.15)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
