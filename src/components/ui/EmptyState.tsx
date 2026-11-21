import { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

interface EmptyStateProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  color?: string;
  /** Etiqueta opcional, p. ej. "Disponible en Etapa 3". Nunca un botón falso. */
  tag?: string;
}

export function EmptyState({ icon, title, message, color = colors.textMuted, tag }: EmptyStateProps) {
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${title}. ${message}`}>
      <View style={[styles.iconBox, { borderColor: color }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText variant="caption" align="center" style={styles.message}>
        {message}
      </AppText>
      {tag ? (
        <View style={styles.tag}>
          <AppText variant="label" color={colors.textFaint}>
            {tag}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(148,163,184,0.06)',
  },
  message: { maxWidth: 280, lineHeight: 18 },
  tag: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
