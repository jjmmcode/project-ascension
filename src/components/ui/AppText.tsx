import { Text, TextProps, TextStyle } from 'react-native';
import { colors, typography } from '@/theme';

type Variant = keyof typeof typography;

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
}

/** Texto tipado con la escala tipográfica del tema. Respeta el escalado de fuente del sistema. */
export function AppText({ variant = 'body', color, align, style, ...rest }: AppTextProps) {
  const base = typography[variant] as TextStyle;
  const defaultColor = variant === 'caption' || variant === 'label' ? colors.textMuted : colors.text;
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      style={[base, { color: color ?? defaultColor, textAlign: align }, style]}
      {...rest}
    />
  );
}
