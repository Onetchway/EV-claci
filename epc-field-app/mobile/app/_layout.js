import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/lib/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0b6e4f' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '600' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="camera" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
