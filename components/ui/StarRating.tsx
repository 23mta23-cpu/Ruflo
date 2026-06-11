import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';

export function StarRating({ rating, count }: { rating: number; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < Math.floor(rating) ? 'star' : i < rating ? 'star-half' : 'star-outline'}
          size={13}
          color={C.gold}
        />
      ))}
      {count !== undefined && (
        <Text style={{ fontSize: 12, color: C.sub, marginLeft: 2 }}>({count})</Text>
      )}
    </View>
  );
}
