import { StyleSheet, Text, View } from 'react-native';

const COLORS = {
  LOCKED: { bg: '#eeeeee', fg: '#888888' },
  NOT_STARTED: { bg: '#eef2f7', fg: '#3b5f8a' },
  IN_PROGRESS: { bg: '#fff4e0', fg: '#b7791f' },
  SUBMITTED: { bg: '#e6f0ff', fg: '#1d4ed8' },
  APPROVED: { bg: '#e4f6ec', fg: '#084d38' },
  REJECTED: { bg: '#fde8e7', fg: '#b3261e' },
};

export default function StatusBadge({ status }) {
  const c = COLORS[status] || COLORS.LOCKED;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{status.replace('_', ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});
