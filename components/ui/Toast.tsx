/**
 * WERKR Toast — Sonner-style in-app notifications.
 * Philosophy: butterweich, unaufdringlich, kontextbewusst.
 * Zero extra dependencies — built on React Native Animated API.
 *
 * Usage:
 *   1. Wrap your root with <ToastProvider>
 *   2. Call toast.success("Gespeichert") / toast.error("Fehler") / toast.info(...)
 *      from anywhere via the exported `toast` singleton.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../constants/colors';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastEntry {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastAPI {
  success: (msg: string) => void;
  error:   (msg: string) => void;
  warning: (msg: string) => void;
  info:    (msg: string) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<(entry: ToastEntry) => void>(() => {});

// Singleton API — importable from any module without prop drilling
let _push: ((entry: ToastEntry) => void) | null = null;

export const toast: ToastAPI = {
  success: (msg) => _push?.({ id: uid(), message: msg, variant: 'success' }),
  error:   (msg) => _push?.({ id: uid(), message: msg, variant: 'error'   }),
  warning: (msg) => _push?.({ id: uid(), message: msg, variant: 'warning' }),
  info:    (msg) => _push?.({ id: uid(), message: msg, variant: 'info'    }),
};

function uid() { return Math.random().toString(36).slice(2); }

// ── Individual toast pill ─────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<ToastVariant, { icon: keyof typeof Ionicons['glyphMap']; color: string; bg: string }> = {
  success: { icon: 'checkmark-circle',        color: C.green, bg: C.surface },
  error:   { icon: 'alert-circle',            color: C.red,   bg: C.surface },
  warning: { icon: 'warning',                 color: C.amber, bg: C.surface },
  info:    { icon: 'information-circle',      color: C.ink,   bg: C.surface },
};

function ToastPill({ entry, onDone }: { entry: ToastEntry; onDone: (id: string) => void }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const { icon, color, bg } = VARIANT_CONFIG[entry.variant];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }),
      Animated.timing(opacity,    { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start(() => onDone(entry.id));
    }, 3400);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[s.pill, { backgroundColor: bg, transform: [{ translateY }], opacity }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[s.pillText, { color: C.ink }]} numberOfLines={2}>{entry.message}</Text>
      <View style={[s.accent, { backgroundColor: color }]} />
    </Animated.View>
  );
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  const push = useCallback((entry: ToastEntry) => {
    setEntries((prev) => [...prev.slice(-2), entry]); // max 3 visible
  }, []);

  // Wire singleton
  useEffect(() => { _push = push; return () => { _push = null; }; }, [push]);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <View style={s.container} pointerEvents="none">
        {entries.map((e) => (
          <ToastPill key={e.id} entry={e} onDone={remove} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
    pointerEvents: 'none' as any,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: C.border,
    // bento-grid shadow
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  pillText: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 19 },
  accent:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },
});
