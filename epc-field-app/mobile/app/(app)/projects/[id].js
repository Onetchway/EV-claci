import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../../src/lib/api';
import StatusBadge from '../../../src/components/StatusBadge';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      apiFetch(`/projects/${id}`)
        .then((data) => active && setProject(data.project))
        .catch((err) => active && setError(err.message))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [id])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0b6e4f" />
      </View>
    );
  }
  if (error || !project) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || 'Project not found'}</Text>
      </View>
    );
  }

  const stages = [...project.stages].sort((a, b) => a.stageTemplate.order - b.stageTemplate.order);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.siteName}>{project.siteName}</Text>
        <Text style={styles.address}>{project.client?.name} — {project.address}</Text>
      </View>
      <FlatList
        data={stages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const locked = item.status === 'LOCKED';
          return (
            <TouchableOpacity
              disabled={locked}
              style={[styles.row, locked && styles.rowLocked]}
              onPress={() => router.push(`/(app)/stage/${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.stageOrder}>Stage {item.stageTemplate.order}</Text>
                <Text style={[styles.stageName, locked && styles.mutedText]}>{item.stageTemplate.name}</Text>
              </View>
              <StatusBadge status={item.status} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  header: { backgroundColor: 'white', padding: 16, borderBottomWidth: 1, borderColor: '#e2e6e4' },
  siteName: { fontSize: 17, fontWeight: '700' },
  address: { fontSize: 12.5, color: '#666', marginTop: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e6e4',
  },
  rowLocked: { opacity: 0.55 },
  stageOrder: { fontSize: 10.5, color: '#999', fontWeight: '700', textTransform: 'uppercase' },
  stageName: { fontSize: 14.5, fontWeight: '600', marginTop: 2 },
  mutedText: { color: '#999' },
  error: { color: '#b3261e' },
});
