import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../../src/lib/api';

function groupByClient(projects) {
  const map = new Map();
  for (const p of projects) {
    const key = p.client?.name || 'Unknown Client';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export default function ProjectsListScreen() {
  const router = useRouter();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const data = await apiFetch('/projects');
      setSections(groupByClient(data.projects));
    } catch (err) {
      setError(err.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0b6e4f" />
      </View>
    );
  }

  return (
    <SectionList
      style={styles.list}
      sections={sections}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
      ListEmptyComponent={
        <View style={styles.center}>
          {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.muted}>No projects assigned to you yet.</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => router.push(`/(app)/projects/${item.id}`)}>
          <Text style={styles.siteName}>{item.siteName}</Text>
          <Text style={styles.address}>{item.address}</Text>
          <Text style={styles.progress}>
            {item.stageProgress.approved}/{item.stageProgress.total} stages approved
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f5f7f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  sectionHeader: {
    backgroundColor: '#eef7f2',
    color: '#0b6e4f',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e6e4',
  },
  siteName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  address: { fontSize: 12.5, color: '#666', marginTop: 2 },
  progress: { fontSize: 12, color: '#0b6e4f', marginTop: 8, fontWeight: '600' },
  muted: { color: '#888', fontSize: 13 },
  error: { color: '#b3261e', fontSize: 13 },
});
