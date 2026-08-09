import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0b6e4f" />
      </View>
    );
  }

  return <Redirect href={user ? '/(app)/projects' : '/login'} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7f6' },
});
