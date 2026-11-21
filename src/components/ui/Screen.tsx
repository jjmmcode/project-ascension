import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';
import { AppText } from './AppText';

interface ScreenProps {
  title: string;
  subtitle?: string;
  /** Contenido a la derecha del título (p. ej. un badge). */
  accessory?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}

/** Contenedor base de cada pantalla: safe area, fondo y cabecera HUD. */
export function Screen({ title, subtitle, accessory, children, scroll = true }: ScreenProps) {
  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText variant="label" color={colors.cyan}>
          {'// '}
          {subtitle ?? 'Project Ascension'}
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {accessory}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  headerText: { flex: 1, gap: spacing.xxs },
});
