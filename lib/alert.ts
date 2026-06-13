import { Platform, Alert } from 'react-native';

export type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type Listener = (title: string, message: string, buttons: AlertButton[]) => void;
const listeners: Listener[] = [];

export function showAlert(
  title: string,
  message = '',
  buttons: AlertButton[] = [{ text: 'OK' }],
) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  listeners.forEach((l) => l(title, message, buttons));
}

export function _subscribeAlert(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
}
