import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { AppText, Button, Card } from '@/components/ui';
import { useProfileStore } from '@/stores/profileStore';
import { endRest, simulatePenance, startRest, type Simulation } from '@/services/penance';
import { MAX_REST_DAYS, PENANCE_DAY, SESSIONS_NEEDED } from '@/features/penance/engine';
import { formatNumber } from '@/lib/numbers';
import { GENERAL_RANKS, minLevelFor } from '@/features/progression/leveling';
import { damageFor, DEMOTION_DAYS } from '@/services/penance';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

const dmy = (key: string) => `${key.slice(8, 10)}-${key.slice(5, 7)}`;

/** Tarjeta de Status: aviso, misión de penitencia, memoria muscular (XP doble) o modo descanso. */
export function PenanceStatusCard() {
  const p = useProfileStore((s) => s.penance);
  const rest = useProfileStore((s) => s.rest);
  const decay = useProfileStore((s) => s.rankDecay);
  const rank = useProfileStore((s) => s.generalRank);
  if (!p) return null;
  const { state } = p;
  const cards: React.ReactNode[] = [];

  if (rest) {
    cards.push(
      <Card key="rest" title="Modo descanso" accent={colors.cyan}>
        <AppText variant="caption">
          Hasta el {dmy(rest.end)}. Estos días no cuentan para la penitencia; puedes terminarlo en Ajustes.
        </AppText>
      </Card>,
    );
  } else if (state.status === 'penance' && state.window) {
    const w = state.window;
    cards.push(
      <Card key="pen" title="Misión de penitencia" accent={colors.danger} highlighted>
        <View style={styles.row}>
          {Array.from({ length: SESSIONS_NEEDED }, (_, i) => (
            <View key={i} style={[styles.pip, i < w.sessions && styles.pipOn]} />
          ))}
          <AppText variant="heading">
            {w.sessions}/{SESSIONS_NEEDED} sesiones
          </AppText>
        </View>
        <AppText variant="caption">
          Entrena {SESSIONS_NEEDED} veces antes del {dmy(w.end)} (incluido).{' '}
          {w.failures === 0
            ? 'Si no, pierdes la XP de tu nivel actual.'
            : 'Si no, bajas un nivel y pierdes sus 3 puntos de atributo.'}
        </AppText>
      </Card>,
    );
  } else if (state.status === 'warning') {
    const left = PENANCE_DAY - state.daysInactive;
    cards.push(
      <Card key="warn" title="El Sistema te observa" accent={colors.warning}>
        <AppText variant="caption">
          Llevas {state.daysInactive} días sin entrenar. {left <= 1 ? 'Mañana' : `En ${left} días`} empieza una misión de
          penitencia: {SESSIONS_NEEDED} sesiones en 7 días o pierdes XP.
        </AppText>
      </Card>,
    );
  }
  if (decay?.daysLeft != null && rank !== 'E') {
    const prev = GENERAL_RANKS[GENERAL_RANKS.indexOf(rank) - 1];
    cards.push(
      <Card key="decay" title="Emblema destrozado" accent={colors.danger} highlighted>
        <AppText variant="caption">
          {rest
            ? `En modo descanso la cuenta está congelada.`
            : `Si no recuperas niveles, en ${decay.daysLeft} ${decay.daysLeft === 1 ? 'día' : 'días'} pierdes el rango ${rank} y bajas a ${prev}.`}{' '}
          Para repararlo vuelve al nivel {minLevelFor(rank) - 2} o más.
        </AppText>
      </Card>,
    );
  }
  if (p.comeback) {
    cards.push(
      <Card key="cb" title="Memoria muscular · XP ×2" accent={colors.violet}>
        <AppText variant="caption">
          Tu nivel máximo fue {p.maxLevel}. Cada sesión da XP doble hasta que vuelvas a él (vas en el {p.level}).
        </AppText>
      </Card>,
    );
  }
  return <>{cards}</>;
}

/** Ajustes: activar o terminar el modo descanso (enfermedad, lesión, viaje). */
export function RestModeCard() {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const rest = useProfileStore((s) => s.rest);
  const refresh = useProfileStore((s) => s.refresh);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh(db);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Modo descanso" accent={colors.cyan}>
      <AppText variant="caption">
        Para enfermedad, lesión o viaje: hasta {MAX_REST_DAYS} días que no cuentan para la penitencia y pausan una misión en
        curso. No da XP.
      </AppText>
      {rest ? (
        <>
          <AppText variant="body">Activo hasta el {dmy(rest.end)}.</AppText>
          <Button label="Terminar descanso hoy" variant="secondary" loading={busy} onPress={() => profile && run(() => endRest(db, profile.id))} />
        </>
      ) : (
        <Button
          label={`Activar ${MAX_REST_DAYS} días`}
          icon="bed-outline"
          variant="secondary"
          loading={busy}
          onPress={() =>
            profile &&
            Alert.alert('Modo descanso', `Desde hoy y durante ${MAX_REST_DAYS} días. Puedes terminarlo antes.`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Activar', onPress: () => void run(() => startRest(db, profile.id)) },
            ])
          }
        />
      )}
    </Card>
  );
}

/** Simulador oculto (toca «versión» 5 veces). Solo lectura: no guarda nada. */
export function SimulatorCard() {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const [sim, setSim] = useState<Simulation | null>(null);
  const rank = useProfileStore((s) => s.generalRank);

  const run = async (days: number) => {
    if (profile) setSim(await simulatePenance(db, profile.id, days));
  };

  return (
    <Card title="Simulador de días (prueba)" accent={colors.violet}>
      <AppText variant="caption" color={colors.textFaint}>
        Qué pasaría si no entrenas desde hoy. No cambia tus datos.
      </AppText>
      <View style={styles.chips}>
        {[5, 7, 14, 21, 28].map((d) => (
          <Pressable key={d} accessibilityRole="button" onPress={() => void run(d)} style={[styles.chip, sim?.days === d && styles.chipOn]}>
            <AppText variant="body">+{d} días</AppText>
          </Pressable>
        ))}
      </View>
      {sim ? (
        <View style={styles.simBox}>
          <AppText variant="body">
            {dmy(sim.date)}: {{ ok: 'todo en orden', warning: 'aviso', penance: 'misión de penitencia', rest: 'descanso', inactive: 'sin sesiones' }[sim.state.status]}
            {sim.state.window ? ` (hasta ${dmy(sim.state.window.end)})` : ''}
          </AppText>
          {sim.pending.length ? (
            sim.pending.map((p, i) => (
              <AppText key={i} variant="caption" color={colors.danger}>
                {dmy(p.event.date)} · {p.event.kind === 'fail_xp' ? 'pierdes la XP del nivel' : 'bajas 1 nivel'} (−{formatNumber(p.amount, 0)} XP)
              </AppText>
            ))
          ) : (
            <AppText variant="caption">Sin pérdidas.</AppText>
          )}
          <AppText variant="caption">
            Nivel {sim.levelNow} → {sim.levelThen}
          </AppText>
          {damageFor(sim.levelThen, rank) >= 3 && rank !== 'E' ? (
            <AppText variant="caption" color={colors.danger}>
              Emblema {rank} destrozado: tras {DEMOTION_DAYS} días así, bajas a rango {GENERAL_RANKS[GENERAL_RANKS.indexOf(rank) - 1]}.
            </AppText>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pip: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.danger },
  pipOn: { backgroundColor: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { borderColor: colors.violet, backgroundColor: 'rgba(139,92,246,0.15)' },
  simBox: { gap: 4 },
});
