import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';
import { FramePlayer } from '@/features/exercises/FramePlayer';
import { BodyMap } from '@/features/exercises/bodyMap/BodyMap';
import { EQUIPMENT_LABEL, getLibraryExercise, SHOW_STICK_ANIMATIONS } from '@/features/exercises/library';
import { findOption } from '@/features/training/exerciseOptions';
import { ensureExercise, workoutsRepo } from '@/database/repositories/workouts';
import { templatesRepo } from '@/database/repositories/templates';
import { swapSessionExercise } from '@/services/plan';
import { useProfileStore } from '@/stores/profileStore';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

export default function LibraryExerciseScreen() {
  const { id, pick, template, swap } = useLocalSearchParams<{ id: string; pick?: string; template?: string; swap?: string }>();
  const ex = id ? getLibraryExercise(id) : null;
  const picking = pick === '1';
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const refresh = useProfileStore((s) => s.refresh);
  const [adding, setAdding] = useState(false);

  const close = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={picking ? 'Volver a la lista' : 'Cerrar'}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/exercises'))}
      style={styles.close}
    >
      <Ionicons name={picking ? 'arrow-back' : 'close'} size={22} color={colors.text} />
    </Pressable>
  );

  if (!ex) {
    return (
      <Screen title="Ejercicio" subtitle="Biblioteca" accessory={close}>
        <EmptyState icon="help-circle-outline" title="Ejercicio no encontrado" message="Vuelve a la biblioteca e inténtalo de nuevo." />
      </Screen>
    );
  }

  const addToSession = async () => {
    const opt = findOption(ex.id);
    if (!profile || !opt || adding) return;
    setAdding(true);
    try {
      await ensureExercise(db, opt.ref);
      if (swap) {
        const w = await workoutsRepo.getInProgress(db, profile.id);
        if (!w) throw new Error('No hay una sesión en curso');
        await swapSessionExercise(db, w.id, swap, opt.ref.id);
        await refresh(db);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.dismissTo('/workout');
        return;
      }
      if (template) {
        await templatesRepo.addExercise(db, template, opt.ref.id, {
          sets: ex.measure === 'time' ? 3 : 4,
          target: ex.measure === 'time' ? '30 s' : '12',
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.dismissTo({ pathname: '/routine/[id]', params: { id: template } });
        return;
      }
      const w = await workoutsRepo.start(db, profile.id);
      await workoutsRepo.addSet(db, w.id, opt.ref.id);
      await refresh(db);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismissTo('/workout');
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Inténtalo de nuevo');
    } finally {
      setAdding(false);
    }
  };

  const addButton = picking ? (
    <Button label={template ? 'Añadir a la rutina' : swap ? 'Cambiar por este ejercicio' : 'Añadir a la sesión'} icon="add-circle" onPress={addToSession} loading={adding} />
  ) : null;

  return (
    <Screen title={ex.name} subtitle={picking ? 'Revisa la técnica antes de añadir' : 'Biblioteca'} accessory={close}>
      {addButton}

      <Card highlighted accent={colors.cyan}>
        {ex.images ? (
          <FramePlayer frames={ex.images} accessibilityLabel={`Ilustración de ${ex.name}: posición inicial y contracción`} />
        ) : null}
        {ex.imageNote ? (
          <AppText variant="caption" color={colors.warning}>
            {ex.imageNote}
          </AppText>
        ) : null}
      </Card>

      <Card title="Músculos que trabajas" accent={colors.violet}>
        <BodyMap primary={ex.primaryRegions} secondary={ex.secondaryRegions} />
      </Card>

      {ex.tips.length && ex.translated ? (
        <Card title="Dónde poner el énfasis" accent={colors.violet}>
          {ex.tips.map((s, i) => (
            <View key={i} style={styles.step}>
              <Ionicons name="flash" size={14} color={colors.violet} style={styles.tipIcon} />
              <AppText variant="body" style={styles.flex}>
                {s}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {SHOW_STICK_ANIMATIONS && ex.techniqueId ? (
        <Button
          label="Ver animación de técnica"
          icon="body"
          variant="secondary"
          onPress={() => router.push({ pathname: '/technique/[id]', params: { id: ex.techniqueId! } })}
        />
      ) : null}

      {!ex.translated ? (
        <Card accent={colors.warning}>
          <AppText variant="caption" color={colors.warning}>
            Instrucciones aún en inglés (texto original). La adaptación al español está en curso.
          </AppText>
        </Card>
      ) : null}

      {ex.summary ? <AppText variant="body" color={colors.textMuted}>{ex.summary}</AppText> : null}

      {ex.steps.length ? (
        <Card title="Ejecución" accent={colors.primary}>
          {ex.steps.map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <AppText variant="label" color={colors.primary}>
                  {i + 1}
                </AppText>
              </View>
              <AppText variant="body" style={styles.flex}>
                {s}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {ex.tips.length && !ex.translated ? (
        <Card title="Tips" accent={colors.violet}>
          {ex.tips.map((s, i) => (
            <AppText key={i} variant="body">
              • {s}
            </AppText>
          ))}
        </Card>
      ) : null}

      <Card title="Equipo">
        <View style={styles.tags}>
          {ex.equipment.map((e) => (
            <View key={e} style={styles.tag}>
              <Ionicons name="barbell-outline" size={12} color={colors.textMuted} />
              <AppText variant="caption">{EQUIPMENT_LABEL[e] ?? e}</AppText>
            </View>
          ))}
        </View>
        {!ex.fitsMyEquipment ? (
          <AppText variant="caption" color={colors.warning}>
            Requiere equipo que no está en tu lista.
          </AppText>
        ) : null}
      </Card>

      {addButton}

      <Pressable accessibilityRole="link" onPress={() => router.push('/credits')}>
        <AppText variant="caption" color={colors.textFaint}>
          Ilustración y texto base: Everkinetic ({ex.nameEn}), CC BY-SA 4.0. Recoloreado
          {ex.translated ? ', traducido y adaptado' : ''}. Mapa muscular: diseño propio. Guía general: no reemplaza a un
          profesional. Ver créditos.
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  close: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tipIcon: { marginTop: 4 },
});
