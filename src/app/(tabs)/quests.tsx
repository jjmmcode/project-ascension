import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { AppText, Card, RankBadge, Screen, XPBar } from '@/components/ui';
import { colors, rankColors, spacing } from '@/theme';
import { useProfileStore } from '@/stores/profileStore';
import { levelFromXp, RANK_THRESHOLDS } from '@/features/progression/leveling';
import { RANK_EXAMS } from '@/features/progression/exams';
import { MUSCLE_GROUP_LABEL } from '@/features/exercises/library';
import { formatNumber } from '@/lib/numbers';
import {
  claimWeakMission,
  EXAM_XP,
  evaluateRank,
  weakMission,
  WEAK_MISSION_XP,
  type RankEvaluation,
  type WeakMission,
} from '@/services/progression';
import { LevelUpOverlay, type LevelUpEvent } from '@/components/game/LevelUpOverlay';

export default function QuestsScreen() {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const refresh = useProfileStore((s) => s.refresh);
  const [evalr, setEvalr] = useState<RankEvaluation | null>(null);
  const [mission, setMission] = useState<WeakMission | null>(null);
  const [celebrate, setCelebrate] = useState<LevelUpEvent | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const xpBefore = useProfileStore.getState().totalXp;
    const rankBefore = useProfileStore.getState().generalRank;
    const ev = await evaluateRank(db, profile.id);
    let m = await weakMission(db, profile.id, new Date(), ev.muscles);
    if (await claimWeakMission(db, profile.id, m)) m = { ...m, rewarded: true };
    setEvalr(ev);
    setMission(m);
    await refresh(db);
    if (ev.newlyPassed.length > 0) {
      const xpAfter = useProfileStore.getState().totalXp;
      setCelebrate({
        fromLevel: levelFromXp(xpBefore).level,
        toLevel: levelFromXp(xpAfter).level,
        fromRank: rankBefore,
        toRank: ev.passed,
        xpGained: xpAfter - xpBefore,
        muscleUps: [],
        points: [],
        recovered: [],
      });
    }
  }, [db, profile, refresh]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const next = evalr?.next ?? null;

  return (
    <Screen title="Quests" subtitle="Misiones">
      {celebrate ? <LevelUpOverlay event={celebrate} onClose={() => setCelebrate(null)} /> : null}

      <Card title="Examen de rango" accent={next ? rankColors[next.rank] : colors.module.quests} highlighted>
        {evalr && next ? (
          <>
            <View style={styles.examHead}>
              <RankBadge rank={evalr.passed} size={52} />
              <AppText variant="title" color={colors.textFaint}>
                →
              </AppText>
              <RankBadge rank={next.rank} size={52} />
              <View style={styles.flex}>
                <AppText variant="heading">Rango {next.rank}</AppText>
                <AppText variant="caption">
                  {next.ready ? '¡Requisitos cumplidos!' : next.levelOk ? 'Nivel listo: falta la prueba de fuerza' : 'Sube de nivel y de fuerza'}
                </AppText>
              </View>
            </View>
            <Requirement
              label={`Nivel ${next.minLevel}`}
              have={evalr.level}
              need={next.minLevel}
              ok={next.levelOk}
              detail={next.levelOk ? undefined : `Vas en nivel ${evalr.level}`}
            />
            {next.requirements.map((r, i) => (
              <Requirement
                key={i}
                label={`${r.count} músculos en ${r.min} o más`}
                have={r.have}
                need={r.count}
                ok={r.ok}
                detail={
                  r.ok
                    ? undefined
                    : `Los más cercanos: ${r.closest
                        .slice(0, Math.max(1, r.count - r.have))
                        .map((m) => MUSCLE_GROUP_LABEL[m])
                        .join(', ')}`
                }
              />
            ))}
            <AppText variant="caption" color={colors.textFaint}>
              El examen se aprueba solo en cuanto cumples los requisitos (+{EXAM_XP} XP). El rango aprobado no se pierde,
              aunque luego bajen tus músculos.
            </AppText>
          </>
        ) : evalr ? (
          <AppText variant="heading" color={rankColors['SSS+']}>
            Rango máximo alcanzado: SSS+
          </AppText>
        ) : (
          <AppText variant="caption">Calculando…</AppText>
        )}
      </Card>

      <Card title="Misión semanal" accent={colors.module.quests}>
        {mission ? (
          <>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="heading">Refuerza {mission.label.toLowerCase()}</AppText>
                <AppText variant="caption">
                  Tu músculo más débil esta semana{mission.rank ? ` (rank ${mission.rank})` : ' (sin datos aún)'}. Haz{' '}
                  {mission.goal} series de {mission.label.toLowerCase()} antes del domingo.
                </AppText>
              </View>
              <AppText variant="heading" color={mission.done ? colors.success : colors.text}>
                {Math.min(mission.sets, mission.goal)}/{mission.goal}
              </AppText>
            </View>
            <XPBar
              progress={mission.sets / mission.goal}
              color={mission.done ? colors.success : colors.module.quests}
              accessibilityLabel={`Misión semanal: ${mission.sets} de ${mission.goal} series`}
            />
            <AppText variant="caption" color={mission.rewarded ? colors.success : colors.textMuted}>
              {mission.rewarded
                ? `Completada · +${WEAK_MISSION_XP} XP recibidos`
                : `Recompensa: +${WEAK_MISSION_XP} XP · se entrega sola al terminar la sesión que la cumpla`}
            </AppText>
            {mission.suggestions.length > 0 ? (
              <AppText variant="caption">En tus rutinas: {mission.suggestions.join(', ')}.</AppText>
            ) : null}
            {mission.next ? (
              <AppText variant="caption" color={colors.cyan}>
                Objetivo a largo plazo: rank {mission.next.rank} con{' '}
                {mission.next.kind === 'kg' ? `~${formatNumber(mission.next.kg)} kg × ${mission.next.reps}` : `${mission.next.seconds} s`}.
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText variant="caption">Calculando…</AppText>
        )}
      </Card>

      <Card title="Rangos">
        <AppText variant="caption">Cada rango pide un nivel y un examen de fuerza (músculos con un rank mínimo, de 11).</AppText>
        {RANK_THRESHOLDS.map((t) => {
          const reqs = RANK_EXAMS[t.rank] ?? [];
          const current = evalr?.passed === t.rank;
          return (
            <View key={t.rank} style={[styles.rankRow, current && { borderColor: rankColors[t.rank] }]}>
              <RankBadge rank={t.rank} size={40} />
              <View style={styles.flex}>
                <AppText variant="heading" color={rankColors[t.rank]}>
                  {t.rank}
                  {current ? ' · tu rango' : ''}
                </AppText>
                <AppText variant="caption">
                  Nivel {t.minLevel}
                  {reqs.length ? ` · ${reqs.map((r) => (r.min === 'S' ? `${r.count === 11 ? 'los 11' : r.count} músculos en S` : `${r.count} músculos en ${r.min} o más`)).join(' y ')}` : ''}
                </AppText>
              </View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

function Requirement({ label, have, need, ok, detail }: { label: string; have: number; need: number; ok: boolean; detail?: string }) {
  return (
    <View style={styles.req}>
      <View style={styles.row}>
        <AppText variant="body" style={styles.flex}>
          {ok ? '✓ ' : ''}
          {label}
        </AppText>
        <AppText variant="label" color={ok ? colors.success : colors.textMuted}>
          {Math.min(have, need)}/{need}
        </AppText>
      </View>
      <XPBar progress={have / need} color={ok ? colors.success : colors.warning} height={6} accessibilityLabel={`${label}: ${have} de ${need}`} />
      {detail ? <AppText variant="caption">{detail}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  examHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  req: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
