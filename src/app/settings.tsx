import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { z } from 'zod';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { colors, MIN_TOUCH, radius } from '@/theme';
import { useProfileStore } from '@/stores/profileStore';
import { profilesRepo } from '@/database/repositories/profiles';
import { settingsRepo } from '@/database/repositories/settings';
import { backupFileName, BackupError, LAST_BACKUP_KEY, exportBackup, parseBackup, restoreBackup } from '@/services/backup';
import { formatShortDate } from '@/lib/time';
import Constants from 'expo-constants';
import { SoundSettings } from '@/features/sound/SoundSettings';
import { RestModeCard, SimulatorCard } from '@/features/penance/PenanceCards';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const profile = useProfileStore((s) => s.profile);
  const refresh = useProfileStore((s) => s.refresh);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [birth, setBirth] = useState('');
  const [birthError, setBirthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [taps, setTaps] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    setLastBackup(await settingsRepo.get(db, profile.id, LAST_BACKUP_KEY, z.string()));
    setBirth(profile.birthYear ? String(profile.birthYear) : '');
  }, [db, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const doExport = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const now = new Date();
      const file = new File(Paths.cache, backupFileName(now));
      if (file.exists) file.delete();
      file.create();
      await file.write(JSON.stringify(await exportBackup(db, now)));
      await settingsRepo.set(db, profile.id, LAST_BACKUP_KEY, z.string(), now.toISOString());
      setLastBackup(now.toISOString());
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Guarda tu copia (por ejemplo en Google Drive)',
        });
      } else {
        Alert.alert('Copia creada', file.uri);
      }
    } catch (e) {
      Alert.alert('No se pudo exportar', e instanceof Error ? e.message : 'Inténtalo de nuevo');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    try {
      const text = await new File(res.assets[0].uri).text();
      const { backup, summary } = parseBackup(text);
      Alert.alert(
        'Restaurar copia',
        `Copia del ${formatShortDate(summary.exportedAt)}: ${summary.workouts} sesiones, ${summary.sets} series, ` +
          `${summary.bodyMetrics} mediciones y ${summary.xpEvents} registros de XP.\n\n` +
          'Se reemplazarán TODOS los datos actuales de la app por los de la copia. ¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await restoreBackup(db, backup);
                await refresh(db);
                Alert.alert('Copia restaurada', 'Tus datos se recuperaron.');
                router.replace('/');
              } catch (e) {
                Alert.alert('No se pudo restaurar', `No se cambió nada. ${e instanceof Error ? e.message : ''}`);
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('Archivo no válido', e instanceof BackupError ? e.message : 'No se pudo leer el archivo.');
    }
  };

  const saveBirth = async () => {
    if (!profile) return;
    const y = Number(birth);
    try {
      await profilesRepo.setBirthYear(db, profile.id, y);
      setBirthError(null);
      await refresh(db);
    } catch {
      setBirthError('Año entre 1900 y el actual');
    }
  };

  const close = (
    <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.iconBtn}>
      <Ionicons name="arrow-back" size={22} color={colors.text} />
    </Pressable>
  );

  const stale = !lastBackup || Date.now() - Date.parse(lastBackup) > 14 * 86_400_000;

  return (
    <Screen title="Ajustes" subtitle="Perfil, datos y sonido" accessory={close}>
      <Card title="Copia de seguridad" accent={stale ? colors.warning : colors.success} highlighted={stale}>
        <AppText variant="caption">
          Tus datos solo viven en este teléfono. Exporta una copia y guárdala en Google Drive (o donde prefieras) para no
          perderlos si cambias o reinicias el teléfono.
        </AppText>
        <AppText variant="caption" color={stale ? colors.warning : colors.success}>
          {lastBackup ? `Última copia: ${formatShortDate(lastBackup)}` : 'Aún no has hecho ninguna copia'}
        </AppText>
        <Button label="Exportar copia" icon="cloud-upload-outline" onPress={doExport} loading={busy} />
        <Button label="Restaurar desde un archivo" icon="cloud-download-outline" variant="secondary" onPress={doImport} />
      </Card>

      <Card title="Perfil">
        <TextField
          label="Año de nacimiento"
          value={birth}
          onChangeText={setBirth}
          onEndEditing={() => void saveBirth()}
          keyboardType="number-pad"
          placeholder="Ej. 1995"
          error={birthError}
        />
        <AppText variant="caption" color={colors.textFaint}>
          Se usa para la edad en el cálculo de gasto energético.
        </AppText>
      </Card>

      <SoundSettings />
      <RestModeCard />
      {taps >= 5 ? <SimulatorCard /> : null}

      <Pressable accessibilityRole="text" onPress={() => setTaps((t) => t + 1)} style={styles.version}>
        <AppText variant="caption" color={colors.textFaint}>
          Project Ascension · versión {Constants.expoConfig?.version ?? '—'}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  version: { alignItems: 'center', paddingVertical: 12 },
  iconBtn: {
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
