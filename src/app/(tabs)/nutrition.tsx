import { Card, EmptyState, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function NutritionScreen() {
  return (
    <Screen title="Nutrición" subtitle="Combustible">
      <Card title="Comidas de hoy" accent={colors.module.nutrition}>
        <EmptyState
          icon="restaurant-outline"
          color={colors.module.nutrition}
          title="Sin comidas registradas"
          message="Registrarás desayuno, almuerzo, cena y snacks con alimentos propios. Los macros se calculan a partir de los valores que tú introduces."
          tag="Disponible en Etapa 4"
        />
      </Card>
      <Card title="Hidratación" accent={colors.module.hydration}>
        <EmptyState
          icon="water-outline"
          color={colors.module.hydration}
          title="Sin registros de agua"
          message="Registro de un toque (150 / 250 / 500 ml) con un objetivo que configuras tú."
          tag="Disponible en Etapa 4"
        />
      </Card>
    </Screen>
  );
}
