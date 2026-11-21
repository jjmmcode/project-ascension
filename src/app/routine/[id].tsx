import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText, Button, Card, EmptyState, Screen, TextField } from '@/components/ui';
import { templatesRepo, type Template, type TemplateExercise } from '@/database/repositories/templates';
import { findOption } from '@/features/training/exerciseOptions';
import { WEEKDAY_LABEL } from '@/features/training/defaultPlan';
import { primaryMuscles, startFromTemplate } from '@/services/plan';
import { MUSCLE_GROUP_LABEL } from '@/features/exercises/library';
import { useProfileStore } from '@/stores/profileStore';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

function ExerciseRow({
  item,
  first,
  last,
  onChanged,
}: {
  item: TemplateExercise;
  first: boolean;
  last: boolean;
  onChanged: () => void;
}) {
  const db = useSQLiteContext();
  const [sets, setSets] = useState(String(item.sets));
  const [target, setTarget] = useState(item.target);
  const [error, setError] = useState<string | null>(null);
  const libId = findOption(item.exerciseId)?.libraryId;

  const save = async () => {
    const n = Number(sets);
    try {
      await templatesRepo.updateExercise(db, item.id, { sets: n, target, notes: item.notes });
      setError(null);
      onChanged();
    } catch {
      setError('Series de 1 a 20 y un objetivo (p. ej. 12, 10–12 o 30 s)');
    }
  };

  const remove = () =>
    Alert.alert('Quitar de la rutina', `¿Quitar "${item.exerciseName}" de esta rutina? Tus sesiones pasadas no cambian.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          await templatesRepo.removeExercise(db, item.id);
          onChanged();
        },
      },
    ]);

  const move = async (dir: -1 | 1) => {
    await templatesRepo.move(db, item.id, dir);
    void Haptics.selectionAsync();
    onChanged();
  };

  return (
    <View style={styles.exRow}>
      <View style={styles.exHead}>
        <Pressable
          style={styles.flex}
          accessibilityRole="button"
          accessibilityLabel={`Ver técnica de ${item.exerciseName}`}
          onPress={() => libId && router.push({ pathname: '/exercises/[id]', params: { id: libId } })}
        >
          <AppText variant="heading">{item.exerciseName}</AppText>
          <AppText variant="caption">
            {primaryMuscles(item.exerciseId)
              .map((m) => MUSCLE_GROUP_LABEL[m])
              .join(' · ')}
            {item.notes ? ` · ${item.notes}` : ''}
          </AppText>
        </Pressable>
        <View style={styles.moveCol}>
          <Pressable accessibilityRole="button" accessibilityLabel="Subir" disabled={first} onPress={() => void move(-1)} hitSlop={6}>
            <Ionicons name="chevron-up" size={20} color={first ? colors.surfaceHigh : colors.textMuted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Bajar" disabled={last} onPress={() => void move(1)} hitSlop={6}>
            <Ionicons name="chevron-down" size={20} color={last ? colors.surfaceHigh : colors.textMuted} />
          </Pressable>
        </View>
      </View>
      <View style={styles.targetRow}>
        <View style={[styles.field, styles.fieldSets]}>
          <TextInput
            value={sets}
            onChangeText={setSets}
            onEndEditing={() => void save()}
            keyboardType="number-pad"
            style={styles.input}
            accessibilityLabel={`Series de ${item.exerciseName}`}
            selectTextOnFocus
          />
          <AppText variant="caption">series</AppText>
        </View>
        <AppText variant="heading" color={colors.textFaint}>
          ×
        </AppText>
        <View style={[styles.field, styles.flex]}>
          <TextInput
            value={target}
            onChangeText={setTarget}
            onEndEditing={() => void save()}
            style={styles.input}
            accessibilityLabel={`Objetivo de ${item.exerciseName}`}
            placeholder={item.exerciseType === 'time' ? '30 s' : '12'}
            placeholderTextColor={colors.textFaint}
            selectTextOnFocus
          />
          <AppText variant="caption">{item.exerciseType === 'time' ? 'seg' : 'reps'}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${item.exerciseName}`} onPress={remove} style={styles.trash}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export default function RoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const inProgress = useProfileStore((s) => s.inProgress);
  const refresh = useProfileStore((s) => s.refresh);
  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<TemplateExercise[]>([]);
  const [days, setDays] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    const t = await templatesRepo.get(db, id);
    setTemplate(t);
    setName((n) => (n ? n : (t?.name ?? '')));
    setItems(t ? await templatesRepo.exercises(db, id) : []);
    setDays((await templatesRepo.schedule(db, profile.id)).filter((d) => d.templateId === id).map((d) => d.weekday));
    setLoaded(true);
  }, [db, id, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const close = (
    <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.iconBtn}>
      <Ionicons name="arrow-back" size={22} color={colors.text} />
    </Pressable>
  );

  if (!template) {
    return (
      <Screen title="Rutina" subtitle="Plan semanal" accessory={close}>
        {loaded ? <EmptyState icon="albums-outline" title="Rutina no encontrada" message="Puede que la hayas borrado." /> : null}
      </Screen>
    );
  }

  const saveName = async () => {
    try {
      await templatesRepo.rename(db, template.id, name);
      setNameError(null);
      await refresh(db);
    } catch {
      setNameError('Entre 1 y 40 caracteres');
    }
  };

  const start = async () => {
    if (!profile) return;
    if (inProgress) {
      router.push('/workout');
      return;
    }
    setStarting(true);
    try {
      await startFromTemplate(db, profile.id, template.id);
      await refresh(db);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/workout');
    } finally {
      setStarting(false);
    }
  };

  const remove = () =>
    Alert.alert('Borrar rutina', `¿Borrar "${template.name}"? Los días que la usaban quedan como descanso. Tus sesiones pasadas no cambian.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          await templatesRepo.remove(db, template.id);
          await refresh(db);
          router.back();
        },
      },
    ]);

  const totalSets = items.reduce((a, e) => a + e.sets, 0);
  const isCardio = template.kind === 'cardio';

  return (
    <Screen
      title={template.name}
      subtitle={days.length ? days.map((d) => WEEKDAY_LABEL[d]).join(' · ') : 'Sin día asignado'}
      accessory={close}
    >
      <Card highlighted accent={colors.module.training}>
        {template.description ? <AppText variant="caption">{template.description}</AppText> : null}
        {isCardio ? (
          <>
            <AppText variant="caption">Registra velocidad, inclinación y minutos; la app calcula las kcal y la XP.</AppText>
            <Button label="Registrar caminadora" icon="walk" onPress={() => router.push('/cardio')} />
          </>
        ) : (
          <>
            <AppText variant="caption">
              {items.length} ejercicios · {totalSets} series. Al empezar, cada serie ya trae el objetivo y el peso que usaste la
              última vez; solo ajustas y marcas ✓.
            </AppText>
            <Button
              label={inProgress ? 'Continuar sesión en curso' : 'Empezar esta rutina'}
              icon={inProgress ? 'play' : 'flash'}
              onPress={start}
              loading={starting}
              disabled={!inProgress && items.length === 0}
            />
          </>
        )}
      </Card>

      {!isCardio ? (
        <Card title="Ejercicios" accent={colors.primary}>
          {items.length === 0 ? (
            <AppText variant="caption">Aún no hay ejercicios. Añade el primero.</AppText>
          ) : (
            items.map((e, i) => (
              <ExerciseRow
                key={`${e.id}-${e.sets}-${e.target}-${e.position}`}
                item={e}
                first={i === 0}
                last={i === items.length - 1}
                onChanged={() => void load()}
              />
            ))
          )}
          <AppText variant="caption" color={colors.textFaint}>
            Toca el nombre para ver la técnica. Cambia series y objetivo escribiendo encima; se guarda al salir del campo.
          </AppText>
          <Button
            label="Añadir ejercicio"
            icon="add"
            variant="secondary"
            onPress={() => router.push({ pathname: '/workout/add', params: { template: template.id } })}
          />
        </Card>
      ) : null}

      <Card title="Ajustes de la rutina">
        <TextField label="Nombre" value={name} onChangeText={setName} onEndEditing={() => void saveName()} error={nameError} />
        <Button label="Borrar rutina" icon="trash-outline" variant="danger" onPress={remove} />
      </Card>
    </Screen>
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
  exRow: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moveCol: { alignItems: 'center', gap: 2 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  field: {
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
  fieldSets: { width: 104 },
  input: { flex: 1, color: colors.text, fontSize: 18, fontWeight: '700', paddingVertical: 4 },
  trash: { width: 40, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
