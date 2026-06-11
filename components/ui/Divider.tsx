import React from 'react';
import { View } from 'react-native';
import { C } from '../../constants/colors';

export function Divider({ margin = 16 }: { margin?: number }) {
  return <View style={{ height: 1, backgroundColor: C.border, marginVertical: margin }} />;
}
