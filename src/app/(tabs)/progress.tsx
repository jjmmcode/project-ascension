import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { AppText, Button, Card, ChoiceChips, EmptyState, RankBadge, Screen, TextField, XPBar } from '@/components/ui';
import { colors, rankColors, spacing } from '@/theme';
import { useProfileStore } from '@/stores/profileStore';
import { computePhysique, PHYSIQUE_MUSCLES, type Physique } from '@/services/physique';
import { MuscleMap, PhysiqueMap, type MuscleFill } from '@/features/physique/PhysiqueMap';
import { AttributeHex } from '@/features/attributes/AttributeHex';
import { ATTRIBUTE_INFO, ATTRIBUTES, type AttributeKey } from '@/features/attributes/engine';
import { computeAttributesView, type AttributesView } from '@/services/attributes';
import type { MuscleGroup } from '@/features/exercises/library';
import { StatRadar } from '@/features/physique/StatRadar';
import { getLibraryExercise, MUSCLE_GROUP_LABEL } from '@/features/exercises/library';
import { levelFromXp } from '@/features/progression/leveling';
import { bodyMetricsRepo } from '@/database/repositories/bodyMetrics';
import { formatNumber, parseDecimal } from '@/lib/numbers';

function WeightPrompt({ onSaved }: { onSaved: () => void }) {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const kg = parseDecimal(value);
    if (!profile || kg === null || Number.isNaN(kg) || kg < 30 || kg > 300) {
      setError('Introduce un peso entre 30 y 300 kg');
      return;
    }
    await bodyMetricsRepo.create(db, profile.id, { measuredAt: new Date().toISOString(), weightKg: kg, source: 'manual' });
    setValue('');
    setError(null);
    onSaved();
  };
  return (
    <Card title="Tu peso" accent={colors.cyan}>
      <AppText variant="caption">
        Las ranks comparan tu fuerza con tu peso corporal (1RM estimado ÷ peso). Registra tu peso de hoy para calcularlas.
      </AppText>
      <TextField label="Peso corporal" unit="kg" value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder="Ej. 70" error={error} />
      <Button label="Guardar peso" icon="checkmark" variant="secondary" onPress={save} />
    </Card>
  );
}

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const totalXp = useProfileStore((s) => s.totalXp);
  const generalRank = useProfileStore((s) => s.generalRank);
  const refresh = useProfileStore((s) => s.refresh);
  const [physique, setPhysique] = useState<Physique | null>(null);
  const [attrs, setAttrs] = useState<AttributesView | null>(null);
  const [mapView, setMapView] = useState<'rank' | 'volume' | 'points'>('rank');
  const [showAllPoints, setShowAllPoints] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setPhysique(await computePhysique(db, profile.id));
    setAttrs(await computeAttributesView(db, profile.id));
  }, [db, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const level = levelFromXp(totalXp);
  const ranked = new Map(physique?.ranks.map((r) => [r.muscle, r]) ?? []);
  const untrained = PHYSIQUE_MUSCLES.filter((m) => !ranked.has(m));

  return (
    <Screen title="Evolution" subtitle="Físico y progreso">
      {physique && physique.bodyweightKg == null ? (
        <WeightPrompt
          onSaved={() => {
            void refresh(db).then(load);
          }}
        />
      ) : null}

      <Card title="Atributos" accent={colors.violet} highlighted>
        <View style={styles.head}>
          <RankBadge rank={generalRank} size={56} />
          <View style={styles.flex}>
            <AppText variant="heading">Nivel {level.level}</AppText>
            <AppText variant="caption">
              {attrs ? `${totalPoints(attrs)} puntos activos · 3 por nivel, repartidos según lo que entrenas` : 'Calculando…'}
            </AppText>
          </View>
        </View>
        {attrs ? <AttributeHex values={attrs.now.values} ghost={attrs.monthAgo.values} /> : null}
        <View style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: colors.violet }]} />
          <AppText variant="caption">Hoy</AppText>
          <View style={styles.dash} />
          <AppText variant="caption">Hace 30 días</AppText>
        </View>
        {attrs
          ? ATTRIBUTES.map((a) => {
              const info = ATTRIBUTE_INFO[a];
              const delta = attrs.now.values[a] - attrs.monthAgo.values[a];
              const lost = attrs.now.points.filter((p) => p.attr === a && !p.active).length;
              return (
                <Pressable
                  key={a}
                  style={styles.attrRow}
                  accessibilityRole={a === 'FUE' || a === 'VOL' ? 'button' : undefined}
                  accessibilityLabel={`${info.name}: ${attrs.now.values[a]} de 100`}
                  onPress={a === 'FUE' || a === 'VOL' ? () => setMapView('points') : undefined}
                >
                  <AppText variant="heading" style={styles.attrKey} color={info.available ? colors.text : colors.textFaint}>
                    {info.short}
                  </AppText>
                  <View style={styles.flex}>
                    <AppText variant="body" color={info.available ? colors.text : colors.textFaint}>
                      {info.name}
                    </AppText>
                    <AppText variant="caption" color={colors.textFaint}>
                      {info.source}
                      {a === 'FUE' || a === 'VOL' ? ' · toca para ver por músculo' : ''}
                    </AppText>
                    {lost > 0 ? (
                      <AppText variant="caption" color={colors.warning}>
                        {lost} perdido{lost > 1 ? 's' : ''} por inactividad
                      </AppText>
                    ) : null}
                  </View>
                  {delta !== 0 ? (
                    <AppText variant="label" color={delta > 0 ? colors.success : colors.warning}>
                      {delta > 0 ? `+${delta}` : delta} en 30 d
                    </AppText>
                  ) : null}
                  <AppText variant="heading" style={styles.attrVal} color={info.available ? colors.text : colors.textFaint}>
                    {attrs.now.values[a]}
                    <AppText variant="caption">/100</AppText>
                  </AppText>
                </Pressable>
              );
            })
          : null}
        {attrs && attrs.now.points.length > 0 ? (
          <View style={styles.log}>
            <AppText variant="label">Últimos puntos</AppText>
            {[...attrs.now.points]
              .reverse()
              .slice(0, showAllPoints ? 60 : 6)
              .map((p) => (
                <AppText key={p.key} variant="caption" color={p.active ? colors.textMuted : colors.textFaint}>
                  Nivel {p.level} · {ATTRIBUTE_INFO[p.attr].short} +1 ({p.reason})
                  {p.active ? '' : ` — perdido: ${p.recover}`}
                </AppText>
              ))}
            {attrs.now.points.length > 6 ? (
              <Button
                label={showAllPoints ? 'Ver menos' : `Ver los ${attrs.now.points.length}`}
                variant="ghost"
                onPress={() => setShowAllPoints((v) => !v)}
              />
            ) : null}
          </View>
        ) : null}
        <AppText variant="caption" color={colors.textFaint}>
          Cada nivel da 3 puntos que se reparten solos según lo que entrenaste. Los atributos físicos se pierden si su músculo
          pasa 6 semanas sin entrenarse y vuelven al entrenarlo (memoria muscular, con bonus de XP). Disciplina no se pierde.
        </AppText>
      </Card>

      <Card title="Mapa de fuerza" accent={colors.primary}>
        <ChoiceChips
          label="Vista"
          options={[
            { value: 'rank', label: 'Rank' },
            { value: 'volume', label: 'Volumen' },
            { value: 'points', label: 'Puntos' },
          ]}
          value={mapView}
          onChange={setMapView}
        />
        {attrs && attrs.now.atRisk.length > 0 ? (
          <AppText variant="caption" color={colors.warning}>
            En riesgo:{' '}
            {attrs.now.atRisk.map((r) => `${MUSCLE_GROUP_LABEL[r.muscle]} (${Math.floor(r.days / 7)} semanas)`).join(', ')}. A las 6
            semanas sin entrenar bajan de rank y pierdes sus puntos.
          </AppText>
        ) : null}
        {mapView === 'rank' ? (
          <>
            {physique && physique.ranks.length === 0 ? (
              <EmptyState
                icon="body-outline"
                title="Sin ranks todavía"
                message="Termina sesiones con series de 3 a 15 repeticiones y aquí verás qué músculos son más fuertes."
              />
            ) : null}
            <PhysiqueMap ranks={physique?.ranks ?? []} />
          </>
        ) : mapView === 'volume' ? (
          <>
            <MuscleMap
              fills={volumeFills(attrs?.weekSets ?? {})}
              label={`Series de esta semana por músculo: ${describe(attrs?.weekSets ?? {})}`}
              legend={[
                { color: colors.cyan, text: '1–4', opacity: 0.4 },
                { color: colors.cyan, text: '5–9', opacity: 0.7 },
                { color: colors.success, text: '10+ (meta)' },
              ]}
            />
            <AppText variant="caption" color={colors.textFaint}>
              Series de esta semana (lunes a domingo). Cada músculo que llega a 10 alimenta VOL.
            </AppText>
          </>
        ) : (
          <>
            <MuscleMap
              fills={pointFills(attrs?.pointsByMuscle ?? {})}
              label="Puntos de fuerza y volumen ganados por músculo"
              legend={[
                { color: colors.violet, text: 'pocos', opacity: 0.35 },
                { color: colors.violet, text: 'muchos' },
              ]}
            />
            {Object.entries(attrs?.pointsByMuscle ?? {})
              .sort((a, b) => b[1].FUE + b[1].VOL - (a[1].FUE + a[1].VOL))
              .map(([m, v]) => (
                <View key={m} style={styles.breakRow}>
                  <AppText variant="body">{MUSCLE_GROUP_LABEL[m as MuscleGroup]}</AppText>
                  <AppText variant="label" color={colors.textMuted}>
                    FUE {v.FUE} · VOL {v.VOL}
                  </AppText>
                </View>
              ))}
          </>
        )}
      </Card>

      <Card title="Ranking de músculos" accent={colors.module.quests}>
        {physique?.ranks.map((r) => {
          const ex = getLibraryExercise(r.bestLibraryId);
          const frac = r.rank === 'S' ? Math.min(1, r.score - 5) : r.score - Math.floor(r.score);
          return (
            <View key={r.muscle} style={styles.row}>
              <RankBadge rank={r.rank} size={40} />
              <View style={styles.flex}>
                <View style={styles.rowHead}>
                  <AppText variant="heading">{MUSCLE_GROUP_LABEL[r.muscle]}</AppText>
                  {r.approx ? (
                    <AppText variant="label" color={colors.textFaint}>
                      aprox.
                    </AppText>
                  ) : null}
                </View>
                <XPBar progress={frac} color={rankColors[r.rank]} height={6} accessibilityLabel={`${MUSCLE_GROUP_LABEL[r.muscle]} rango ${r.rank}`} />
                <AppText variant="caption">
                  {ex ? `Mejor: ${ex.name}` : ''}
                  {r.next
                    ? r.next.kind === 'kg'
                      ? ` · para ${r.next.rank}: ~${formatNumber(r.next.kg)} kg × ${r.next.reps}`
                      : ` · para ${r.next.rank}: ${r.next.seconds} s`
                    : ' · rango máximo'}
                </AppText>
                {r.decayed ? (
                  <AppText variant="caption" color={colors.warning}>
                    Bajó un rango: no lo entrenas hace más de 6 semanas.
                  </AppText>
                ) : null}
              </View>
            </View>
          );
        })}
        {untrained.length > 0 ? (
          <AppText variant="caption" color={colors.textFaint}>
            Sin datos: {untrained.map((m) => MUSCLE_GROUP_LABEL[m]).join(', ')}.
          </AppText>
        ) : null}
        <AppText variant="caption" color={colors.textFaint}>
          Rank = tu mejor serie de 90 días (1RM estimado con Epley, series de 3–15 reps) ÷ tu peso, frente a estándares de
          fuerza para hombres: E por debajo de principiante; D, C, B, A y S = principiante, novato, intermedio, avanzado y élite.
          «aprox.»: estándar estimado (máquinas de placas, poleas, prensa, ejercicios accesorios). El press en máquina de palanca
          no cuenta. Las ranks miden fuerza relativa, no el tamaño del músculo.
        </AppText>
      </Card>

      <Card title="Estado actual (4 semanas)" accent={colors.cyan}>
        {physique ? (
          <StatRadar
            axes={[
              { label: 'Fuerza', value: physique.stats.fuerza },
              { label: 'Progresión', value: physique.stats.progresion },
              { label: 'Constancia', value: physique.stats.constancia },
              { label: 'Volumen', value: physique.stats.volumen },
              { label: 'Cardio', value: physique.stats.acondicionamiento },
            ]}
            color={colors.cyan}
          />
        ) : null}
        <AppText variant="caption" color={colors.textFaint}>
          Cómo vas este mes (sube y baja). Fuerza: media de las ranks de tus 11 músculos. Progresión: récords en 4 semanas.
          Constancia: días de gimnasio del plan cumplidos (el miércoles opcional no cuenta). Volumen: series de 7 días frente a
          10 por músculo. Cardio: minutos de caminadora en 7 días frente a 150 (recomendación de la OMS).
        </AppText>
      </Card>

      <Card title="Composición corporal" accent={colors.module.evolution}>
        <EmptyState
          icon="analytics-outline"
          color={colors.module.evolution}
          title="Sin gráficos todavía"
          message="Peso, cintura y % de grasa con fecha y fuente llegan en la Fase 4."
        />
      </Card>
    </Screen>
  );
}

function totalPoints(v: AttributesView): number {
  return ATTRIBUTES.reduce((a, k: AttributeKey) => a + v.now.values[k], 0);
}

function describe(m: Partial<Record<MuscleGroup, number>>): string {
  return Object.entries(m).map(([k, n]) => `${MUSCLE_GROUP_LABEL[k as MuscleGroup]} ${n}`).join(', ') || 'ninguna';
}

function volumeFills(m: Partial<Record<MuscleGroup, number>>): Partial<Record<MuscleGroup, MuscleFill>> {
  const out: Partial<Record<MuscleGroup, MuscleFill>> = {};
  for (const [k, n] of Object.entries(m) as Array<[MuscleGroup, number]>) {
    out[k] = n >= 10 ? { color: colors.success, opacity: 1 } : { color: colors.cyan, opacity: n >= 5 ? 0.7 : 0.4 };
  }
  return out;
}

function pointFills(m: AttributesView['pointsByMuscle']): Partial<Record<MuscleGroup, MuscleFill>> {
  const totals = Object.values(m).map((v) => v.FUE + v.VOL);
  const max = Math.max(1, ...totals);
  const out: Partial<Record<MuscleGroup, MuscleFill>> = {};
  for (const [k, v] of Object.entries(m) as Array<[MuscleGroup, { FUE: number; VOL: number }]>) {
    out[k] = { color: colors.violet, opacity: 0.3 + 0.7 * ((v.FUE + v.VOL) / max) };
  }
  return out;
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: -spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  dash: { width: 16, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textFaint, marginLeft: spacing.sm },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attrKey: { width: 44 },
  attrVal: { minWidth: 64, textAlign: 'right' },
  log: { gap: spacing.xs, paddingTop: spacing.sm },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
});
