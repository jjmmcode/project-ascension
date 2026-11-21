import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DATABASE_NAME, initDatabase } from '@/database/client';
import { useProfileStore } from '@/stores/profileStore';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { BadgeEventOverlay } from '@/features/penance/BadgeEventOverlay';
import { loadSoundConfig } from '@/features/sound/soundSettings';
import { preloadSounds } from '@/features/sound/sound';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbError, setDbError] = useState<Error | null>(null);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, []);

  useEffect(() => {
    if (dbError) void SplashScreen.hideAsync();
  }, [dbError]);

  return (
    <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider>
      <StatusBar style="light" />
      {dbError ? (
        <FatalError error={dbError} />
      ) : (
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase} onError={setDbError}>
          <Bootstrap />
        </SQLiteProvider>
      )}
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Se monta cuando las migraciones ya terminaron: carga el perfil y oculta el splash. */
function Bootstrap() {
  const db = useSQLiteContext();
  const status = useProfileStore((s) => s.status);
  const error = useProfileStore((s) => s.error);
  const refresh = useProfileStore((s) => s.refresh);

  useEffect(() => {
    void refresh(db);
  }, [db, refresh]);

  const profileId = useProfileStore((s) => s.profile?.id);
  useEffect(() => {
    if (!profileId) return;
    void loadSoundConfig(db, profileId).then(() => preloadSounds());
  }, [db, profileId]);

  useEffect(() => {
    if (status === 'ready' || status === 'error') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'error') return <FatalError error={new Error(error ?? 'Error desconocido')} />;
  if (status !== 'ready') return null;

  return (
    <>
    <BadgeEventOverlay />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="technique/[id]" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="exercises/index" />
      <Stack.Screen name="exercises/[id]" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="credits" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="workout/index" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="workout/add" />
      <Stack.Screen name="routine/[id]" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="cardio" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
    </>
  );
}

function FatalError({ error }: { error: Error }) {
  return (
    <View style={styles.fatal}>
      <AppText variant="title">No se pudo abrir la base de datos</AppText>
      <AppText variant="caption">
        Tus datos no se han modificado. Cierra y vuelve a abrir la app. Si persiste, comparte este mensaje:
      </AppText>
      <AppText variant="caption" color={colors.danger} selectable>
        {error.message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fatal: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
});
