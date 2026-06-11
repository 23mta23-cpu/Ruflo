import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="nachbarschaft" options={{ presentation: 'card' }} />
        <Stack.Screen name="profil" options={{ presentation: 'card' }} />
        <Stack.Screen name="chat" options={{ presentation: 'card' }} />
        <Stack.Screen name="vertrag" options={{ presentation: 'card' }} />
        <Stack.Screen name="reklamation" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
