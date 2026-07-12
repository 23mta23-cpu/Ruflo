/**
 * ProgressRing — animierter Fortschritts-Ring (Signature-Daten-Viz).
 *
 * Werkants Antwort auf "Standard-App": ein markeneigenes, ruhiges
 * Fortschritts-Element (Paket-Tracking-Gefühl) statt Candy-Gradient.
 * Reines react-native-svg (bereits installiert, s. BrandMark) + Animated —
 * keine neue Abhängigkeit, läuft auf iOS/Android UND Web.
 *
 * <ProgressRing progress={0.5} label="3/6" sublabel="Schritte" />
 *
 * Barrierefreiheit: respektiert "Bewegung reduzieren" (dann ohne Sweep),
 * accessibilityRole/-Label für Screenreader.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, AccessibilityInfo } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C } from '../../constants/colors';

interface Props {
  /** 0..1 */
  progress: number;
  /** Zentrumstext, z. B. "3/6" */
  label?: string;
  /** Kleiner Text unter dem Label, z. B. "Schritte" */
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}

export function ProgressRing({
  progress,
  label,
  sublabel,
  size = 72,
  strokeWidth = 7,
  color = C.primary,
  trackColor = C.border,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animierter Sweep von 0 → progress beim Mount. SVG-Props sind über
  // Animated nicht direkt web-kompatibel animierbar → Listener + State
  // (60fps ist hier unkritisch, Dauer 700ms, ein einzelnes Element).
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const sub = anim.addListener(({ value }) => setShown(value));
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        anim.setValue(clamped);
        return;
      }
      Animated.timing(anim, {
        toValue: clamped,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // animiert SVG-Prop via Listener, kein Transform
      }).start();
    });
    return () => {
      cancelled = true;
      anim.removeListener(sub);
    };
  }, [clamped, anim]);

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityLabel={`Fortschritt ${Math.round(clamped * 100)} Prozent${label ? `, ${label}${sublabel ? ` ${sublabel}` : ''}` : ''}`}
    >
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Fortschritt — startet oben (12 Uhr) durch -90°-Rotation */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - shown)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {(label || sublabel) && (
        <View style={styles.center} pointerEvents="none">
          {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  label:    { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  sublabel: { fontSize: 9, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 },
});
