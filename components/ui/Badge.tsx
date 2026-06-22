import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../constants/colors';

type Variant = 'gold' | 'green' | 'amber' | 'red' | 'muted';

export function Badge({ label, variant = 'muted' }: { label: string; variant?: Variant }) {
  const s = styles[variant];
  return (
    <View style={[styles.base, s.bg]}>
      <Text style={[styles.text, s.text]}>{label}</Text>
    </View>
  );
}

const styles = {
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start' as const,
  },
  text: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  gold:  { bg: { backgroundColor: C.goldBg  }, text: { color: C.gold  } },
  green: { bg: { backgroundColor: C.primaryBg }, text: { color: C.primary } },
  amber: { bg: { backgroundColor: C.amberBg }, text: { color: C.amber } },
  red:   { bg: { backgroundColor: C.redBg   }, text: { color: C.red   } },
  muted: { bg: { backgroundColor: '#F0EFEB' }, text: { color: C.sub   } },
};
