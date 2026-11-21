import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';
import { AppText } from './AppText';

interface ChoiceChipsProps<T extends string | number> {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  color?: string;
}

/** Selección única con chips (radio group accesible). */
export function ChoiceChips<T extends string | number>({ label, options, value, onChange, color = colors.primary }: ChoiceChipsProps<T>) {
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(o.value);
              }}
              style={[
                styles.chip,
                selected && { borderColor: color, backgroundColor: `${color}26` },
              ]}
            >
              <AppText variant="body" color={selected ? colors.text : colors.textMuted} style={selected && styles.bold}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: MIN_TOUCH - 8,
    minWidth: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bold: { fontWeight: '700' },
});
