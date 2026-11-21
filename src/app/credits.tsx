import { Linking, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Card, Screen } from '@/components/ui';
import { colors, MIN_TOUCH, radius } from '@/theme';

function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => void Linking.openURL(url)} hitSlop={8}>
      <AppText variant="body" color={colors.cyan} style={styles.link}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function CreditsScreen() {
  return (
    <Screen
      title="Créditos"
      subtitle="Licencias"
      accessory={
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
      }
    >
      <Card title="Biblioteca de ejercicios" accent={colors.cyan}>
        <AppText variant="body">
          Ilustraciones y descripciones base de ejercicios: Everkinetic, bajo licencia Creative Commons
          Atribución-CompartirIgual 4.0 Internacional (CC BY-SA 4.0).
        </AppText>
        <ExternalLink label="github.com/everkinetic/data" url="https://github.com/everkinetic/data" />
        <ExternalLink label="Texto de la licencia CC BY-SA 4.0" url="https://creativecommons.org/licenses/by-sa/4.0/deed.es" />
        <AppText variant="caption">
          Cambios realizados por Project Ascension: fondo eliminado y líneas recoloreadas; textos traducidos al
          español, adaptados y corregidos en algunas indicaciones técnicas. Estas adaptaciones se distribuyen bajo la
          misma licencia CC BY-SA 4.0.
        </AppText>
      </Card>

      <Card title="Animaciones de técnica" accent={colors.violet}>
        <AppText variant="body">
          La figura animada de técnica (fondos, etc.) es un desarrollo propio de Project Ascension.
        </AppText>
      </Card>

      <Card title="Sonidos" accent={colors.success}>
        <AppText variant="caption">
          Efectos de sonido: «Interface Sounds» y «Music Jingles» de Kenney (kenney.nl), dominio público (CC0 1.0). Se
          convirtieron a MP3 y se normalizó su volumen; el de reparación combina dos de ellos.
        </AppText>
      </Card>
      <Card title="Aviso">
        <AppText variant="caption">
          El contenido de ejercicios es informativo y no reemplaza la indicación de un profesional de la salud o del
          entrenamiento. Si sientes dolor (no solo esfuerzo), detén el ejercicio.
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { textDecorationLine: 'underline' },
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
});
