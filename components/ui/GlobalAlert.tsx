import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { _subscribeAlert, AlertButton } from '../../lib/alert';
import { C } from '../../constants/colors';

type State = { visible: boolean; title: string; message: string; buttons: AlertButton[] };

const INIT: State = { visible: false, title: '', message: '', buttons: [] };

export function GlobalAlert() {
  const [s, setS] = useState<State>(INIT);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return _subscribeAlert((title, message, buttons) =>
      setS({ visible: true, title, message, buttons }),
    );
  }, []);

  if (!s.visible) return null;

  function dismiss(onPress?: () => void) {
    setS(INIT);
    onPress?.();
  }

  return (
    <Modal transparent animationType="fade" visible={s.visible} onRequestClose={() => dismiss()}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{s.title}</Text>
          {s.message ? <Text style={styles.message}>{s.message}</Text> : null}
          <View style={[styles.btnRow, s.buttons.length > 2 && styles.btnColStack]}>
            {s.buttons.map((btn) => (
              <TouchableOpacity
                key={btn.text}
                style={[
                  styles.btn,
                  btn.style === 'cancel' && styles.btnCancel,
                  btn.style === 'destructive' && styles.btnDestructive,
                ]}
                onPress={() => dismiss(btn.onPress)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.btnLabel,
                    btn.style === 'cancel' && styles.labelCancel,
                    btn.style === 'destructive' && styles.labelDestructive,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box:            { backgroundColor: C.surface, borderRadius: 16, padding: 24, width: 320, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  title:          { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 8 },
  message:        { fontSize: 14, color: C.sub, lineHeight: 20, marginBottom: 20 },
  btnRow:         { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  btnColStack:    { flexDirection: 'column-reverse' },
  btn:            { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: C.ink, minWidth: 72, alignItems: 'center' },
  btnCancel:      { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  btnDestructive: { backgroundColor: C.red },
  btnLabel:       { fontSize: 14, fontWeight: '600', color: C.surface },
  labelCancel:    { color: C.ink },
  labelDestructive:{ color: C.surface },
});
