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
}

export function AnimatedButton({
  onPress,
  onLongPress,
  disabled = false,
  style,
  activeScale = 0.96,
  children,
  hitSlop,
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
      <Animated.View style={[style, { transform: [{ scale }], opacity: disabled ? 0.45 : 1 }]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
