import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { AppText, Button, Card, ChoiceChips, Screen, TextField } from '@/components/ui';
import { PRIMARY_GOALS, type PrimaryGoal } from '@/features/profile/schema';
import { GOAL_TYPES } from '@/features/progression/goalSchema';
import { completeOnboarding } from '@/services/onboarding';
import { useProfileStore } from '@/stores/profileStore';
import { formatNumber, parseDecimal } from '@/lib/numbers';
import { colors, spacing } from '@/theme';

type Field = 'name' | 'height' | 'weight' | 'birth' | 'calories' | 'protein';
type Errors = Partial<Record<Field, string>>;

const DAYS = [2, 3, 4, 5, 6].map((d) => ({ value: d, label: `${d} días` }));

function rangeError(raw: string, min: number, max: number, unit: string, required: boolean): [number | null, string | undefined] {
  const n = parseDecimal(raw);
  if (n === null) return [null, required ? 'Campo obligatorio' : undefined];
  if (Number.isNaN(n)) return [null, 'Número no válido'];
  if (n < min || n > max) return [null, `Debe estar entre ${formatNumber(min)} y ${formatNumber(max)} ${unit}`];
  return [n, undefined];
}

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const refresh = useProfileStore((s) => s.refresh);

  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [goal, setGoal] = useState<PrimaryGoal>('recomposition');
  const [days, setDays] = useState(4);
  const [birth, setBirth] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const e: Errors = {};
    const displayName = name.trim();
    if (!displayName) e.name = 'Escribe un nombre para tu personaje';
    else if (displayName.length > 40) e.name = 'Máximo 40 caracteres';
    const [heightCm, he] = rangeError(height, 100, 250, 'cm', true);
    const [weightKg, we] = rangeError(weight, 30, 300, 'kg', false);
    const [kcal, ce] = rangeError(calories, GOAL_TYPES.calories.min, GOAL_TYPES.calories.max, 'kcal', false);
    const [prot, pe] = rangeError(protein, GOAL_TYPES.protein_g.min, GOAL_TYPES.protein_g.max, 'g', false);
    const maxYear = new Date().getFullYear() - 12;
    const by = birth.trim() === '' ? null : Number(birth.trim());
    const birthYear = by != null && Number.isInteger(by) && by >= 1920 && by <= maxYear ? by : null;
    if (by != null && birthYear == null) e.birth = `Escribe un año entre 1920 y ${maxYear}`;
    if (he) e.height = he;
    if (we) e.weight = we;
    if (ce) e.calories = ce;
    if (pe) e.protein = pe;
    setErrors(e);
    if (Object.keys(e).length > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      await completeOnboarding(db, {
        displayName,
        heightCm,
        currentWeightKg: weightKg,
        primaryGoal: goal,
        caloriesGoal: kcal,
        proteinGoalG: prot,
        workoutsPerWeek: days,
        birthYear,
      });
      await refresh(db);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Despertar" subtitle="Configuración inicial">
      <AppText variant="caption">
        Revisa y confirma tus datos. Nada se toma como actual sin tu confirmación, y todo se podrá editar después.
      </AppText>

      <Card title="Personaje" accent={colors.cyan}>
        <TextField
          label="Nombre del personaje"
          value={name}
          onChangeText={setName}
          placeholder="Cómo te llamará el sistema"
          autoCapitalize="words"
          maxLength={40}
          error={errors.name}
          returnKeyType="next"
        />
      </Card>

      <Card title="Cuerpo" accent={colors.module.evolution}>
        <TextField
          label="Altura"
          unit="cm"
          value={height}
          onChangeText={setHeight}
          keyboardType="decimal-pad"
          placeholder="Ej. 178"
          hint="Tienes dos registros distintos (≈180 cm y 176 cm). Mídete y confirma el valor real."
          error={errors.height}
        />
        <TextField
          label="Peso actual"
          unit="kg"
          optional
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="Ej. 70"
          hint="Solo si te pesaste hoy o hace poco. Si no, déjalo vacío y regístralo luego."
          error={errors.weight}
        />
        <TextField
          label="Año de nacimiento"
          optional
          value={birth}
          onChangeText={setBirth}
          keyboardType="number-pad"
          placeholder="Ej. 1995"
          hint="Para la edad en el cálculo de kcal. Puedes cambiarlo en Ajustes."
          error={errors.birth}
        />
      </Card>

      <Card title="Objetivos" accent={colors.violet}>
        <ChoiceChips label="Objetivo principal" options={PRIMARY_GOALS} value={goal} onChange={setGoal} color={colors.violet} />
        <ChoiceChips label="Entrenamientos por semana" options={DAYS} value={days} onChange={setDays} />
        <TextField
          label="Meta de calorías"
          unit="kcal/día"
          optional
          value={calories}
          onChangeText={setCalories}
          keyboardType="number-pad"
          placeholder="Ej. 2.000"
          hint="Es una meta declarada, no garantiza un déficit. Se contrastará con la tendencia de tu peso."
          error={errors.calories}
        />
        <TextField
          label="Meta de proteína"
          unit="g/día"
          optional
          value={protein}
          onChangeText={setProtein}
          keyboardType="number-pad"
          placeholder="Ej. 160"
          error={errors.protein}
        />
      </Card>

      {submitError ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="assertive">
          {submitError}
        </AppText>
      ) : null}
      <Button label="Comenzar ascensión" icon="flash" onPress={submit} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  preview: {
    gap: spacing.xxs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
