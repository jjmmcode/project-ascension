import { ComponentProps } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useProfileStore } from '@/stores/profileStore';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: Array<{ name: string; title: string; icon: IconName; activeIcon: IconName; color: string }> = [
  { name: 'index', title: 'Status', icon: 'pulse-outline', activeIcon: 'pulse', color: colors.cyan },
  { name: 'training', title: 'Training', icon: 'barbell-outline', activeIcon: 'barbell', color: colors.module.training },
  { name: 'nutrition', title: 'Nutrición', icon: 'restaurant-outline', activeIcon: 'restaurant', color: colors.module.nutrition },
  { name: 'quests', title: 'Quests', icon: 'flag-outline', activeIcon: 'flag', color: colors.module.quests },
  { name: 'progress', title: 'Evolution', icon: 'trending-up-outline', activeIcon: 'trending-up', color: colors.module.evolution },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((s) => s.profile);

  // Sin onboarding completado no se muestra ninguna pestaña.
  if (!profile?.onboardingCompletedAt) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarActiveTintColor: t.color,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons name={focused ? t.activeIcon : t.icon} size={size} color={color as string} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
