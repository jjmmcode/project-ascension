import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { workoutsRepo } from '@/database/repositories/workouts';
import { useProfileStore } from '@/stores/profileStore';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Button, Card, Screen, TextField, XPBar } from '@/components/ui';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { parseDecimal } from '@/lib/numbers';
import { LIBRARY, MUSCLE_GROUP_LABEL, SHOW_STICK_ANIMATIONS, type MuscleGroup } from '@/features/exercises/library';
import { EXERCISE_TECHNIQUES, MUSCLE_LABEL, type ExerciseTechnique } from '@/features/exercises/catalog';
import { colors, MIN_TOUCH, spacing } from '@/theme';
import { templatesRepo, type ScheduleDay, type Template } from '@/database/repositories/templates';
import { OPTIONAL_DAYS, WEEKDAY_LABEL } from '@/features/training/defaultPlan';
import { isoWeekday, weeklySetsByMuscle, WEEKLY_SETS_TARGET } from '@/services/plan';
import { formatShortDate } from '@/lib/time';
import { formatNumber } from '@/lib/numbers';
import type { Workout } from '@/database/repositories/workouts';

/** Un elemento por grupo de movimiento; las variantes se eligen dentro de la ficha. */
function groups(): ExerciseTechnique[][] {
  const map = new Map<string, ExerciseTechnique[]>();
  for (const e of EXERCISE_TECHNIQUES) map.set(e.group, [...(map.get(e.group) ?? []), e]);
  return [...map.values()];
}

export default function TrainingScreen() {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const inProgress = useProfileStore((s) => s.inProgress);
  const weekWorkouts = useProfileStore((s) => s.weekWorkouts);
  const weekGoal = useProfileStore((s) => s.goals.workouts_per_week?.targetValue);
  const refresh = useProfileStore((s) => s.refresh);
  const [starting, setStarting] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [weekSets, setWeekSets] = useState<Partial<Record<MuscleGroup, number>>>({});
  const [weight, setWeight] = useState('');
  const [weightError, setWeightError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<Workout & { templateName: string | null; completedSets: number }>>([]);

  const loadPlan = useCallback(async () => {
    if (!profile) return;
    setTemplates(await templatesRepo.list(db, profile.id));
    setSchedule(await templatesRepo.schedule(db, profile.id));
    setWeekSets(await weeklySetsByMuscle(db, profile.id));
    setRecent(await workoutsRepo.listRecentCompleted(db, profile.id, 10));
  }, [db, profile]);

  useFocusEffect(
    useCallback(() => {
      void refresh(db).then(loadPlan);
    }, [db, refresh, loadPlan]),
  );

  const changeDay = (weekday: number) => {
    if (!profile) return;
    const assign = async (templateId: string | null) => {
      await templatesRepo.setDay(db, profile.id, weekday, templateId);
      await refresh(db);
      await loadPlan();
    };
    // Alert de Android admite 3 botones: se pregunta primero el tipo y luego la rutina.
    Alert.alert(`${WEEKDAY_LABEL[weekday]}`, '¿Qué quieres hacer este día?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descanso',
        // Confirmación: en Android los botones quedan juntos y es fácil tocar este por error.
        onPress: () =>
          Alert.alert(`¿${WEEKDAY_LABEL[weekday]} de descanso?`, 'La rutina no se borra; solo deja de estar asignada a este día.', [
            { text: 'No', style: 'cancel' },
            { text: 'Sí, descanso', onPress: () => void assign(null) },
          ]),
      },
      {
        text: 'Elegir rutina',
        onPress: () => {
          const pages = templates.map((t) => ({ text: t.name, onPress: () => void assign(t.id) }));
          const ask = (from: number) => {
            const slice = pages.slice(from, from + 2);
            const more = from + 2 < pages.length;
            Alert.alert(`${WEEKDAY_LABEL[weekday]}: elegir rutina`, undefined, [
              ...slice,
              more ? { text: 'Más…', onPress: () => ask(from + 2) } : { text: 'Cancelar', style: 'cancel' as const },
            ]);
          };
          ask(0);
        },
      },
    ]);
  };

  const newRoutine = async () => {
    if (!profile) return;
    const id = await templatesRepo.create(db, profile.id, { name: `Rutina ${templates.length + 1}`, kind: 'gym' });
    router.push({ pathname: '/routine/[id]', params: { id } });
  };

  const saveWeight = async () => {
    const kg = parseDecimal(weight);
    if (!profile || kg === null || Number.isNaN(kg) || kg < 30 || kg > 300) {
      setWeightError('Introduce un peso entre 30 y 300 kg');
      return;
    }
    await bodyMetricsRepo.create(db, profile.id, { measuredAt: new Date().toISOString(), weightKg: kg, source: 'manual' });
    setWeight('');
    setWeightError(null);
    await refresh(db); // calcula las kcal pendientes
    await loadPlan();
  };

  const todayIdx = isoWeekday();
  const muscles = (Object.keys(MUSCLE_GROUP_LABEL) as MuscleGroup[]).filter((m) => m !== 'neck');

  const start = async () => {
    if (!profile) return;
    setStarting(true);
    try {
      await workoutsRepo.start(db, profile.id);
      await refresh(db);
      router.push('/workout');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen title="Training" subtitle="Entrenamiento">
      <Card title="Entrenar" accent={colors.module.training} highlighted>
        <AppText variant="caption">
          Esta semana: {weekWorkouts}
          {weekGoal ? ` de ${weekGoal}` : ''} entrenamientos. Terminar una sesión con al menos 3 series hechas da +100 XP
          (una vez al día).
        </AppText>
        {inProgress ? (
          <Button label="Continuar sesión en curso" icon="play" onPress={() => router.push('/workout')} />
        ) : (
          <Button label="Sesión libre (sin rutina)" icon="flash" variant="secondary" onPress={start} loading={starting} />
        )}
        <Button label="Caminadora (cardio)" icon="walk" variant="secondary" onPress={() => router.push('/cardio')} />
      </Card>

      <Card title="Biblioteca de ejercicios" accent={colors.cyan}>
        <AppText variant="caption">
          {LIBRARY.length} ejercicios ilustrados ({LIBRARY.filter((e) => e.fitsMyEquipment).length} con tu equipamiento), con
          mapa de los músculos que trabajan, búsqueda y filtro por músculo.
        </AppText>
        <Button label="Abrir biblioteca" icon="search" onPress={() => router.push('/exercises')} />
      </Card>

      {SHOW_STICK_ANIMATIONS ? (
      <Card title="Técnica animada" accent={colors.violet}>
        <AppText variant="caption">Animaciones con las fases del movimiento y en qué poner el énfasis según la variante.</AppText>
        {groups().map((variants) => {
          const first = variants[0]!;
          const muscles = [...new Set(variants.flatMap((v) => v.primary))].map((m) => MUSCLE_LABEL[m]).join(' · ');
          return (
            <Pressable
              key={first.group}
              accessibilityRole="button"
              accessibilityLabel={`${first.name}. ${variants.length} variantes. Ver técnica`}
              onPress={() => router.push({ pathname: '/technique/[id]', params: { id: first.id } })}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="body" size={20} color={colors.violet} />
              </View>
              <View style={styles.flex}>
                <AppText variant="heading">{first.name}</AppText>
                <AppText variant="caption">
                  {variants.length > 1 ? `${variants.length} variantes · ` : ''}
                  {muscles}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          );
        })}
      </Card>
      ) : null}

      <Card title="Plan semanal" accent={colors.module.training}>
        {schedule.map((d) => {
          const t = templates.find((x) => x.id === d.templateId);
          const isToday = d.weekday === todayIdx;
          return (
            <View key={d.weekday} style={[styles.row, isToday && styles.today]}>
              <Pressable
                style={styles.flex}
                accessibilityRole="button"
                accessibilityLabel={`${WEEKDAY_LABEL[d.weekday]}: ${t ? t.name : 'descanso'}. Abrir rutina`}
                disabled={!t}
                onPress={() =>
                  t && (t.kind === 'cardio' ? router.push('/cardio') : router.push({ pathname: '/routine/[id]', params: { id: t.id } }))
                }
              >
                <AppText variant="label" color={isToday ? colors.cyan : colors.textFaint}>
                  {WEEKDAY_LABEL[d.weekday]}
                  {isToday ? ' · hoy' : ''}
                  {OPTIONAL_DAYS.has(d.weekday) ? ' · opcional' : ''}
                </AppText>
                <AppText variant="heading">{t ? t.name : 'Descanso'}</AppText>
                {t && t.kind !== 'cardio' ? <AppText variant="caption">{t.exerciseCount} ejercicios</AppText> : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cambiar lo que haces el ${WEEKDAY_LABEL[d.weekday]}`}
                onPress={() => changeDay(d.weekday)}
                style={styles.change}
                hitSlop={6}
              >
                <Ionicons name="swap-horizontal" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        })}
        <AppText variant="caption" color={colors.textFaint}>
          Toca un día para ver y editar su rutina; ⇄ para cambiar la rutina del día o dejarlo de descanso.
        </AppText>
        <Button label="Nueva rutina" icon="add" variant="ghost" onPress={newRoutine} />
      </Card>

      <Card title="Sesiones recientes" accent={colors.module.nutrition}>
        {recent.length === 0 ? (
          <AppText variant="caption">Aún no hay sesiones terminadas.</AppText>
        ) : (
          recent.map((w) => {
            const minutes = w.energyMinutes ?? (w.finishedAt ? (Date.parse(w.finishedAt) - Date.parse(w.startedAt)) / 60_000 : null);
            return (
              <View key={w.id} style={styles.sessionRow}>
                <View style={styles.flex}>
                  <AppText variant="heading">{w.templateName ?? 'Sesión libre'}</AppText>
                  <AppText variant="caption">
                    {formatShortDate(w.startedAt)} · {w.completedSets} series
                    {minutes != null ? ` · ${Math.round(minutes)} min` : ''}
                  </AppText>
                </View>
                {w.energyKcal != null ? (
                  <AppText variant="heading" color={colors.module.nutrition}>
                    ≈ {formatNumber(w.energyKcal, 0)} kcal
                  </AppText>
                ) : (
                  <AppText variant="caption" color={colors.textFaint} style={styles.pending}>
                    Falta tu peso de esa fecha
                  </AppText>
                )}
              </View>
            );
          })
        )}
        {recent.some((w) => w.energyKcal == null) ? (
          <>
            <TextField
              label="Tu peso de hoy"
              unit="kg"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="Ej. 70"
              error={weightError}
            />
            <Button label="Guardar peso y calcular" icon="flame" variant="secondary" onPress={saveWeight} />
          </>
        ) : null}
        <AppText variant="caption" color={colors.textFaint}>
          Kcal netas estimadas (±20 %). Las sesiones anteriores se calculan con el peso confirmado más cercano a su fecha (±30
          días); si no hay ninguno, se calculan en cuanto lo registres.
        </AppText>
      </Card>

      <Card title="Series por músculo esta semana" accent={colors.violet}>
        <AppText variant="caption">
          Series hechas en sesiones terminadas (lunes a domingo). Referencia: 10 o más por músculo a la semana se asocian a más
          crecimiento muscular.
        </AppText>
        {muscles.map((m) => {
          const n = weekSets[m] ?? 0;
          return (
            <View key={m} style={styles.volRow}>
              <AppText variant="body" style={styles.volLabel}>
                {MUSCLE_GROUP_LABEL[m]}
              </AppText>
              <View style={styles.flex}>
                <XPBar
                  progress={Math.min(1, n / WEEKLY_SETS_TARGET)}
                  color={n >= WEEKLY_SETS_TARGET ? colors.success : colors.violet}
                  accessibilityLabel={`${MUSCLE_GROUP_LABEL[m]}: ${n} series`}
                />
              </View>
              <AppText variant="label" color={n >= WEEKLY_SETS_TARGET ? colors.success : colors.textMuted} style={styles.volNum}>
                {n}
              </AppText>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  pending: { maxWidth: 120, textAlign: 'right' },
  today: { backgroundColor: 'rgba(34,211,238,0.06)' },
  change: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  volRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  volLabel: { width: 110 },
  volNum: { width: 28, textAlign: 'right' },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(139,92,246,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
