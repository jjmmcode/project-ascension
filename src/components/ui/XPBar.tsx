import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius } from '@/theme';

interface XPBarProps {
  /** 0..1 */
  progress: number;
  color?: string;
  height?: number;
  accessibilityLabel?: string;
}

/**
 * Barra de progreso animada. Si el sistema tiene "reducir movimiento"
 * activado, el valor se aplica sin animación.
 */
export function XPBar({ progress, color = colors.primary, height = 10, accessibilityLabel }: XPBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(reduceMotion ? clamped : 0);

  useEffect(() => {
    value.value = reduceMotion
      ? clamped
      : withTiming(clamped, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [clamped, reduceMotion, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, borderRadius: radius.pill }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: radius.pill }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: 'rgba(148,163,184,0.15)', overflow: 'hidden' },
  fill: { height: '100%', shadowColor: colors.cyan, shadowOpacity: 0.8, shadowRadius: 6 },
});
