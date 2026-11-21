import { StyleSheet, View } from 'react-native';
import type { DataStatus } from '@/database/types';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

const META: Record<DataStatus, { label: string; color: string }> = {
  confirmed: { label: 'Confirmado', color: colors.success },
  historical: { label: 'Histórico', color: colors.warning },
  estimated: { label: 'Estimado', color: colors.textMuted },
};

export function DataStatusBadge({ status }: { status: DataStatus }) {
  const m = META[status];
  return (
    <View style={[styles.badge, { borderColor: m.color }]}>
      <AppText variant="label" color={m.color} style={styles.text}>
        {m.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  text: { fontSize: 10 },
});
