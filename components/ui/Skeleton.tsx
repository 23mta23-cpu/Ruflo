import React, { useEffect, useRef } from 'react';
<<<<<<< HEAD
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
=======
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { C } from '../../constants/colors';
import { shadow } from '../../constants/theme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** Single pulsing skeleton bar. Compose multiples for full skeleton screens. */
export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
>>>>>>> main

  return (
    <Animated.View
      style={[
<<<<<<< HEAD
        styles.base,
        { width: width as any, height, borderRadius: radius, opacity },
=======
        { width: width as any, height, borderRadius, backgroundColor: C.skeletonBase },
        { opacity },
>>>>>>> main
        style,
      ]}
    />
  );
}

<<<<<<< HEAD
export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardTop}>
        <Skeleton width={52} height={52} radius={26} />
        <View style={styles.cardLines}>
          <Skeleton height={14} radius={7} style={{ marginBottom: 8 }} />
          <Skeleton width="60%" height={11} radius={6} />
        </View>
      </View>
      <Skeleton height={11} radius={6} style={{ marginTop: 12 }} />
      <Skeleton width="80%" height={11} radius={6} style={{ marginTop: 8 }} />
=======
/** Pre-built skeleton for a typical card (avatar + 2 lines + 1 short line). */
export function CardSkeleton() {
  return (
    <View style={s.card}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={s.lines}>
        <Skeleton height={14} borderRadius={7} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={12} borderRadius={6} style={{ marginBottom: 6 }} />
        <Skeleton width="40%" height={10} borderRadius={5} />
      </View>
>>>>>>> main
    </View>
  );
}

<<<<<<< HEAD
const styles = StyleSheet.create({
  base:     { backgroundColor: '#e2e8f0' },
  card:     { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 12 },
  cardTop:  { flexDirection: 'row', gap: 12 },
  cardLines:{ flex: 1, justifyContent: 'center' },
=======
/** Pre-built skeleton for a list row (icon + text block). */
export function RowSkeleton() {
  return (
    <View style={s.row}>
      <Skeleton width={40} height={40} borderRadius={10} />
      <View style={s.rowLines}>
        <Skeleton height={13} borderRadius={6} style={{ marginBottom: 7 }} />
        <Skeleton width="55%" height={11} borderRadius={5} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:     { ...shadow.xs, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: 'row', gap: 12, marginBottom: 10 },
  lines:    { flex: 1, justifyContent: 'center' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  rowLines: { flex: 1 },
>>>>>>> main
});
