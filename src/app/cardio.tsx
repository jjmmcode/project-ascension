import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { AppText, Button, Card, ChoiceChips, Screen, TextField } from '@/components/ui';
import { LevelUpOverlay, type LevelUpEvent } from '@/components/game/LevelUpOverlay';
import { useProfileStore } from '@/stores/profileStore';
import { distanceKm, mets, netKcal, outsideValidRange, suggestedMode, type CardioMode } from '@/features/cardio/acsm';
import {
  CARDIO_MIN_MINUTES,
  cardioInputSchema,
  cardioMinutes7d,
  cardioWeight,
  deleteCardio,
  fitiaLine,
  listCardio,
  logCardio,
  WEEKLY_CARDIO_MINUTES,
  type CardioSession,
  type LogCardioResult,
} from '@/services/cardio';
import { awardRecoveries, loadAttributeInput } from '@/services/attributes';
import { ATTRIBUTE_INFO, computeAttributes, type AttributePoint } from '@/features/attributes/engine';
import { levelFromXp } from '@/features/progression/leveling';
import { playSound } from '@/features/sound/sound';
import { formatNumber, parseDecimal } from '@/lib/numbers';
import { formatShortDate } from '@/lib/time';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

const toEventPoint = (p: AttributePoint) => ({ attr: ATTRIBUTE_INFO[p.attr].short, reason: p.reason });

export default function CardioScreen() {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const refresh = useProfileStore((s) => s.refresh);
  const generalRank = useProfileStore((s) => s.generalRank);
  const [speed, setSpeed] = useState('');
  const [incline, setIncline] = useState('');
  const [minutes, setMinutes] = useState('');
  const [mode, setMode] = useState<CardioMode | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [recent, setRecent] = useState<CardioSession[]>([]);
  const [week, setWeek] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LogCardioResult | null>(null);
  const [celebrate, setCelebrate] = useState<LevelUpEvent | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [w, r, m] = await Promise.all([cardioWeight(db, profile.id), listCardio(db, profile.id, 10), cardioMinutes7d(db, profile.id)]);
    setWeight(w);
    setRecent(r);
    setWeek(m);
  }, [db, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const s = parseDecimal(speed);
  const g = incline.trim() === '' ? 0 : parseDecimal(incline);
  const m = parseDecimal(minutes);
  const effMode: CardioMode = mode ?? (s ? suggestedMode(s) : 'walk');
  const parsed = cardioInputSchema.safeParse({ mode: effMode, speedKmh: s, inclinePct: g, minutes: m });
  const preview = useMemo(() => {
    if (!parsed.success) return null;
    const v = parsed.data;
    return {
      kcal: weight ? netKcal({ ...v, weightKg: weight }) : null,
      mets: mets(v.mode, v.speedKmh, v.inclinePct),
      km: distanceKm(v.speedKmh, v.minutes),
      outside: outsideValidRange(v.mode, v.speedKmh),
    };
  }, [parsed, weight]);

  const save = async () => {
    if (!profile || !parsed.success) return;
    setBusy(true);
    try {
      const xpBefore = useProfileStore.getState().totalXp;
      const before = computeAttributes(await loadAttributeInput(db, profile.id));
      const r = await logCardio(db, profile.id, parsed.data);
      const mid = computeAttributes(await loadAttributeInput(db, profile.id));
      const recovered = (await awardRecoveries(db, profile.id, before, mid)).map(toEventPoint);
      const after = computeAttributes(await loadAttributeInput(db, profile.id));
      await refresh(db);
      const xpAfter = useProfileStore.getState().totalXp;
      const from = levelFromXp(xpBefore).level;
      const to = levelFromXp(xpAfter).level;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (to > from || recovered.length) {
        setCelebrate({
          fromLevel: from,
          toLevel: to,
          fromRank: generalRank,
          toRank: generalRank,
          xpGained: xpAfter - xpBefore,
          muscleUps: [],
          points: after.points.filter((p) => p.level > before.level).map(toEventPoint),
          recovered,
        });
      } else void playSound('session_done');
      setResult(r);
      setCopied(false);
      setSpeed('');
      setIncline('');
      setMinutes('');
      setMode(null);
      await load();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    void Haptics.selectionAsync();
  };

  const remove = (c: CardioSession) =>
    Alert.alert('Borrar sesión', `${formatShortDate(c.startedAt)} · ${formatNumber(c.minutes)} min. La XP ya ganada se mantiene.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => profile && void deleteCardio(db, profile.id, c.id).then(load),
      },
    ]);

  const close = (
    <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.iconBtn}>
      <Ionicons name="close" size={22} color={colors.text} />
    </Pressable>
  );

  return (
    <Screen title="Caminadora" subtitle="Cardio · resistencia" accessory={close}>
      {celebrate ? <LevelUpOverlay event={celebrate} onClose={() => setCelebrate(null)} /> : null}

      {result ? (
        <Card title="Sesión guardada" accent={colors.success} highlighted>
          <AppText variant="display" color={result.xp.awarded ? colors.cyan : colors.textMuted}>
            +{result.xp.awarded} XP
          </AppText>
          <AppText variant="caption">
            {result.xp.reason === 'daily_cap'
              ? 'Ya recibiste la XP de cardio de hoy; la sesión queda guardada igual.'
              : result.session.minutes < CARDIO_MIN_MINUTES
                ? `Menos de ${CARDIO_MIN_MINUTES} min: se guarda, pero no da XP.`
                : 'Cuenta para tu Resistencia (RES) y el eje Cardio.'}
          </AppText>
          <View style={styles.fitia}>
            <AppText variant="label" color={colors.textFaint}>
              Para Fitia
            </AppText>
            <AppText variant="body" selectable>
              {fitiaLine(result.session)}
            </AppText>
            <Button
              label={copied ? 'Copiado' : 'Copiar'}
              icon={copied ? 'checkmark' : 'copy-outline'}
              variant="ghost"
              onPress={() => void copy(fitiaLine(result.session))}
            />
          </View>
        </Card>
      ) : null}

      <Card title="Registrar sesión" accent={colors.module.hydration}>
        <TextField label="Velocidad" unit="km/h" value={speed} onChangeText={setSpeed} keyboardType="decimal-pad" placeholder="Ej. 5,5" />
        <TextField
          label="Inclinación"
          unit="%"
          value={incline}
          onChangeText={setIncline}
          keyboardType="decimal-pad"
          placeholder="0"
          optional
        />
        <TextField label="Duración" unit="min" value={minutes} onChangeText={setMinutes} keyboardType="decimal-pad" placeholder="Ej. 30" />
        <ChoiceChips
          label="Tipo"
          options={[
            { value: 'walk', label: 'Caminar' },
            { value: 'run', label: 'Trotar / correr' },
          ]}
          value={effMode}
          onChange={(v) => setMode(v as CardioMode)}
          color={colors.cyan}
        />
        {preview ? (
          <View style={styles.preview}>
            <AppText variant="heading">
              {preview.kcal != null ? `≈ ${formatNumber(preview.kcal, 0)} kcal` : 'kcal: registra tu peso'} · {formatNumber(preview.km, 2)} km ·{' '}
              {formatNumber(preview.mets, 1)} MET
            </AppText>
            {preview.outside ? (
              <AppText variant="caption" color={colors.warning}>
                {effMode === 'walk'
                  ? 'La fórmula de caminar es más precisa entre 3 y 6 km/h; si a esta velocidad trotas, elige «Trotar / correr».'
                  : 'La fórmula de correr es más precisa desde 8 km/h (o desde 4,8 km/h si de verdad trotas).'}
              </AppText>
            ) : null}
          </View>
        ) : (
          <AppText variant="caption" color={colors.textFaint}>
            Velocidad entre 1 y 25 km/h, inclinación de 0 a 30 % y hasta 300 min.
          </AppText>
        )}
        <Button label="Guardar sesión" icon="walk" onPress={save} loading={busy} disabled={!parsed.success} />
        <AppText variant="caption" color={colors.textFaint}>
          Kcal netas (sin el gasto en reposo) con las ecuaciones del ACSM y tu último peso
          {weight ? ` (${formatNumber(weight)} kg)` : ''}. Suponen que no te agarras de las barras: agarrarse hace que el número
          real sea menor.
        </AppText>
      </Card>

      <Card title="Últimos 7 días" accent={colors.cyan}>
        <AppText variant="heading">
          {formatNumber(week, 0)} / {WEEKLY_CARDIO_MINUTES} min
        </AppText>
        <AppText variant="caption">
          La OMS recomienda al menos 150 min por semana de actividad moderada. Llegar a 150 en la semana da un punto de RES; cada
          sesión de 20 min o más también suma.
        </AppText>
      </Card>

      {recent.length ? (
        <Card title="Historial">
          {recent.map((c) => (
            <Pressable key={c.id} onLongPress={() => remove(c)} accessibilityHint="Mantén presionado para borrar" style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="body">
                  {formatShortDate(c.startedAt)} · {formatNumber(c.minutes)} min · {formatNumber(c.speedKmh)} km/h ·{' '}
                  {formatNumber(c.inclinePct)} %
                </AppText>
                <AppText variant="caption" color={colors.textFaint}>
                  {c.mode === 'walk' ? 'Caminata' : 'Carrera'}
                  {c.kcal != null ? ` · ${c.kcal} kcal` : ''}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Copiar para Fitia" onPress={() => void copy(fitiaLine(c))} style={styles.iconBtn}>
                <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          ))}
          <AppText variant="caption" color={colors.textFaint}>
            Mantén presionada una sesión para borrarla.
          </AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  preview: { gap: 4 },
  fitia: { gap: 4, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH },
  flex: { flex: 1, gap: 2 },
});
