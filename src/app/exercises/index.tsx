import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { LIBRARY, MUSCLE_GROUP_LABEL, searchLibrary, SHOW_STICK_ANIMATIONS, type LibraryExercise, type MuscleGroup } from '@/features/exercises/library';
import { colors, MIN_TOUCH, radius, spacing } from '@/theme';

const MUSCLES = Object.keys(MUSCLE_GROUP_LABEL) as MuscleGroup[];

function Row({ item }: { item: LibraryExercise }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}. ${item.primary.map((m) => MUSCLE_GROUP_LABEL[m]).join(', ')}`}
      onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.thumb}>
        {item.images ? (
          <Image source={item.images[1]} style={styles.thumbImg} resizeMode="contain" />
        ) : (
          <Ionicons name="body-outline" size={28} color={colors.violet} />
        )}
      </View>
      <View style={styles.flex}>
        <AppText variant="heading" numberOfLines={2}>
          {item.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {item.primary.map((m) => MUSCLE_GROUP_LABEL[m]).join(' · ')}
        </AppText>
        <View style={styles.badges}>
          {SHOW_STICK_ANIMATIONS && item.techniqueId ? <Badge label="Animación" color={colors.violet} /> : null}
          {!item.translated ? <Badge label="Instrucciones EN" color={colors.textFaint} /> : null}
          {!item.fitsMyEquipment ? <Badge label="Otro equipo" color={colors.warning} /> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <AppText variant="label" color={color} style={styles.badgeText}>
        {label}
      </AppText>
    </View>
  );
}

export default function ExerciseLibraryScreen() {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [onlyMine, setOnlyMine] = useState(true);

  const results = useMemo(() => searchLibrary(query, { muscle, onlyMine }), [query, muscle, onlyMine]);

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <AppText variant="label" color={colors.cyan}>
            {'// Training'}
          </AppText>
          <AppText variant="title">Biblioteca</AppText>
        </View>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar ejercicio (español o inglés)"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          accessibilityLabel="Buscar ejercicio"
          returnKeyType="search"
          autoCorrect={false}
        />
        {query ? (
          <Pressable accessibilityLabel="Borrar búsqueda" onPress={() => setQuery('')} hitSlop={12}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[null, ...MUSCLES].map((m) => {
          const selected = m === muscle;
          return (
            <Pressable
              key={m ?? 'all'}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setMuscle(m)}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <AppText variant="caption" color={selected ? colors.text : colors.textMuted}>
                {m ? MUSCLE_GROUP_LABEL[m] : 'Todos'}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.mineRow}>
        <View style={styles.flex}>
          <AppText variant="body">Solo con mi equipamiento</AppText>
          <AppText variant="caption">Mancuernas, barras, banco, poleas, máquinas y paralelas</AppText>
        </View>
        <Switch
          value={onlyMine}
          onValueChange={setOnlyMine}
          trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
          thumbColor={colors.text}
          accessibilityLabel="Solo ejercicios con mi equipamiento"
        />
      </View>
      <AppText variant="caption" color={colors.textFaint}>
        {results.length} de {LIBRARY.length} ejercicios
      </AppText>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <Row item={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <AppText variant="caption" align="center" style={styles.empty}>
            No hay ejercicios con esos filtros.
          </AppText>
        }
        ListFooterComponent={
          <Pressable accessibilityRole="link" onPress={() => router.push('/credits')} style={styles.credits}>
            <AppText variant="caption" color={colors.textFaint} align="center">
              Ilustraciones y textos base: Everkinetic (CC BY-SA 4.0), adaptados. Ver créditos.
            </AppText>
          </Pressable>
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        initialNumToRender={12}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, marginBottom: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
  },
  chipOn: { borderColor: colors.violet, backgroundColor: 'rgba(139,92,246,0.18)' },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: {
    width: 64,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
  badgeText: { fontSize: 9 },
  empty: { marginTop: spacing.xl },
  credits: { paddingVertical: spacing.xl },
});
