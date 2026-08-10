import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/AuthContext';

export default function LoginScreen() {
  const { user, loading: authLoading, login } = useAuth();
  const [email, setEmail] = useState('engineer@nakjm.example');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && user) {
    return <Redirect href="/(app)/projects" />;
  }

  async function onSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>NaKJM Infra</Text>
        <Text style={styles.subtitle}>Field engineer sign in</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7f6', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 360, backgroundColor: 'white', borderRadius: 14, padding: 24, elevation: 2 },
  title: { fontSize: 20, fontWeight: '700', color: '#084d38', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 18 },
  label: { fontSize: 12, color: '#666', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#dde2df',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    marginTop: 22,
    backgroundColor: '#0b6e4f',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 15 },
  error: { backgroundColor: '#fde8e7', color: '#b3261e', padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 13 },
});
