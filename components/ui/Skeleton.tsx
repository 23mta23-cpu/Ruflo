import React, { useEffect, useRef } from 'react';
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

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

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
    </View>
  );
}

const styles = StyleSheet.create({
  base:     { backgroundColor: '#e2e8f0' },
  card:     { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 12 },
  cardTop:  { flexDirection: 'row', gap: 12 },
  cardLines:{ flex: 1, justifyContent: 'center' },
});
