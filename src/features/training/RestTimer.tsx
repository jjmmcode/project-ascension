import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playSound } from '@/features/sound/sound';
import { AppText, XPBar } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export { restSecondsFor } from './rest';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Barra fija abajo con la cuenta atrás. Usa la hora de fin, así no se desfasa si la app pasa a segundo plano. */
export function RestTimer({
  endsAt,
  total,
  label,
  onAdjust,
  onSkip,
  onDone,
}: {
  endsAt: number;
  total: number;
  label: string;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void playSound('timer_done');
      onDone();
    }
  }, [left, onDone]);
  const done = left === 0;
  return (
    <View style={[styles.bar, done && styles.done]} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="label" color={done ? colors.success : colors.cyan}>
            {done ? '¡A por la siguiente serie!' : 'Descanso'}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {label}
          </AppText>
        </View>
        <AppText variant="display" style={styles.time} accessibilityLabel={`Quedan ${left} segundos`}>
          {fmt(left)}
        </AppText>
      </View>
      <XPBar progress={total > 0 ? 1 - left / total : 1} color={done ? colors.success : colors.cyan} height={5} accessibilityLabel="Progreso del descanso" />
      <View style={styles.row}>
        {[
          { t: '−15 s', d: -15 },
          { t: '+15 s', d: 15 },
        ].map((b) => (
          <Pressable key={b.t} accessibilityRole="button" onPress={() => onAdjust(b.d)} style={styles.btn} disabled={done}>
            <AppText variant="label">{b.t}</AppText>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={onSkip} style={[styles.btn, styles.flex]}>
          <AppText variant="label" color={colors.textMuted}>
            {done ? 'Cerrar' : 'Saltar descanso'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cyan,
    elevation: 8,
  },
  done: { borderColor: colors.success },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  time: { fontSize: 30, lineHeight: 34 },
  btn: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
