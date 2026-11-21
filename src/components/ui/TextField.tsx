import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';
import { AppText } from './AppText';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  unit?: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
}

export function TextField({ label, unit, hint, error, optional, onFocus, onBlur, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <AppText variant="label">{label}</AppText>
        {optional ? (
          <AppText variant="caption" color={colors.textFaint}>
            opcional
          </AppText>
        ) : null}
      </View>
      <View style={[styles.box, { borderColor }]}>
        <TextInput
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.cyan}
          cursorColor={colors.cyan}
          maxFontSizeMultiplier={1.6}
          accessibilityLabel={label}
          accessibilityHint={hint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
          {...input}
        />
        {unit ? <AppText variant="caption">{unit}</AppText> : null}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={colors.textFaint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  box: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: spacing.sm },
});
