/**
 * AnimatedButton — elastic scale(0.96) on press, butter-smooth spring release.
 * Drop-in replacement for TouchableOpacity wherever tactile feedback matters.
 */

import React, { useRef } from 'react';
import {
  Animated, GestureResponderEvent, StyleProp, TouchableWithoutFeedback, ViewStyle,
} from 'react-native';

interface Props {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  activeScale?: number;   // default 0.96
  children: React.ReactNode;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
  /**
   * Beschriftung fuer Screenreader. PFLICHT, wenn der Knopf nur ein Symbol
   * enthaelt — sonst liest die Vorlesefunktion "Schaltflaeche" ohne jeden
   * Hinweis, wozu sie dient. Bei Knoepfen mit sichtbarem Text kann sie
   * entfallen, dann wird der Text vorgelesen.
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link';
}

export function AnimatedButton({
  onPress,
  onLongPress,
  disabled = false,
  style,
  activeScale = 0.96,
  children,
  hitSlop,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, {
      toValue: activeScale,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  }

  function pressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }

  return (
    <TouchableWithoutFeedback
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      {/*
        Die Barrierefreiheits-Angaben stehen auf der Animated.View, nicht auf
        dem TouchableWithoutFeedback: dieser klont sie ohnehin auf sein Kind,
        und so bleibt sichtbar, welcher Knoten fuer die Vorlesefunktion
        tatsaechlich der Knopf ist.

        Bis 15.08.2026 reichte dieser Baustein GAR KEINE dieser Angaben durch.
        Alle 22 Verwendungsstellen waren damit fuer eine Vorlesefunktion
        namenlose Flaechen ohne Rolle — bei einem Dienst, der seit Juni 2025
        unter das BFSG faellt.
      */}
      <Animated.View
        accessible
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={[style, { transform: [{ scale }], opacity: disabled ? 0.45 : 1 }]}
      >
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
