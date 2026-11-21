import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

interface CardProps {
  children: ReactNode;
  /** Color de acento: dibuja una línea superior y tiñe el título. */
  accent?: string;
  title?: string;
  /** Elemento a la derecha del título. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
  highlighted?: boolean;
}

export function Card({ children, accent, title, action, style, highlighted }: CardProps) {
  return (
    <View style={[styles.card, highlighted && styles.highlighted, style]}>
      {accent ? <View style={[styles.accentLine, { backgroundColor: accent }]} /> : null}
      {title ? (
        <View style={styles.titleRow}>
          <AppText variant="label" color={accent ?? colors.textMuted} style={styles.title}>
            {title}
          </AppText>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  highlighted: { borderColor: colors.borderStrong, backgroundColor: colors.bgElevated },
  accentLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.9 },
  // El título largo se parte en varias líneas; las acciones nunca se encogen ni salen de la tarjeta.
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, flexShrink: 1 },
  action: { flexShrink: 0 },
});
