import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';

interface FramePlayerProps {
  /** [posición inicial, contracción] */
  frames: [number, number];
  height?: number;
  accessibilityLabel: string;
}

const LABELS = ['Inicio', 'Contracción'] as const;

/**
 * Alterna suavemente las dos fases de la ilustración. Con "reducir movimiento"
 * activado las muestra lado a lado, sin animación.
 */
export function FramePlayer({ frames, height = 280, accessibilityLabel }: FramePlayerProps) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    const fade = { duration: 550, easing: Easing.inOut(Easing.cubic) };
    t.value = withRepeat(
      withSequence(withDelay(900, withTiming(1, fade)), withDelay(900, withTiming(0, fade))),
      -1,
    );
  }, [reduceMotion, t]);

  const second = useAnimatedStyle(() => ({ opacity: t.value }));
  const first = useAnimatedStyle(() => ({ opacity: 1 - t.value }));

  if (reduceMotion) {
    return (
      <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        {frames.map((src, i) => (
          <View key={i} style={styles.half}>
            <Image source={src} style={[styles.fill, { height: height * 0.8 }]} resizeMode="contain" />
            <AppText variant="label" align="center">
              {LABELS[i]}
            </AppText>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.stage, { height }]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {/* La opacidad se anima en el contenedor; la imagen tiene tamaño explícito (100 %) para
          que Android la escale dentro del marco en lugar de dibujarla a su tamaño original. */}
      <Animated.View style={[StyleSheet.absoluteFill, first]}>
        <Image source={frames[0]} style={styles.fill} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, second]}>
        <Image source={frames[1]} style={styles.fill} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1, gap: spacing.xs, borderRadius: 12, backgroundColor: colors.bg, paddingVertical: spacing.sm },
});
