import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/lib/AuthContext';

function HeaderRight() {
  const { logout } = useAuth();
  return (
    <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
      <Text style={styles.logoutText}>Log out</Text>
    </TouchableOpacity>
  );
}

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0b6e4f" />
      </View>
    );
  }
  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0b6e4f' },
        headerTintColor: '#fff',
        headerRight: () => <HeaderRight />,
      }}
    >
      <Stack.Screen name="projects/index" options={{ title: 'My Projects' }} />
      <Stack.Screen name="projects/[id]" options={{ title: 'Project' }} />
      <Stack.Screen name="stage/[id]" options={{ title: 'Stage Report' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7f6' },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 6, marginRight: 8 },
  logoutText: { color: 'white', fontSize: 12, fontWeight: '600' },
});
