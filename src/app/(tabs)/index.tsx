import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  AppText,
  Button,
  Card,
  DataStatusBadge,
  EmptyState,
  RankBadge,
  Screen,
  StatTile,
  XPBar,
} from '@/components/ui';
import { levelFromXp, minLevelFor } from '@/features/progression/leveling';
import { nextRank } from '@/features/progression/exams';
import { useProfileStore } from '@/stores/profileStore';
import { ShatterBadge } from '@/components/game/ShatterBadge';
import { PenanceStatusCard } from '@/features/penance/PenanceCards';
import { damageFor } from '@/services/penance';
import { formatNumber } from '@/lib/numbers';
import { formatShortDate } from '@/lib/time';
import { OPTIONAL_DAYS, WEEKDAY_LABEL } from '@/features/training/defaultPlan';
import { startFromTemplate } from '@/services/plan';
import { musclesAtRisk } from '@/services/attributes';
import { LAST_BACKUP_KEY } from '@/services/backup';
import { settingsRepo } from '@/database/repositories/settings';
import { z } from 'zod';
import { MUSCLE_GROUP_LABEL, type MuscleGroup } from '@/features/exercises/library';
import { colors, rankColors, spacing } from '@/theme';

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Registro manual',
  scale: 'Báscula',
  inbody: 'InBody',
  import: 'Importado',
};

export default function StatusScreen() {
  const profile = useProfileStore((s) => s.profile);
  const latest = useProfileStore((s) => s.latestMetric);
  const goals = useProfileStore((s) => s.goals);
  const xp = useProfileStore((s) => s.totalXp);
  const weekWorkouts = useProfileStore((s) => s.weekWorkouts);
  const inProgress = useProfileStore((s) => s.inProgress);
  const refresh = useProfileStore((s) => s.refresh);
  const today = useProfileStore((s) => s.today);
  const db = useSQLiteContext();
  const [starting, setStarting] = useState(false);

  const startToday = async () => {
    if (!profile || !today?.template) return;
    setStarting(true);
    try {
      await startFromTemplate(db, profile.id, today.template.id);
      await refresh(db);
      router.push('/workout');
    } finally {
      setStarting(false);
    }
  };

  const [backupStale, setBackupStale] = useState(false);
  const [atRisk, setAtRisk] = useState<Array<{ muscle: MuscleGroup; days: number }>>([]);
  useFocusEffect(
    useCallback(() => {
      void refresh(db);
      if (profile) {
        void musclesAtRisk(db, profile.id).then(setAtRisk);
        void settingsRepo.get(db, profile.id, LAST_BACKUP_KEY, z.string()).then((v) => setBackupStale(!v || Date.now() - Date.parse(v) > 14 * 86_400_000));
      }
    }, [db, refresh, profile]),
  );

  // Nivel y rango se derivan de la suma de xp_events.
  const lvl = levelFromXp(xp);
  const generalRank = useProfileStore((s) => s.generalRank);
  const state = { ...lvl, rank: generalRank };
  const rankColor = rankColors[state.rank];
  const upcoming = nextRank(generalRank);
  const damage = damageFor(lvl.level, generalRank);
  const examPending = upcoming != null && lvl.level >= minLevelFor(upcoming);

  const goalHint = (type: 'calories' | 'protein_g', unit: string) => {
    const g = goals[type];
    return g ? `Meta: ${formatNumber(g.targetValue, 0)} ${unit}` : 'Sin meta';
  };

  return (
    <Screen
      title="Status"
      subtitle="Sistema de progresión"
      accessory={
        <Pressable accessibilityRole="button" accessibilityLabel="Ajustes" onPress={() => router.push('/settings')} style={styles.gear}>
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </Pressable>
      }
    >
      <Card highlighted accent={rankColor}>
        <View style={styles.heroRow}>
          {damage > 0 ? <ShatterBadge rank={state.rank} damage={damage} size={60} /> : <RankBadge rank={state.rank} size={60} />}
          <View style={styles.heroText}>
            <AppText variant="label" color={colors.textFaint}>
              Personaje
            </AppText>
            <AppText variant="title" numberOfLines={1}>
              {profile?.displayName ?? '—'}
            </AppText>
            <AppText variant="caption" color={damage ? colors.danger : undefined}>
              Rango {state.rank}
              {damage ? ` · emblema ${['', 'agrietado', 'fracturado', 'destrozado'][damage]}` : ''}
            </AppText>
            {examPending ? (
              <AppText variant="caption" color={colors.warning} onPress={() => router.push('/quests')}>
                Examen de rango {upcoming} disponible →
              </AppText>
            ) : null}
          </View>
          <View style={styles.level}>
            <AppText variant="label" color={colors.textFaint}>
              Nivel
            </AppText>
            <AppText variant="display">{state.level}</AppText>
          </View>
        </View>

        <View style={styles.xpBlock}>
          <View style={styles.xpRow}>
            <AppText variant="label" color={colors.cyan}>
              XP
            </AppText>
            <AppText variant="caption">
              {formatNumber(state.xpIntoLevel, 0)} / {formatNumber(state.xpForNext, 0)}
            </AppText>
          </View>
          <XPBar
            progress={state.progress}
            color={colors.primary}
            accessibilityLabel={`Experiencia: ${state.xpIntoLevel} de ${state.xpForNext}`}
          />
          <AppText variant="caption" color={colors.textFaint}>
            Faltan {formatNumber(state.xpForNext - state.xpIntoLevel, 0)} XP para el nivel {state.level + 1}
          </AppText>
        </View>
      </Card>

      <PenanceStatusCard />
      {backupStale ? (
        <Card title="Copia de seguridad" accent={colors.warning}>
          <AppText variant="caption">Hace más de 2 semanas que no guardas una copia de tus datos (o nunca lo hiciste).</AppText>
          <Button label="Ir a Ajustes" icon="cloud-upload-outline" variant="secondary" onPress={() => router.push('/settings')} />
        </Card>
      ) : null}
      {atRisk.length > 0 ? (
        <Card title="Músculos en riesgo" accent={colors.warning}>
          <AppText variant="caption">
            {atRisk.map((r) => `${MUSCLE_GROUP_LABEL[r.muscle]}: ${Math.floor(r.days / 7)} semanas sin entrenar`).join(' · ')}. A
            las 6 semanas bajan de rank y pierdes sus puntos de atributo; entrénalos para mantenerlos.
          </AppText>
        </Card>
      ) : null}
      {today ? (
        <Card title={`Hoy · ${WEEKDAY_LABEL[today.weekday]}`} accent={colors.module.training} highlighted>
          {inProgress ? (
            <>
              <AppText variant="caption">Tienes una sesión en curso.</AppText>
              <Button label="Continuar entrenamiento" icon="play" onPress={() => router.push('/workout')} />
            </>
          ) : today.template && today.template.kind === 'cardio' ? (
            <>
              <AppText variant="heading">{today.template.name}</AppText>
              <AppText variant="caption">Día de cardio: registra velocidad, inclinación y minutos de la caminadora.</AppText>
              <Button label="Registrar caminadora" icon="walk" onPress={() => router.push('/cardio')} />
            </>
          ) : today.template ? (
            <>
              <AppText variant="heading">{today.template.name}</AppText>
              {OPTIONAL_DAYS.has(today.weekday) ? (
                <AppText variant="caption" color={colors.cyan}>
                  Día opcional: haz la rutina o tómate el descanso.
                </AppText>
              ) : null}
              <AppText variant="caption">
                {today.template.exerciseCount} ejercicios · las series vienen con tu objetivo y el peso de la última vez.
              </AppText>
              <Button
                label="Empezar"
                icon="flash"
                onPress={startToday}
                loading={starting}
                disabled={today.template.exerciseCount === 0}
              />
              <Button
                label="Ver o editar la rutina"
                variant="ghost"
                onPress={() => router.push({ pathname: '/routine/[id]', params: { id: today.template!.id } })}
              />
            </>
          ) : (
            <AppText variant="caption">Día de descanso en tu plan. Puedes cambiarlo en Training → Plan semanal.</AppText>
          )}
        </Card>
      ) : null}

      <Card title="Misión principal del día" accent={colors.module.quests}>
        <EmptyState
          icon="flag-outline"
          color={colors.module.quests}
          title="Sin misiones activas"
          message="Las misiones diarias se generarán a partir de tu rutina y tus objetivos."
          tag="Disponible en Etapa 5"
        />
      </Card>

      <View>
        <AppText variant="label" style={styles.sectionLabel}>
          Hoy
        </AppText>
        <View style={styles.grid}>
          <StatTile
            icon="barbell"
            label="Entrenos semana"
            value={String(weekWorkouts)}
            hint={goals.workouts_per_week ? `Meta: ${goals.workouts_per_week.targetValue} / semana` : 'Sin meta'}
            color={colors.module.training}
          />
          <StatTile icon="flame" label="Calorías" value="—" unit="kcal" hint={goalHint('calories', 'kcal')} color={colors.module.nutrition} />
          <StatTile icon="nutrition" label="Proteína" value="—" unit="g" hint={goalHint('protein_g', 'g')} color={colors.violet} />
          <StatTile icon="water" label="Agua" value="—" unit="ml" hint="Sin meta" color={colors.module.hydration} />
        </View>
      </View>

      <Card
        title="Última medición corporal"
        accent={colors.module.evolution}
        action={latest ? <DataStatusBadge status={latest.dataStatus} /> : undefined}
      >
        {latest ? (
          <View style={styles.metric}>
            <View style={styles.metricValues}>
              {latest.weightKg != null ? (
                <View>
                  <AppText variant="numeric">{formatNumber(latest.weightKg)}</AppText>
                  <AppText variant="caption">kg</AppText>
                </View>
              ) : null}
              {latest.bodyFatPercentage != null ? (
                <View>
                  <AppText variant="numeric">{formatNumber(latest.bodyFatPercentage)}</AppText>
                  <AppText variant="caption">% grasa</AppText>
                </View>
              ) : null}
              {latest.skeletalMuscleKg != null ? (
                <View>
                  <AppText variant="numeric">{formatNumber(latest.skeletalMuscleKg)}</AppText>
                  <AppText variant="caption">kg músculo</AppText>
                </View>
              ) : null}
            </View>
            <AppText variant="caption" color={colors.textFaint}>
              {formatShortDate(latest.measuredAt)} · {SOURCE_LABEL[latest.source] ?? latest.source}
              {latest.dataStatus !== 'confirmed' ? ' · no es una medición actual' : ''}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption">Aún no hay mediciones. Podrás registrar peso y cintura en Evolution (Etapa 6).</AppText>
        )}
      </Card>

      <Card title="Accesos rápidos">
        <View style={styles.quick}>
          {inProgress ? (
            <Button label="Continuar entrenamiento" icon="play" onPress={() => router.push('/workout')} />
          ) : (
            <Button label="Entrenar" icon="barbell" onPress={() => router.navigate('/training')} />
          )}
          <Button label="Caminadora" icon="walk" variant="secondary" onPress={() => router.push('/cardio')} />
          <Button label="Nutrición" icon="restaurant" variant="secondary" onPress={() => router.navigate('/nutrition')} />
          <Button label="Evolution" icon="trending-up" variant="secondary" onPress={() => router.navigate('/progress')} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroText: { flex: 1, gap: 2 },
  level: { alignItems: 'flex-end' },
  xpBlock: { gap: spacing.sm, marginTop: spacing.xs },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { gap: spacing.sm },
  metricValues: { flexDirection: 'row', gap: spacing.xl },
  quick: { gap: spacing.sm },
});
