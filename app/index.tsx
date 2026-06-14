import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../constants/colors';

export default function Index() {
  const { user, role, loading } = useAuth();

  if (loading) {
    // Blank screen — root layout's skeleton covers this during font/consent loading
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  if (user) {
    return <Redirect href={role === 'provider' ? '/(provider)/' : '/(tabs)/'} />;
  }

  return <Redirect href="/landing" />;
}
