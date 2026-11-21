import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { AppText, Card, ChoiceChips, EmptyState, Screen } from '@/components/ui';
import { ExerciseFigure } from '@/features/exercises/ExerciseFigure';
import { getTechnique, getVariants, MUSCLE_LABEL } from '@/features/exercises/catalog';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

const SPEEDS = [
  { value: 0.5, label: '0,5×' },
  { value: 1, label: '1×' },
] as const;

function CueList({ title, items, icon, color }: { title: string; items?: string[]; icon: 'body' | 'play' | 'flash' | 'warning' | 'arrow-down' | 'arrow-up'; color: string }) {
  if (!items?.length) return null;
  return (
    <Card title={title} accent={color}>
      {items.map((t, i) => (
        <View key={i} style={styles.cue}>
          <Ionicons name={icon} size={14} color={color} style={styles.cueIcon} />
          <AppText variant="body" style={styles.flex}>
            {t}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

function IconButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

export default function ExerciseTechniqueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = id ? getTechnique(id) : null;
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState('');
  const onPhase = useCallback((p: string) => setPhase(p), []);

  const back = (
    <IconButton icon="close" label="Cerrar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/training'))} />
  );

  if (!exercise) {
    return (
      <Screen title="Técnica" subtitle="Ejercicio" accessory={back}>
        <EmptyState icon="help-circle-outline" title="Ejercicio no encontrado" message="Puede que se haya renombrado." />
      </Screen>
    );
  }

  const variants = getVariants(exercise.group);
  const stepMode = reduceMotion || !playing;
  const frames = exercise.keyframes.length;

  return (
    <Screen title={exercise.name} subtitle="Técnica" accessory={back}>
      {variants.length > 1 ? (
        <ChoiceChips
          label="Variante"
          options={variants.map((v) => ({ value: v.id, label: v.variantLabel ?? v.name }))}
          value={exercise.id}
          onChange={(v) => {
            setStep(0);
            router.setParams({ id: v });
          }}
          color={colors.violet}
        />
      ) : null}

      <Card highlighted accent={colors.cyan} style={styles.stage}>
        <ExerciseFigure exercise={exercise} playing={playing} speed={speed} stepIndex={step} onPhase={onPhase} />
        <View style={styles.phase}>
          <AppText variant="label" color={colors.cyan}>
            {stepMode ? `Fase ${step + 1}/${frames}` : 'Fase'}
          </AppText>
          <AppText variant="heading" accessibilityLiveRegion="polite">
            {phase}
          </AppText>
        </View>

        <View style={styles.controls}>
          {reduceMotion ? null : (
            <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pausar' : 'Reproducir'} onPress={() => setPlaying((p) => !p)} />
          )}
          {stepMode ? (
            <>
              <IconButton icon="play-back" label="Fase anterior" onPress={() => setStep((s) => (s - 1 + frames) % frames)} />
              <IconButton icon="play-forward" label="Fase siguiente" onPress={() => setStep((s) => (s + 1) % frames)} />
            </>
          ) : (
            <View style={styles.speeds}>
              {SPEEDS.map((s) => (
                <Pressable
                  key={s.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: speed === s.value }}
                  accessibilityLabel={`Velocidad ${s.label}`}
                  onPress={() => setSpeed(s.value)}
                  style={[styles.speed, speed === s.value && styles.speedOn]}
                >
                  <AppText variant="label" color={speed === s.value ? colors.text : colors.textMuted}>
                    {s.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        {reduceMotion ? (
          <AppText variant="caption" color={colors.textFaint}>
            Tienes activado "reducir movimiento": avanza fase a fase con los botones.
          </AppText>
        ) : null}
      </Card>

      <Card title="Músculos">
        <View style={styles.muscles}>
          {exercise.primary.map((m) => (
            <View key={m} style={[styles.tag, styles.tagPrimary]}>
              <View style={styles.dot} />
              <AppText variant="caption" color={colors.text}>
                {MUSCLE_LABEL[m]}
              </AppText>
            </View>
          ))}
          {exercise.secondary.map((m) => (
            <View key={m} style={styles.tag}>
              <AppText variant="caption">{MUSCLE_LABEL[m]}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" color={colors.textFaint}>
          En la animación, el color violeta marca el músculo principal.
        </AppText>
      </Card>

      <CueList title="Dónde poner el énfasis" items={exercise.cues.focus} icon="flash" color={colors.violet} />
      <CueList title="Preparación" items={exercise.cues.setup} icon="body" color={colors.cyan} />
      <CueList title="Ejecución" items={exercise.cues.execution} icon="play" color={colors.primary} />
      <CueList title="Errores comunes" items={exercise.cues.mistakes} icon="warning" color={colors.warning} />
      <CueList title="Para hacerlo más fácil" items={exercise.cues.regressions} icon="arrow-down" color={colors.success} />
      <CueList title="Para hacerlo más difícil" items={exercise.cues.progressions} icon="arrow-up" color={colors.danger} />

      <AppText variant="caption" color={colors.textFaint}>
        Guía general, no reemplaza la supervisión de un profesional. Si sientes dolor (no solo esfuerzo), detente.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stage: { paddingHorizontal: spacing.sm },
  phase: { gap: 2, paddingHorizontal: spacing.sm },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  iconBtn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speeds: { flexDirection: 'row', gap: spacing.xs, marginLeft: 'auto' },
  speed: {
    minWidth: MIN_TOUCH,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  speedOn: { borderColor: colors.cyan, backgroundColor: 'rgba(34,211,238,0.15)' },
  cue: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  cueIcon: { marginTop: 4 },
  muscles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagPrimary: { borderColor: colors.violet, backgroundColor: 'rgba(139,92,246,0.15)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.violet },
});
