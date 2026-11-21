import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Polygon,
  RadialGradient,
  Stop,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import { playSound } from "@/features/sound/sound";
import { AppText, Button, RankBadge } from "@/components/ui";
import { colors, rankColors, spacing } from "@/theme";
import type { MuscleRankLetter, Rank } from "@/features/progression/leveling";
import type { MuscleGroup } from "@/features/exercises/library";
import { MUSCLE_GROUP_LABEL } from "@/features/exercises/library";

export interface LevelUpEvent {
  fromLevel: number;
  toLevel: number;
  fromRank: Rank;
  toRank: Rank;
  xpGained: number;
  muscleUps: Array<{ muscle: MuscleGroup; from: MuscleRankLetter | null; to: MuscleRankLetter }>;
  /** Puntos de atributo ganados en los niveles nuevos. */
  points: Array<{ attr: string; reason: string }>;
  /** Puntos recuperados por memoria muscular. */
  recovered: Array<{ attr: string; reason: string }>;
}

const RAYS = 14;
const PARTICLES = 18;

/** Rayos de luz alrededor del emblema (SVG estático que gira dentro de un Animated.View). */
function Rays({ size, color }: { size: number; color: string }) {
  const c = size / 2;
  const polys = Array.from({ length: RAYS }, (_, i) => {
    const a = (i / RAYS) * Math.PI * 2;
    const w = (Math.PI / RAYS) * 0.45;
    const r = c;
    const p = (ang: number, rad: number) =>
      `${c + Math.cos(ang) * rad},${c + Math.sin(ang) * rad}`;
    return `${p(a - w, r)} ${p(a + w, r)} ${p(a, 18)}`;
  });
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={0.55} />
          <Stop offset="60%" stopColor={color} stopOpacity={0.12} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={c} fill="url(#glow)" />
      {polys.map((pts, i) => (
        <Polygon
          key={i}
          points={pts}
          fill={color}
          opacity={i % 2 ? 0.18 : 0.32}
        />
      ))}
    </Svg>
  );
}

function Particle({
  angle,
  distance,
  delay,
  color,
  reduce,
}: {
  angle: number;
  distance: number;
  delay: number;
  color: string;
  reduce: boolean;
}) {
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce)
      t.value = withDelay(
        delay,
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
      );
  }, [delay, reduce, t]);
  const style = useAnimatedStyle(() => ({
    opacity: reduce ? 0 : 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * distance * t.value },
      { translateY: Math.sin(angle) * distance * t.value },
      { scale: 1 - t.value * 0.6 },
    ],
  }));
  return (
    <Animated.View
      style={[styles.particle, { backgroundColor: color }, style]}
    />
  );
}

/**
 * Escena de subida de nivel: oscurecer, destello, rayos girando, partículas, contador de nivel
 * y, si cambia el rango, revelación del emblema nuevo con anillo de energía.
 * Con «reducir movimiento» se muestra el estado final sin animaciones.
 */
export function LevelUpOverlay({
  event,
  onClose,
}: {
  event: LevelUpEvent;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const rankUp = event.toRank !== event.fromRank;
  const levelUp = event.toLevel > event.fromLevel;
  const muscleOnly = !rankUp && !levelUp && event.muscleUps.length > 0;
  const mainRank = muscleOnly ? event.muscleUps[0]!.to : event.toRank;
  const color = rankColors[mainRank];
  const raySize = Math.min(width * 1.1, 460);

  const [shownLevel, setShownLevel] = useState(
    reduce ? event.toLevel : event.fromLevel,
  );
  const [ready, setReady] = useState(reduce);

  const backdrop = useSharedValue(reduce ? 1 : 0);
  const flash = useSharedValue(0);
  const emblem = useSharedValue(reduce ? 1 : 0);
  const spin = useSharedValue(0);
  const ring = useSharedValue(0);
  const title = useSharedValue(reduce ? 1 : 0);

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => ({
        angle: (i / PARTICLES) * Math.PI * 2 + (i % 3) * 0.2,
        distance: 110 + ((i * 37) % 90),
        delay: 350 + (i % 5) * 40,
      })),
    [],
  );

  useEffect(() => {
    if (reduce) {
      void playSound(rankUp ? "rank_up" : event.toLevel > event.fromLevel ? "level_up" : "ding");
      return;
    }
    backdrop.value = withTiming(1, { duration: 300 });
    flash.value = withDelay(
      250,
      withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0, { duration: 650 }),
      ),
    );
    emblem.value = withDelay(
      300,
      withSpring(1, { damping: 9, stiffness: 120 }),
    );
    spin.value = withRepeat(
      withTiming(1, { duration: 16000, easing: Easing.linear }),
      -1,
    );
    title.value = withDelay(
      650,
      withTiming(1, { duration: 450, easing: Easing.out(Easing.back(1.6)) }),
    );
    if (rankUp)
      ring.value = withDelay(
        1500,
        withRepeat(
          withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
          3,
        ),
      );

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    // Sonido: rango → fanfarria épica + impacto; nivel → fanfarria; rank muscular/puntos → ding; recuperación → sonido propio
    const levelUp = event.toLevel > event.fromLevel;
    timers.push(
      setTimeout(() => {
        if (rankUp) void playSound("rank_up");
        else if (levelUp) void playSound("level_up");
        else if (event.recovered.length > 0) void playSound("recover");
        else void playSound("ding");
      }, 280),
    );
    if (rankUp) timers.push(setTimeout(() => void playSound("impact"), 1500));
    else if (levelUp && event.recovered.length > 0) timers.push(setTimeout(() => void playSound("recover"), 1700));
    if (event.points.length > 0 && (levelUp || rankUp)) timers.push(setTimeout(() => void playSound("ding"), rankUp ? 2000 : 1300));
    timers.push(
      setTimeout(
        () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
        260,
      ),
    );
    // Contador de nivel: pasos rápidos con un toque háptico suave.
    const steps = Math.max(0, event.toLevel - event.fromLevel);
    for (let i = 1; i <= steps; i++) {
      timers.push(
        setTimeout(
          () => {
            setShownLevel(event.fromLevel + i);
            void Haptics.selectionAsync();
          },
          800 + i * Math.min(220, 900 / steps),
        ),
      );
    }
    if (rankUp)
      timers.push(
        setTimeout(
          () =>
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            ),
          1500,
        ),
      );
    timers.push(setTimeout(() => setReady(true), rankUp ? 2100 : 1500));
    return () => timers.forEach(clearTimeout);
  }, [
    reduce,
    backdrop,
    flash,
    emblem,
    spin,
    title,
    ring,
    rankUp,
    event.fromLevel,
    event.toLevel,
  ]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
    transform: [{ scale: 0.4 + flash.value * 2.6 }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: emblem.value,
    transform: [
      { rotate: `${spin.value * 360}deg` },
      { scale: 0.6 + emblem.value * 0.4 },
    ],
  }));
  const emblemStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 0.2 + emblem.value * 0.8 },
      { rotate: `${(1 - emblem.value) * -25}deg` },
    ],
    opacity: Math.min(1, emblem.value * 1.5),
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: rankUp ? (1 - ring.value) * 0.9 : 0,
    transform: [{ scale: 1 + ring.value * 1.4 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [
      { translateY: (1 - title.value) * 24 },
      { scale: 0.9 + title.value * 0.1 },
    ],
  }));

  const heading = rankUp
    ? "NUEVO RANGO"
    : levelUp
      ? "¡SUBISTE DE NIVEL!"
      : event.muscleUps.length > 0
        ? "RANK DE MÚSCULO"
        : "MEMORIA MUSCULAR";
  const pointSummary = summarize(event.points);

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <Pressable
        style={styles.center}
        onPress={ready ? onClose : undefined}
        accessibilityLabel={heading}
      >
        <View style={styles.stage}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.centered,
              {
                width: raySize,
                height: raySize,
                marginLeft: -raySize / 2,
                marginTop: -raySize / 2,
              },
              raysStyle,
            ]}
          >
            <Rays size={raySize} color={color} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[styles.flash, flashStyle]}
          />
          {particles.map((p, i) => (
            <Particle
              key={i}
              {...p}
              color={i % 3 === 0 ? colors.text : color}
              reduce={reduce}
            />
          ))}
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { borderColor: color }, ringStyle]}
          />
          <Animated.View style={[styles.emblemWrap, emblemStyle]}>
            {levelUp ? (
              <View
                style={[
                  styles.levelDisc,
                  { borderColor: color, shadowColor: color },
                ]}
              >
                <AppText variant="label" color={colors.textMuted}>
                  NIVEL
                </AppText>
                <AppText
                  variant="display"
                  color={colors.text}
                  style={styles.levelNumber}
                >
                  {shownLevel}
                </AppText>
              </View>
            ) : null}
            <View style={styles.badgeRow}>
              {rankUp ? (
                <>
                  <RankBadge rank={event.fromRank} size={44} />
                  <AppText variant="heading" color={colors.textFaint}>
                    →
                  </AppText>
                </>
              ) : null}
              <RankBadge rank={mainRank} size={rankUp || muscleOnly ? 76 : 52} />
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.texts, titleStyle]}>
          <AppText variant="title" color={color} style={styles.heading}>
            {heading}
          </AppText>
          <AppText
            variant="body"
            color={colors.textMuted}
            style={styles.centerText}
          >
            {rankUp
              ? `Rango ${event.fromRank} → ${event.toRank} · nivel ${event.toLevel}`
              : levelUp
                ? `Nivel ${event.fromLevel} → ${event.toLevel}`
                : event.muscleUps.length > 0
                  ? "Tu fuerza subió de rango"
                  : "Recuperaste lo perdido por inactividad"}
            {event.xpGained > 0 ? ` · +${event.xpGained} XP` : ""}
          </AppText>
        </Animated.View>

        {event.muscleUps.length > 0 ? (
          <View style={styles.muscles}>
            {event.muscleUps.slice(0, 3).map((m, i) => (
              <Animated.View
                key={m.muscle}
                entering={
                  reduce
                    ? undefined
                    : FadeInDown.delay(
                        (rankUp ? 1700 : 1100) + i * 180,
                      ).springify()
                }
                style={[styles.muscleRow, { borderColor: rankColors[m.to] }]}
              >
                <AppText variant="heading">
                  {MUSCLE_GROUP_LABEL[m.muscle]}
                </AppText>
                <AppText variant="heading" color={rankColors[m.to]}>
                  {m.from ?? "—"} → {m.to}
                </AppText>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {event.points.length > 0 || event.recovered.length > 0 ? (
          <Animated.View
            entering={reduce ? undefined : FadeInDown.delay(rankUp ? 2000 : 1300).springify()}
            style={[styles.pointsBox, { borderColor: color }]}
          >
            {event.points.length > 0 ? (
              <>
                <AppText variant="heading" color={color}>
                  +{event.points.length} puntos de atributo · {pointSummary}
                </AppText>
                {event.points.slice(0, 3).map((p, i) => (
                  <AppText key={i} variant="caption" numberOfLines={1}>
                    {p.attr} +1 · {p.reason}
                  </AppText>
                ))}
              </>
            ) : null}
            {event.recovered.length > 0 ? (
              <AppText variant="caption" color={colors.success}>
                Memoria muscular: {summarize(event.recovered)} recuperado
                {event.recovered.length > 1 ? "s" : ""}
              </AppText>
            ) : null}
          </Animated.View>
        ) : null}

        <View style={[styles.cta, { opacity: ready ? 1 : 0 }]}>
          <Button
            label="Continuar"
            icon="arrow-forward"
            onPress={onClose}
            disabled={!ready}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

function summarize(points: Array<{ attr: string }>): string {
  const counts = new Map<string, number>();
  for (const p of points) counts.set(p.attr, (counts.get(p.attr) ?? 0) + 1);
  return [...counts].map(([a, n]) => `${a} +${n}`).join(" · ");
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(4,6,14,0.94)",
  },
  stage: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { position: "absolute", left: "50%", top: "50%" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.lg,
  },
  flash: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#FFFFFF",
  },
  particle: { position: "absolute", width: 8, height: 8, borderRadius: 4 },
  emblemWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  ring: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 3,
  },
  levelDisc: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,11,20,0.85)",
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 12,
  },
  levelNumber: { fontSize: 52, lineHeight: 58 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  texts: { alignItems: "center", gap: spacing.xs },
  heading: { letterSpacing: 3, textAlign: "center" },
  centerText: { textAlign: "center" },
  muscles: { alignSelf: "stretch", gap: spacing.sm },
  muscleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(23,35,56,0.9)",
  },
  cta: { alignSelf: "stretch" },
  pointsBox: {
    alignSelf: "stretch",
    gap: 4,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(23,35,56,0.9)",
  },
});
