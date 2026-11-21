import { useCallback, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { AppText, Button, Card, ChoiceChips } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useProfileStore } from '@/stores/profileStore';
import { loadSoundConfig, saveSoundConfig } from './soundSettings';
import { DEFAULT_SOUND_CONFIG, playSound, type SoundConfig } from './sound';

export function SoundSettings() {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const [cfg, setCfg] = useState<SoundConfig>(DEFAULT_SOUND_CONFIG);

  useFocusEffect(
    useCallback(() => {
      if (profile) void loadSoundConfig(db, profile.id).then(setCfg);
    }, [db, profile]),
  );

  const update = (patch: Partial<SoundConfig>) => {
    if (!profile) return;
    const next = { ...cfg, ...patch };
    setCfg(next);
    void saveSoundConfig(db, profile.id, next);
  };

  return (
    <Card title="Sonido" accent={colors.cyan}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="body">Efectos de sonido</AppText>
          <AppText variant="caption" color={colors.textFaint}>
            Suenan con tu música sin pausarla; en modo silencio o vibración no suena nada.
          </AppText>
        </View>
        <Switch
          value={cfg.enabled}
          onValueChange={(v) => update({ enabled: v })}
          trackColor={{ true: colors.cyan, false: colors.border }}
          accessibilityLabel="Efectos de sonido"
        />
      </View>
      {cfg.enabled ? (
        <>
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="body">Solo momentos importantes</AppText>
              <AppText variant="caption" color={colors.textFaint}>
                Nivel, rango, emblema. Sin el tick de cada serie.
              </AppText>
            </View>
            <Switch
              value={cfg.onlyBig}
              onValueChange={(v) => update({ onlyBig: v })}
              trackColor={{ true: colors.cyan, false: colors.border }}
              accessibilityLabel="Solo momentos importantes"
            />
          </View>
          <ChoiceChips
            label="Volumen"
            options={[
              { value: '0.25', label: '25 %' },
              { value: '0.5', label: '50 %' },
              { value: '0.8', label: '80 %' },
              { value: '1', label: '100 %' },
            ]}
            value={String(cfg.volume)}
            onChange={(v) => update({ volume: Number(v) })}
          />
          <Button label="Probar sonido" icon="volume-high-outline" variant="ghost" onPress={() => void playSound('level_up')} />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
