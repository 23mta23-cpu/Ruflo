/**
 * Reveal — sanftes Einschweben (Fade + Slide-up) beim Mount.
 *
 * Motion-Grundbaustein für die App: Inhalte erscheinen nicht schlagartig,
 * sondern gleiten mit einer kurzen, gestaffelten Verzögerung herein. Nutzt
 * ausschließlich die eingebaute react-native `Animated`-API (native driver,
 * läuft sauber auf iOS/Android UND react-native-web) — keine zusätzliche
 * Abhängigkeit, kein Web-Build-Risiko.
 *
 * <Reveal delay={80}> … </Reveal>  // ein Element
 * Für Listen: index * 60 als delay → gestaffelter „Kaskaden"-Effekt.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle, AccessibilityInfo, Platform } from 'react-native';

interface Props {
  children: React.ReactNode;
  /** Verzögerung in ms vor dem Einschweben (für Stagger: index * 50–70). */
  delay?: number;
  /** Startversatz nach unten in px (Default 14). */
  offset?: number;
  /** Dauer in ms (Default 420). */
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export function Reveal({ children, delay = 0, offset = 14, duration = 420, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    // Respektiert „Bewegung reduzieren" (Barrierefreiheit): dann ohne Animation.
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        progress.setValue(1);
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
    return () => { cancelled = true; };
  }, [progress, delay, duration]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
