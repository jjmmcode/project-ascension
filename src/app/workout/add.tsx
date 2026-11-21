import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { templatesRepo } from '@/database/repositories/templates';
import { useProfileStore } from '@/stores/profileStore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { ALL_OPTIONS, FEATURED_IDS, searchOptions, type ExerciseOption } from '@/features/training/exerciseOptions';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

export default function AddExerciseScreen() {
  const { template, swap } = useLocalSearchParams<{ template?: string; swap?: string }>();
  const db = useSQLiteContext();
  const inProgress = useProfileStore((s) => s.inProgress);
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  // Sugeridos: en una sesión de rutina, los ejercicios de esa rutina; sin rutina, la lista fija.
  const [featured, setFeatured] = useState<{ title: string; ids: string[] }>(
    template ? { title: '', ids: [] } : { title: 'Tu rutina: bíceps y espalda', ids: FEATURED_IDS },
  );

  useFocusEffect(
    useCallback(() => {
      if (template || !inProgress?.templateId) return;
      const tid = inProgress.templateId;
      void (async () => {
        const t = await templatesRepo.get(db, tid);
        const ex = await templatesRepo.exercises(db, tid);
        if (t) setFeatured({ title: `Tu rutina: ${t.name.toLowerCase()}`, ids: ex.map((e) => e.exerciseId) });
      })();
    }, [db, template, inProgress?.templateId]),
  );

  const sections = useMemo(() => {
    const results = searchOptions(query, onlyMine);
    const top = featured.ids.map((id) => ALL_OPTIONS.find((o) => o.ref.id === id)).filter(
      (o): o is ExerciseOption => !!o && results.includes(o),
    );
    const library = results.filter((o) => !featured.ids.includes(o.ref.id));
    return [
      { title: featured.title, data: top },
      { title: 'Biblioteca', data: library },
    ].filter((s) => s.data.length > 0);
  }, [query, onlyMine, featured]);

  // Antes de añadir, se abre la ficha (ilustración + mapa muscular + técnica) con el botón "Añadir a la sesión".
  const pick = (o: ExerciseOption) => {
    router.push({
      pathname: '/exercises/[id]',
      params: template
        ? { id: o.libraryId ?? o.ref.id, pick: '1', template }
        : swap
          ? { id: o.libraryId ?? o.ref.id, pick: '1', swap }
          : { id: o.libraryId ?? o.ref.id, pick: '1' },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <SectionList
        sections={sections}
        keyExtractor={(o) => o.ref.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.topRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </Pressable>
              <AppText variant="title">{template ? 'Añadir a la rutina' : swap ? 'Cambiar ejercicio' : 'Añadir ejercicio'}</AppText>
            </View>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.textFaint} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar (curl, remo, jalón…)"
                placeholderTextColor={colors.textFaint}
                style={styles.searchInput}
                accessibilityLabel="Buscar ejercicio"
                autoCorrect={false}
              />
            </View>
            <View style={styles.mineRow}>
              <AppText variant="body" style={styles.flex}>
                Solo con mi equipamiento
              </AppText>
              <Switch
                value={onlyMine}
                onValueChange={setOnlyMine}
                trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
                thumbColor={colors.text}
              />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <AppText variant="label" color={colors.cyan} style={styles.sectionTitle}>
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver ${item.ref.name} antes de añadir`}
            onPress={() => pick(item)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
          >
            <View style={styles.flex}>
              <AppText variant="heading" numberOfLines={2}>
                {item.ref.name}
              </AppText>
              <AppText variant="caption" numberOfLines={1}>
                {item.subtitle}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textFaint} />
          </Pressable>
        )}
        ListEmptyComponent={
          <AppText variant="caption" align="center">
            Sin resultados.
          </AppText>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 16 },
  mineRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 8,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
