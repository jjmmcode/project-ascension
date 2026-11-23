import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playSound } from '@/features/sound/sound';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { AppText, Button, Card, EmptyState, RankBadge, Screen, TextField, XPBar } from '@/components/ui';
import { bodyMetricsRepo } from '@/database';
import { effectiveLoadKg, usableBodyweight, validateAssistance, type LoadMode } from '@/features/training/load';
import { workoutsRepo, type Workout, type WorkoutSet } from '@/database/repositories/workouts';
import { findOption } from '@/features/training/exerciseOptions';
import { getLibraryExercise } from '@/features/exercises/library';
import { sessionSuggestions, sessionTargets } from '@/services/plan';
import type { Suggestion } from '@/features/training/progression';
import { RestTimer, restSecondsFor } from '@/features/training/RestTimer';
import { computePhysique } from '@/services/physique';
import { rankUps } from '@/features/physique/physique';
import { LevelUpOverlay, type LevelUpEvent } from '@/components/game/LevelUpOverlay';
import { computeAttributes, ATTRIBUTE_INFO, type AttributePoint } from '@/features/attributes/engine';
import { awardRecoveries, loadAttributeInput } from '@/services/attributes';
import { claimWeakMission, evaluateRank, weakMission, WEAK_MISSION_XP } from '@/services/progression';
import type { Rank } from '@/features/progression/leveling';

const toEventPoint = (p: AttributePoint) => ({ attr: ATTRIBUTE_INFO[p.attr].short, reason: p.reason });
import type { TemplateExercise } from '@/database/repositories/templates';
import { levelFromXp } from '@/features/progression/leveling';
import { abandonWorkout, finishWorkout, MIN_COMPLETED_SETS, recomputeWorkoutEnergy, WorkoutValidationError, type FinishResult } from '@/services/workoutSession';
import { useProfileStore } from '@/stores/profileStore';
import { formatNumber, parseDecimal } from '@/lib/numbers';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

function useElapsed(startIso: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!startIso) return '00:00';
  const s = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

const FIELD_LABEL: Record<LoadMode, string> = { external: 'kg', bodyweight: 'lastre kg', assisted: 'asist. kg' };

interface SetRowProps {
  set: WorkoutSet;
  /** Peso corporal actual (para series nuevas de ejercicios con peso corporal). */
  bodyweightKg: number | null;
  onSaved: () => void;
  onDelete: (set: WorkoutSet) => void;
  /** Se llama al marcar la serie como hecha (inicia el descanso). */
  onCompleted?: (set: WorkoutSet) => void;
}

function SetRow({ set, bodyweightKg, onSaved, onDelete, onCompleted }: SetRowProps) {
  const db = useSQLiteContext();
  const mode = set.loadMode;
  const loadValue = mode === 'assisted' ? set.assistanceKg : set.weightKg;
  const timed = set.exerciseType === 'time';
  const [reps, setReps] = useState((timed ? set.durationSeconds : set.repetitions)?.toString() ?? '');
  const [kg, setKg] = useState(loadValue != null ? formatNumber(loadValue, 2) : '');
  const [error, setError] = useState<string | null>(null);
  const swipe = useRef<SwipeableMethods>(null);

  // Máquina de discos a ambos lados: se anota el total y se muestra cuánto va en cada lado.
  const plates = getLibraryExercise(findOption(set.exerciseId)?.libraryId ?? set.exerciseId)?.plateLoading === 'both-sides';
  const typedKg = parseDecimal(kg);

  // Peso corporal de la serie: el guardado en la serie (foto del día) o el actual.
  const bw = set.bodyweightKg ?? (mode === 'external' ? null : bodyweightKg);

  const save = async (completed: boolean) => {
    const r = parseDecimal(reps);
    const w = parseDecimal(kg);
    if ((r !== null && (Number.isNaN(r) || !Number.isInteger(r))) || (w !== null && Number.isNaN(w))) {
      setError('Revisa los números');
      return false;
    }
    if (completed && (r === null || r === 0)) {
      setError(timed ? 'Indica los segundos' : 'Indica las repeticiones');
      return false;
    }
    const assistError = mode === 'assisted' ? validateAssistance(w, bw) : null;
    if (assistError) {
      setError(assistError);
      return false;
    }
    try {
      await workoutsRepo.updateSet(db, set.id, {
        repetitions: timed ? null : r,
        durationSeconds: timed ? r : null,
        weightKg: mode === 'assisted' ? null : w,
        assistanceKg: mode === 'assisted' ? w : null,
        bodyweightKg: mode === 'external' ? null : bw,
        completed,
      });
      setError(null);
      onSaved();
      return true;
    } catch {
      setError('Valor fuera de rango');
      return false;
    }
  };

  const toggle = async () => {
    const ok = await save(!set.completed);
    if (ok && !set.completed) {
      onCompleted?.(set);
      void playSound('set_done');
    }
    if (ok) void Haptics.impactAsync(set.completed ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
  };

  const openMenu = () =>
    Alert.alert(`Serie ${set.setNumber}`, '¿Qué quieres hacer con esta serie?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar serie', style: 'destructive', onPress: () => onDelete(set) },
    ]);

  const typed = parseDecimal(kg);
  const effective =
    mode === 'external'
      ? null
      : effectiveLoadKg(mode, {
          weightKg: mode === 'bodyweight' ? (typed !== null && !Number.isNaN(typed) ? typed : null) : null,
          assistanceKg: mode === 'assisted' ? (typed !== null && !Number.isNaN(typed) ? typed : null) : null,
          bodyweightKg: bw,
        });

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Eliminar serie ${set.setNumber}`}
          onPress={() => {
            swipe.current?.close();
            onDelete(set);
          }}
          style={styles.swipeDelete}
        >
          <Ionicons name="trash" size={20} color={colors.text} />
          <AppText variant="label" color={colors.text}>
            Eliminar
          </AppText>
        </Pressable>
      )}
    >
      <View style={styles.setWrap}>
        <View style={[styles.setRow, set.completed && styles.setDone]}>
          <Pressable
            onPress={openMenu}
            accessibilityRole="button"
            accessibilityLabel={`Serie ${set.setNumber}. Abrir opciones`}
            style={styles.setNum}
          >
            <AppText variant="label" color={set.completed ? colors.success : colors.textMuted}>
              {set.setNumber}
            </AppText>
            <Ionicons name="ellipsis-horizontal" size={12} color={colors.textFaint} />
          </Pressable>
          <View style={styles.field}>
            <TextInput
              value={reps}
              onChangeText={setReps}
              onEndEditing={() => void save(set.completed)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              accessibilityLabel={`${timed ? 'Segundos' : 'Repeticiones'} serie ${set.setNumber}`}
              selectTextOnFocus
            />
            <AppText variant="caption">{timed ? 'seg' : 'reps'}</AppText>
          </View>
          <View style={styles.field}>
            <TextInput
              value={kg}
              onChangeText={setKg}
              onEndEditing={() => void save(set.completed)}
              keyboardType="decimal-pad"
              placeholder={mode === 'external' ? '—' : '0'}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              accessibilityLabel={`${FIELD_LABEL[mode]} serie ${set.setNumber}`}
              selectTextOnFocus
            />
            <AppText variant="caption">{FIELD_LABEL[mode]}</AppText>
          </View>
          <Pressable
            onPress={toggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: set.completed }}
            accessibilityLabel={`Marcar serie ${set.setNumber} como hecha`}
            style={[styles.check, set.completed && styles.checkOn]}
          >
            <Ionicons name="checkmark" size={22} color={set.completed ? colors.bg : colors.textFaint} />
          </Pressable>
        </View>
        {plates ? (
          <AppText variant="caption" color={colors.textFaint} style={styles.effective}>
            {typedKg != null && !Number.isNaN(typedKg) && typedKg > 0
              ? `Total de discos ${formatNumber(typedKg)} kg ≈ ${formatNumber(typedKg / 2, 2)} kg por lado`
              : 'Anota el total de discos de ambos lados'}
          </AppText>
        ) : null}
        {mode !== 'external' ? (
          <AppText variant="caption" color={effective != null && effective > 0 ? colors.cyan : colors.textFaint} style={styles.effective}>
            {effective != null
              ? `Carga efectiva ≈ ${formatNumber(effective)} kg (${formatNumber(bw!)} ${mode === 'assisted' ? '−' : '+'} ${formatNumber(
                  typed !== null && !Number.isNaN(typed) ? typed : 0,
                )})`
              : 'Registra tu peso de hoy para calcular la carga efectiva'}
          </AppText>
        ) : null}
        {error ? (
          <AppText variant="caption" color={colors.danger}>
            {error}
          </AppText>
        ) : null}
      </View>
    </ReanimatedSwipeable>
  );
}

/** Tarjeta para registrar el peso del día cuando hay ejercicios con peso corporal. */
function BodyweightPrompt({ onSaved, reason }: { onSaved: () => void; reason?: string }) {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const kg = parseDecimal(value);
    if (kg === null || Number.isNaN(kg) || kg < 30 || kg > 300) {
      setError('Introduce un peso entre 30 y 300 kg');
      return;
    }
    if (!profile) return;
    await bodyMetricsRepo.create(db, profile.id, { measuredAt: new Date().toISOString(), weightKg: kg, source: 'manual' });
    setError(null);
    onSaved();
  };
  return (
    <Card title="Tu peso de hoy" accent={colors.cyan}>
      <AppText variant="caption">
        {reason ??
          'Las dominadas y los fondos usan tu peso como carga. Con él, la app calcula la carga efectiva (peso − asistencia o peso + lastre). Se guarda también en Evolution.'}
      </AppText>
      <View style={styles.bwRow}>
        <View style={styles.flex}>
          <TextField label="Peso corporal" unit="kg" value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="Ej. 70" error={error} />
        </View>
      </View>
      <Button label="Guardar peso" icon="checkmark" variant="secondary" onPress={save} />
    </Card>
  );
}

function EnergyCard({ result }: { result: FinishResult }) {
  const db = useSQLiteContext();
  const refreshStore = useProfileStore((s) => s.refresh);
  const [energy, setEnergy] = useState(result.energy);
  if (!energy) {
    return (
      <BodyweightPrompt
        reason="Para estimar las kcal de esta sesión necesito tu peso de los últimos 30 días. Se guarda también en Evolution."
        onSaved={() => {
          void (async () => {
            setEnergy(await recomputeWorkoutEnergy(db, result.workout.id));
            await refreshStore(db);
          })();
        }}
      />
    );
  }
  return (
    <Card title="Gasto estimado" accent={colors.module.nutrition}>
      <AppText variant="display" color={colors.module.nutrition}>
        ≈ {formatNumber(energy.kcal, 0)} kcal
      </AppText>
      <AppText variant="caption">
        Rango probable {formatNumber(energy.low, 0)}–{formatNumber(energy.high, 0)} kcal netas · {energy.minutes} min ·{' '}
        {energy.metLabel} ({formatNumber(energy.met, 1)} MET)
        {result.volumeKg > 0 ? ` · volumen ${formatNumber(result.volumeKg, 0)} kg` : ''}
      </AppText>
      {energy.capped ? (
        <AppText variant="caption" color={colors.warning}>
          La sesión estuvo abierta más tiempo del que corresponde a tus series; usé {energy.minutes} min para no inflar el cálculo.
        </AppText>
      ) : null}
      <View style={styles.fitia}>
        <AppText variant="label" color={colors.textFaint}>
          Para Fitia
        </AppText>
        <AppText variant="heading" selectable>
          Entrenamiento con pesas · {energy.minutes} min · ≈ {formatNumber(energy.kcal, 0)} kcal
        </AppText>
      </View>
      <AppText variant="caption" color={colors.textFaint}>
        Kcal netas: ya descuentan lo que gastarías en reposo, para no contarlo dos veces con tu gasto diario. Estimación del
        Compendio de Actividad Física 2024; sin pulsómetro el margen es de ±20 %. La caminadora se suma aparte.
      </AppText>
    </Card>
  );
}

function ResultView({
  result,
  xpBefore,
  xpAfter,
  muscleUps,
  points,
  recovered,
  rankBefore,
  rankAfter,
  missionXp,
}: {
  rankBefore: Rank;
  rankAfter: Rank;
  missionXp: number;
  result: FinishResult;
  xpBefore: number;
  xpAfter: number;
  muscleUps: LevelUpEvent['muscleUps'];
  points: LevelUpEvent['points'];
  recovered: LevelUpEvent['points'];
}) {
  const after = levelFromXp(Math.max(xpAfter, xpBefore + result.xp.awarded));
  const before = levelFromXp(xpBefore);
  const leveledUp = after.level > before.level;
  const [celebrate, setCelebrate] = useState(
    leveledUp || rankAfter !== rankBefore || muscleUps.length > 0 || recovered.length > 0,
  );
  return (
    <Screen title="Entrenamiento completado" subtitle="Misión cumplida">
      {celebrate ? (
        <LevelUpOverlay
          event={{
            fromLevel: before.level,
            toLevel: after.level,
            fromRank: rankBefore,
            toRank: rankAfter,
            xpGained: xpAfter - xpBefore,
            muscleUps,
            points,
            recovered,
          }}
          onClose={() => setCelebrate(false)}
        />
      ) : null}
      <Card highlighted accent={colors.success}>
        <View style={styles.resultHead}>
          <RankBadge rank={rankAfter} size={56} />
          <View style={styles.flex}>
            <AppText variant="display" color={result.xp.awarded ? colors.cyan : colors.textMuted}>
              {result.xp.awarded ? `+${result.xp.awarded} XP` : '+0 XP'}
            </AppText>
            <AppText variant="caption">
              {result.completedSets} series registradas
              {leveledUp ? ` · ¡Subiste a nivel ${after.level}!` : ''}
            </AppText>
          </View>
        </View>
        <XPBar progress={after.progress} accessibilityLabel={`Nivel ${after.level}`} />
        <AppText variant="caption">
          Nivel {after.level} · {formatNumber(after.xpIntoLevel, 0)} / {formatNumber(after.xpForNext, 0)} XP
        </AppText>
        {result.xp.reason === 'daily_cap' ? (
          <AppText variant="caption" color={colors.warning}>
            Ya recibiste la XP de entrenamiento de hoy. El entrenamiento queda guardado igual: el sistema no premia
            entrenar más de una vez al día.
          </AppText>
        ) : null}
      </Card>
      {result.comebackXp > 0 ? (
        <Card title="Memoria muscular · XP ×2" accent={colors.violet}>
          <AppText variant="caption">
            +{result.comebackXp} XP extra por volver: sigue así hasta recuperar tu nivel máximo.
          </AppText>
        </Card>
      ) : null}
      {missionXp > 0 ? (
        <Card title="Misión semanal completada" accent={colors.module.quests}>
          <AppText variant="caption">Reforzaste tu músculo más débil esta semana: +{missionXp} XP.</AppText>
        </Card>
      ) : null}
      <EnergyCard result={result} />
      <Button label="Volver a Status" icon="pulse" onPress={() => router.replace('/')} />
    </Screen>
  );
}

export default function WorkoutSessionScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);
  const xpNow = useProfileStore((s) => s.totalXp);
  const refreshStore = useProfileStore((s) => s.refresh);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [targets, setTargets] = useState<Map<string, TemplateExercise>>(new Map());
  const [suggestions, setSuggestions] = useState<Map<string, { suggestion: Suggestion; last: WorkoutSet[] }>>(new Map());
  const [rest, setRest] = useState<{ endsAt: number; total: number; label: string } | null>(null);
  const startRest = useCallback((set: WorkoutSet) => {
    const total = restSecondsFor(set.exerciseId);
    setRest({ endsAt: Date.now() + total * 1000, total, label: `${set.exerciseName} · serie ${set.setNumber} hecha` });
  }, []);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    r: FinishResult;
    xpBefore: number;
    xpAfter: number;
    muscleUps: LevelUpEvent['muscleUps'];
    points: LevelUpEvent['points'];
    recovered: LevelUpEvent['points'];
    rankBefore: Rank;
    rankAfter: Rank;
    missionXp: number;
  } | null>(null);
  const [undo, setUndo] = useState<WorkoutSet | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMetric = useProfileStore((s) => s.latestMetric);
  const bodyweight = usableBodyweight(latestMetric);
  const elapsed = useElapsed(workout?.startedAt);

  const load = useCallback(async () => {
    if (!profile) return;
    const w = await workoutsRepo.getInProgress(db, profile.id);
    setWorkout(w);
    setSets(w ? await workoutsRepo.listSets(db, w.id) : []);
    setTargets(w ? await sessionTargets(db, w) : new Map());
    setSuggestions(w ? await sessionSuggestions(db, w) : new Map());
  }, [db, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const groups = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const s of sets) map.set(s.exerciseId, [...(map.get(s.exerciseId) ?? []), s]);
    return [...map.entries()];
  }, [sets]);
  const doneCount = sets.filter((s) => s.completed).length;
  const needsBodyweight = bodyweight == null && sets.some((s) => s.loadMode !== 'external' && s.bodyweightKg == null);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  if (result) {
    return (
      <ResultView
        result={result.r}
        xpBefore={result.xpBefore}
        xpAfter={result.xpAfter}
        muscleUps={result.muscleUps}
        points={result.points}
        recovered={result.recovered}
        rankBefore={result.rankBefore}
        rankAfter={result.rankAfter}
        missionXp={result.missionXp}
      />
    );
  }

  const close = (
    <Pressable accessibilityRole="button" accessibilityLabel="Minimizar sesión" onPress={() => router.back()} style={styles.iconBtn}>
      <Ionicons name="chevron-down" size={22} color={colors.text} />
    </Pressable>
  );

  if (!workout) {
    return (
      <Screen title="Entrenamiento" subtitle="Sesión" accessory={close}>
        <EmptyState icon="barbell-outline" title="No hay una sesión en curso" message="Empieza una desde Training." />
      </Screen>
    );
  }

  const finish = () =>
    Alert.alert('Terminar entrenamiento', `${doneCount} series hechas. ¿Terminar y guardar?`, [
      { text: 'Seguir entrenando', style: 'cancel' },
      {
        text: 'Terminar',
        onPress: async () => {
          setBusy(true);
          try {
            const xpBefore = xpNow;
            const ranksBefore = profile ? (await computePhysique(db, profile.id)).ranks : [];
            const attrsBefore = profile ? computeAttributes(await loadAttributeInput(db, profile.id)) : null;
            const r = await finishWorkout(db, workout.id);
            const ranksAfter = profile ? (await computePhysique(db, profile.id)).ranks : [];
            let points: LevelUpEvent['points'] = [];
            let recovered: LevelUpEvent['points'] = [];
            if (profile && attrsBefore) {
              const mid = computeAttributes(await loadAttributeInput(db, profile.id));
              recovered = (await awardRecoveries(db, profile.id, attrsBefore, mid)).map(toEventPoint);
              // Con el bonus de memoria muscular puede haber subido otro nivel: recalcular
              const after = computeAttributes(await loadAttributeInput(db, profile.id));
              points = after.points.filter((p) => p.level > attrsBefore.level).map(toEventPoint);
            }
            let rankAfter = useProfileStore.getState().generalRank;
            const rankBefore = rankAfter;
            let missionXp = 0;
            if (profile) {
              const ev = await evaluateRank(db, profile.id);
              rankAfter = ev.passed;
              const m = await weakMission(db, profile.id, new Date(), ev.muscles);
              if (await claimWeakMission(db, profile.id, m)) missionXp = WEAK_MISSION_XP;
            }
            await refreshStore(db);
            const xpAfter = useProfileStore.getState().totalXp;
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const celebrates = levelFromXp(xpAfter).level > levelFromXp(xpBefore).level || rankAfter !== rankBefore;
            if (!celebrates) {
              void playSound('session_done');
              if (missionXp) setTimeout(() => void playSound('mission'), 700);
            }
            setResult({
              r,
              xpBefore,
              xpAfter,
              muscleUps: rankUps(ranksBefore, ranksAfter),
              points,
              recovered,
              rankBefore,
              rankAfter,
              missionXp,
            });
          } catch (e) {
            Alert.alert('No se puede terminar todavía', e instanceof WorkoutValidationError ? e.message : 'Error al guardar.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  /** Borra al instante y ofrece «Deshacer» durante 5 s (más rápido que confirmar en pleno entrenamiento). */
  const deleteSet = async (set: WorkoutSet) => {
    await workoutsRepo.deleteSet(db, set.id);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(set);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
    await load();
  };

  const undoDelete = async () => {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await workoutsRepo.restoreSet(db, undo);
    setUndo(null);
    await load();
  };

  const removeExercise = (exerciseId: string, name: string, count: number) =>
    Alert.alert(
      'Quitar ejercicio',
      `¿Quitar "${name}" de esta sesión? Se borrarán sus ${count} ${count === 1 ? 'serie' : 'series'}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            await workoutsRepo.removeExercise(db, workout.id, exerciseId);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await load();
          },
        },
      ],
    );

  const discard = () =>
    Alert.alert('Descartar sesión', 'La sesión se cerrará sin otorgar XP. Las series quedan en el historial como abandonadas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: async () => {
          await abandonWorkout(db, workout.id);
          await refreshStore(db);
          router.back();
        },
      },
    ]);

  return (
    <View style={styles.flex}>
    <Screen title="Entrenamiento" subtitle={`En curso · ${elapsed}`} accessory={close}>
      <Card highlighted accent={colors.module.training}>
        <View style={styles.summary}>
          <View>
            <AppText variant="numeric">{doneCount}</AppText>
            <AppText variant="caption">series hechas</AppText>
          </View>
          <View>
            <AppText variant="numeric">{groups.length}</AppText>
            <AppText variant="caption">ejercicios</AppText>
          </View>
          <View>
            <AppText variant="numeric">{elapsed}</AppText>
            <AppText variant="caption">duración</AppText>
          </View>
        </View>
        <AppText variant="caption" color={colors.textFaint}>
          Cada serie trae el objetivo de tu rutina y el peso de la última vez. Ajusta lo que hiciste y toca ✓; se guarda al
          instante. Deja 1–3 repeticiones en reserva. Para borrar una serie, deslízala a la
          izquierda o toca su número. La papelera quita el ejercicio completo.
        </AppText>
      </Card>

      {needsBodyweight ? (
        <BodyweightPrompt
          onSaved={() => {
            void refreshStore(db).then(load);
          }}
        />
      ) : null}

      {groups.map(([exerciseId, list]) => {
        const opt = findOption(exerciseId);
        const target = targets.get(exerciseId);
        return (
          <Card key={exerciseId} title={list[0]!.exerciseName} accent={colors.primary}
            action={
              <View style={styles.cardActions}>
                {opt?.libraryId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ver técnica"
                    hitSlop={10}
                    style={styles.cardAction}
                    onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: opt.libraryId! } })}
                  >
                    <Ionicons name="body-outline" size={20} color={colors.violet} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Cambiar ${list[0]!.exerciseName} por otro ejercicio`}
                  hitSlop={10}
                  style={styles.cardAction}
                  onPress={() => router.push({ pathname: '/workout/add', params: { swap: exerciseId } })}
                >
                  <Ionicons name="swap-horizontal" size={20} color={colors.cyan} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${list[0]!.exerciseName} de la sesión`}
                  hitSlop={10}
                  style={styles.cardAction}
                  onPress={() => removeExercise(exerciseId, list[0]!.exerciseName, list.length)}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            }
          >
            {target ? (
              <AppText variant="caption" color={colors.cyan}>
                Objetivo: {target.sets} × {target.target}
                {target.exerciseType === 'time' && !/s\b|seg/.test(target.target) ? ' s' : ''}
                {target.notes ? ` · ${target.notes}` : ''}
              </AppText>
            ) : null}
            {suggestions.get(exerciseId) ? <SuggestionLine data={suggestions.get(exerciseId)!} /> : null}
            {list.map((s) => (
              <SetRow
                key={`${s.id}-${s.completed}-${s.bodyweightKg ?? bodyweight ?? 'x'}`}
                set={s}
                bodyweightKg={bodyweight}
                onSaved={() => void load()}
                onCompleted={startRest}
                onDelete={(x) => void deleteSet(x)}
              />
            ))}
            <Button
              label="Añadir serie"
              icon="add"
              variant="ghost"
              onPress={async () => {
                await workoutsRepo.addSet(db, workout.id, exerciseId);
                await load();
              }}
            />
          </Card>
        );
      })}

      <Button label="Añadir ejercicio" icon="add-circle" variant="secondary" onPress={() => router.push('/workout/add')} />
      <Button
        label={doneCount >= MIN_COMPLETED_SETS ? 'Terminar entrenamiento' : `Terminar (mínimo ${MIN_COMPLETED_SETS} series hechas)`}
        icon="flag"
        onPress={finish}
        loading={busy}
        disabled={doneCount < MIN_COMPLETED_SETS}
      />
      <Button label="Descartar sesión" variant="danger" onPress={discard} />
      {rest ? <View style={{ height: 170 + insets.bottom }} /> : null}
    </Screen>
    {rest && !undo ? (
      <RestTimer
        endsAt={rest.endsAt}
        total={rest.total}
        label={rest.label}
        onAdjust={(d) => setRest((r) => (r ? { ...r, endsAt: Math.max(Date.now(), r.endsAt + d * 1000), total: Math.max(15, r.total + d) } : r))}
        onSkip={() => setRest(null)}
        onDone={() => setTimeout(() => setRest((r) => (r && r.endsAt <= Date.now() ? null : r)), 4000)}
      />
    ) : null}
    {undo ? (
      <View style={[styles.snackbar, { bottom: spacing.xl + insets.bottom }]} accessibilityLiveRegion="polite">
        <AppText variant="body" style={styles.flex}>
          Serie {undo.setNumber} de {undo.exerciseName} eliminada
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Deshacer" onPress={() => void undoDelete()} hitSlop={10}>
          <AppText variant="label" color={colors.cyan}>
            Deshacer
          </AppText>
        </Pressable>
      </View>
    ) : null}
    </View>
  );
}

function SuggestionLine({ data }: { data: { suggestion: Suggestion; last: WorkoutSet[] } }) {
  const s = data.suggestion;
  const what = s.field === 'assistance' ? 'asistencia' : 'peso';
  const last = data.last.map((x) => x.repetitions ?? '–').join(', ');
  if (s.kind === 'increase') {
    return (
      <AppText variant="caption" color={colors.success}>
        ↑ Toca subir: {what} {formatNumber(s.fromKg, 2)} → {formatNumber(s.toKg, 2)} kg y empieza en {s.reps} reps (la última vez
        llegaste al tope en todas: {last}).
      </AppText>
    );
  }
  return (
    <AppText variant="caption" color={colors.textMuted}>
      Mismo {what}
      {s.kg != null ? ` (${formatNumber(s.kg, 2)} kg)` : ''}: busca {s.goalReps} reps en todas las series. Última vez: {last}.
    </AppText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  setDone: { backgroundColor: 'rgba(34,197,94,0.08)' },
  setNum: { width: 36, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  setWrap: { backgroundColor: colors.surface, gap: 2 },
  swipeDelete: {
    width: 96,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    marginVertical: spacing.xs,
  },
  effective: { paddingLeft: 44 },
  fitia: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bwRow: { flexDirection: 'row', gap: spacing.sm },
  snackbar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    elevation: 8,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  input: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700', paddingVertical: 4 },
  check: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
