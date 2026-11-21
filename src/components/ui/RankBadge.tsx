import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, rankColors } from '@/theme';
import type { Rank } from '@/features/progression/leveling';
import { AppText } from './AppText';

/** SSS+: el borde recorre varios colores (estático con «reducir movimiento»). */
const PRISM = ['#F0ABFC', '#22D3EE', '#FDE047', '#F472B6', '#F0ABFC'];

/**
 * Emblema de rango. El fondo es opaco (superficie + tinte encima) para que la sombra de Android
 * no se vea a través del relleno como un recuadro oscuro.
 */
export function RankBadge({ rank, size = 52, cracked = false }: { rank: Rank; size?: number; cracked?: boolean }) {
  const c = rankColors[rank];
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  const prism = rank === 'SSS+';
  useEffect(() => {
    if (prism && !reduce) t.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1);
  }, [prism, reduce, t]);
  const prismStyle = useAnimatedStyle(() =>
    prism ? { borderColor: interpolateColor(t.value, [0, 0.25, 0.5, 0.75, 1], PRISM) } : {},
  );
  const font = size * (rank.length === 1 ? 0.5 : rank.length === 2 ? 0.4 : rank.length === 3 ? 0.31 : 0.26);
  return (
    <Animated.View
      accessible
      accessibilityLabel={`Rango ${rank}${cracked ? ', agrietado' : ''}`}
      style={[
        styles.badge,
        { width: size, height: size, borderColor: c, shadowColor: c, borderWidth: prism ? 2.5 : 1.5 },
        cracked && styles.cracked,
        prismStyle,
      ]}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `${c}1F`, borderRadius: radius.md }]} />
      <AppText variant="display" color={c} style={{ fontSize: font, lineHeight: font * 1.15 }} numberOfLines={1}>
        {rank}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    // Sin elevation: en Android su sombra se colaba como un recuadro oscuro detrás de la letra.
    shadowOpacity: 0.6,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  cracked: { borderStyle: 'dashed', opacity: 0.75 },
});
