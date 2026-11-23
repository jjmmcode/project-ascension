import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { z } from 'zod';
import { AppText, Button } from '@/components/ui';
import { ShatterBadge, type Damage } from '@/components/game/ShatterBadge';
import { settingsRepo } from '@/database/repositories/settings';
import { levelFromXp, minLevelFor, type Rank } from '@/features/progression/leveling';
import { damageFor, DEMOTION_DAYS } from '@/services/penance';
import { playSound } from '@/features/sound/sound';
import { useProfileStore } from '@/stores/profileStore';
import { formatNumber } from '@/lib/numbers';
import { colors, rankColors, radius, spacing } from '@/theme';

const KEY = 'badge.damage';
const STATE_LABEL = ['intacto', 'agrietado', 'fracturado', 'destrozado'] as const;

interface Event {
  from: Damage;
  to: Damage;
  penalties: Array<{ kind: 'fail_xp' | 'fail_level'; amount: number }>;
  /** Rango perdido por inactividad. */
  demotion?: { from: Rank; to: Rank };
}

/**
 * Avisa (una vez) cuando el emblema se rompe más o se repara, y cuando se aplica un fallo de penitencia.
 * El último daño mostrado se guarda en ajustes para no repetir la animación.
 */
export function BadgeEventOverlay() {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const xp = useProfileStore((s) => s.totalXp);
  const rank = useProfileStore((s) => s.generalRank);
  const penalties = useProfileStore((s) => s.lastPenalties);
  const decay = useProfileStore((s) => s.rankDecay);
  const seenDecay = useRef<typeof decay>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const seenPenalties = useRef<typeof penalties | null>(null);

  useEffect(() => {
    if (!profile?.onboardingCompletedAt) return;
    let alive = true;
    void (async () => {
      const level = levelFromXp(xp).level;
      const now = damageFor(level, rank);
      const stored = await settingsRepo.get(db, profile.id, KEY, z.number().int().min(0).max(3));
      const fresh = penalties.length > 0 && seenPenalties.current !== penalties ? penalties : [];
      seenPenalties.current = penalties;
      const demotion = decay?.demoted && seenDecay.current !== decay ? decay.demoted : undefined;
      seenDecay.current = decay;
      if (demotion) {
        await settingsRepo.set(db, profile.id, KEY, z.number(), now);
        if (alive) setEvent({ from: 2, to: 3, penalties: fresh, demotion });
        return;
      }
      if (stored == null) {
        await settingsRepo.set(db, profile.id, KEY, z.number(), now);
        if (fresh.length && alive) setEvent({ from: now, to: now, penalties: fresh });
        return;
      }
      if (stored === now && fresh.length === 0) return;
      await settingsRepo.set(db, profile.id, KEY, z.number(), now);
      if (alive) setEvent({ from: stored as Damage, to: now, penalties: fresh });
    })();
    return () => {
      alive = false;
    };
  }, [db, profile, xp, rank, penalties, decay]);

  useEffect(() => {
    if (!event) return;
    const breaking = event.to > event.from;
    const repairing = event.to < event.from;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    if (event.penalties.length) {
      void playSound('penance');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    const t0 = event.penalties.length ? 700 : 150;
    if (event.demotion)
      timers.push(
        setTimeout(() => void playSound('impact'), t0 + 900),
      );
    if (breaking)
      timers.push(
        setTimeout(() => {
          void playSound(event.to >= 2 ? 'crack_heavy' : 'crack_light');
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, t0),
      );
    if (repairing)
      timers.push(
        setTimeout(() => {
          void playSound('repair');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, t0),
      );
    return () => timers.forEach(clearTimeout);
  }, [event]);

  if (!event) return null;
  const breaking = event.to > event.from;
  const repairing = event.to < event.from;
  const lost = event.penalties.reduce((a, p) => a + p.amount, 0);
  const levelDown = event.penalties.some((p) => p.kind === 'fail_level');
  const level = levelFromXp(xp).level;
  const min = minLevelFor(rank);
  const title = event.demotion
    ? `Rango ${event.demotion.from} perdido`
    : repairing
    ? event.to === 0
      ? 'Emblema restaurado'
      : 'Emblema reparándose'
    : breaking
      ? `Emblema ${STATE_LABEL[event.to]}`
      : 'Penitencia fallida';
  const accent = repairing ? rankColors[rank] : colors.danger;
  const badgeRank = event.demotion?.from ?? rank;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEvent(null)}>
      <View style={styles.backdrop}>
        <Animated.View entering={FadeIn.duration(250)} style={[styles.card, { borderColor: accent }]}>
          <ShatterBadge key={`${event.from}-${event.to}`} rank={badgeRank} damage={event.to} from={event.from} size={110} />
          <Animated.View entering={FadeInDown.delay(500)} style={styles.texts}>
            <AppText variant="title" color={accent} style={styles.center}>
              {title}
            </AppText>
            {event.penalties.length ? (
              <AppText variant="body" style={styles.center}>
                No cumpliste la misión de penitencia: −{formatNumber(lost, 0)} XP{levelDown ? ' y bajas un nivel' : ' (la XP de tu nivel actual)'}.
              </AppText>
            ) : null}
            {event.demotion ? (
              <AppText variant="caption" style={styles.center}>
                Tu emblema estuvo destrozado {DEMOTION_DAYS} días seguidos: ahora eres rango {event.demotion.to}. Para recuperar el{' '}
                {event.demotion.from}, vuelve al nivel {minLevelFor(event.demotion.from)} y aprueba otra vez su examen. Mientras
                tanto ganas XP doble.
              </AppText>
            ) : event.to > 0 ? (
              <AppText variant="caption" style={styles.center}>
                Conservas el rango {rank}, pero estás en nivel {level} y el rango pide {min}. Recupera {min - level}{' '}
                {min - level === 1 ? 'nivel' : 'niveles'} para repararlo. Ganas XP doble hasta volver a tu nivel máximo.
              </AppText>
            ) : repairing ? (
              <AppText variant="caption" style={styles.center}>
                Volviste al nivel {level}: el emblema {rank} vuelve a estar entero.
              </AppText>
            ) : null}
          </Animated.View>
          <Button label="Entendido" onPress={() => setEvent(null)} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,4,9,0.86)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: 'center',
  },
  texts: { gap: spacing.sm, alignItems: 'center' },
  center: { textAlign: 'center' },
});
