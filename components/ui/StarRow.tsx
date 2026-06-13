import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';

type Props = {
  rating: number;
  size?: number;
  gap?: number;
  useHalfStars?: boolean;
};

export function StarRow({ rating, size = 11, gap = 1, useHalfStars = true }: Props) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <View style={[styles.row, { gap }]}>
      {[1, 2, 3, 4, 5].map((s) => {
        let name: 'star' | 'star-half' | 'star-outline' = 'star-outline';
        if (useHalfStars) {
          if (s <= full) name = 'star';
          else if (s === full + 1 && half) name = 'star-half';
        } else {
          if (s <= Math.round(rating)) name = 'star';
        }
        return <Ionicons key={s} name={name} size={size} color={C.gold} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
