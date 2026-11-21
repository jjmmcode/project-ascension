import { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

interface StatTileProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  /** Valor ya formateado. Usa "—" cuando no hay datos: nunca inventar un número. */
  value: string;
  unit?: string;
  hint?: string;
  color?: string;
  onPress?: () => void;
}

export function StatTile({ icon, label, value, unit, hint, color = colors.primary, onPress }: StatTileProps) {
  const content = (
    <>
      <View style={styles.head}>
        <Ionicons name={icon} size={16} color={color} />
        <AppText variant="label" numberOfLines={1} style={styles.label}>
          {label}
        </AppText>
      </View>
      <View style={styles.valueRow}>
        <AppText variant="numeric">{value}</AppText>
        {unit ? <AppText variant="caption">{unit}</AppText> : null}
      </View>
      {hint ? (
        <AppText variant="caption" color={colors.textFaint} numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value} ${unit ?? ''}`}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value} ${unit ?? ''}. Abrir`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { flexShrink: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
});
