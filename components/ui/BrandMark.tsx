// Markensymbol „Das Treffen" — zwei Häuser, deren Schnittmenge ein drittes
// kleines Haus bildet (Nachbarschaft + Zuhause + fair geregelter Raum).
// Quelle/Entscheidung: notes/04-Entscheidungen/Marke-Logo-Siegel-System.md,
// SVG-Master: docs/brand/das-treffen-logo.svg. Auf dunklem Grund (HERO)
// variant="dark", auf hellen Flächen variant="light".

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { C, HERO } from '../../constants/colors';

export function BrandMark({
  size = 24,
  variant = 'light',
}: {
  size?: number;
  variant?: 'light' | 'dark';
}) {
  const stroke = variant === 'dark' ? '#F6F4EF' : C.primary;
  const mint = HERO.mint;
  // Symbol-BBox im Master: x 6–52, y 14–52 → viewBox mit Randpuffer für Strichbreite
  return (
    <Svg width={size} height={size * (44 / 52)} viewBox="3 11 52 44">
      <Path d="M22 26 L29 20.4 L36 26 L36 52 L22 52 Z" fill={mint} />
      <Path
        d="M6 52 V26 L21 14 L36 26 V52 Z"
        fill="none" stroke={stroke} strokeWidth={4.5} strokeLinejoin="miter"
      />
      <Path
        d="M22 52 V26 L37 14 L52 26 V52 Z"
        fill="none" stroke={stroke} strokeWidth={4.5} strokeLinejoin="miter"
      />
    </Svg>
  );
}
