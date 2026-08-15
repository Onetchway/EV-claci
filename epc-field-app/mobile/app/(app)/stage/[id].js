import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../../../src/lib/api';
import StatusBadge from '../../../src/components/StatusBadge';
import FieldInput from '../../../src/components/FieldInput';
import DocumentField from '../../../src/components/DocumentField';

function groupFields(fieldDefs) {
  const groups = [];
  const byLabel = new Map();
  for (const field of [...fieldDefs].sort((a, b) => a.order - b.order)) {
    const key = field.groupLabel || '';
    if (!byLabel.has(key)) {
      const group = { label: field.groupLabel || null, fields: [] };
      byLabel.set(key, group);
      groups.push(group);
    }
    byLabel.get(key).fields.push(field);
  }
  return groups;
}

export default function StageDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [stage, setStage] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState(null);
  const loadedSubmissionId = useRef(null);

  async function load() {
    setError('');
    try {
      const data = await apiFetch(`/project-stages/${id}`);
      setStage(data.stage);
      setSubmission(data.latestSubmission);
      if (data.latestSubmission && data.latestSubmission.id !== loadedSubmissionId.current) {
        setFormData(data.latestSubmission.dataJson || {});
        loadedSubmissionId.current = data.latestSubmission.id;
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [id])
  );

  async function startStage() {
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/project-stages/${id}/submissions`, { method: 'POST' });
      loadedSubmissionId.current = null;
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function persistDraft() {
    if (!submission) return;
    await apiFetch(`/submissions/${submission.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dataJson: formData }),
    });
  }

  async function saveDraft() {
    if (!submission) return;
    setBusy(true);
    setError('');
    try {
      await persistDraft();
      Alert.alert('Saved', 'Draft saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitStage() {
    if (!submission) return;
    setBusy(true);
    setValidationErrors(null);
    setError('');
    try {
      await persistDraft();
      const result = await apiFetch(`/submissions/${submission.id}/submit`, { method: 'POST' });
      await load();
      Alert.alert('Submitted', result.pdfUrl ? 'Report submitted and PDF generated.' : 'Report submitted.');
    } catch (err) {
      if (err.details?.missingFields || err.details?.missingPhotos) {
        setValidationErrors(err.details);
      } else {
        setError(err.message);
        // Stage status may have changed server-side (e.g. an admin action); refresh so the
        // badge and editable state don't keep showing what the screen loaded with.
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0b6e4f" />
      </View>
    );
  }
  if (error && !stage) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!stage) return null;

  const editable = stage.status === 'IN_PROGRESS';
  const photoSlots = [...stage.stageTemplate.photoSlots].sort((a, b) => a.order - b.order);
  const photosBySlotId = new Map((submission?.photos || []).map((p) => [p.photoSlotId, p]));
  const documentsByFieldKey = new Map((submission?.documents || []).map((d) => [d.fieldKey, d]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
      <View style={styles.headerRow}>
        <Text style={styles.stageTitle}>{stage.stageTemplate.name}</Text>
        <StatusBadge status={stage.status} />
      </View>

      {stage.status === 'REJECTED' && (
        <View style={styles.rejectBox}>
          <Text style={styles.rejectTitle}>Rejected</Text>
          <Text style={styles.rejectReason}>{stage.rejectionReason}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={startStage} disabled={busy}>
            <Text style={styles.primaryBtnText}>Start New Submission</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage.status === 'NOT_STARTED' && (
        <TouchableOpacity style={styles.primaryBtn} onPress={startStage} disabled={busy}>
          {busy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Start This Stage</Text>}
        </TouchableOpacity>
      )}

      {submission && (
        <>
          {validationErrors && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxTitle}>Cannot submit — missing required items:</Text>
              {validationErrors.missingFields?.map((f) => <Text key={f} style={styles.errorItem}>• {f}</Text>)}
              {validationErrors.missingPhotos?.map((f) => <Text key={f} style={styles.errorItem}>• Photo: {f}</Text>)}
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {groupFields(stage.stageTemplate.fieldDefs).map((group, gi) => (
            <View key={gi} style={styles.group}>
              {group.label && <Text style={styles.groupLabel}>{group.label}</Text>}
              {group.fields.map((field) =>
                field.type === 'file' ? (
                  <DocumentField
                    key={field.key}
                    field={field}
                    document={documentsByFieldKey.get(field.key)}
                    submissionId={submission.id}
                    editable={editable}
                    onChanged={load}
                  />
                ) : (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={formData[field.key]}
                    onChange={
                      editable
                        ? (val) => setFormData((prev) => ({ ...prev, [field.key]: val }))
                        : () => {}
                    }
                  />
                )
              )}
            </View>
          ))}

          {photoSlots.length > 0 && (
            <View style={styles.group}>
              <Text style={styles.groupLabel}>Geotagged Photos</Text>
              <View style={styles.photoGrid}>
                {photoSlots.map((slot) => {
                  const photo = photosBySlotId.get(slot.id);
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={styles.photoCell}
                      disabled={!editable}
                      onPress={() =>
                        router.push({
                          pathname: '/camera',
                          params: { submissionId: submission.id, slotKey: slot.key, slotLabel: slot.label },
                        })
                      }
                    >
                      {photo ? (
                        <Image source={{ uri: photo.stampedUrl || photo.originalUrl }} style={styles.photoThumb} />
                      ) : (
                        <View style={[styles.photoThumb, styles.photoMissing]}>
                          <Text style={styles.photoMissingText}>{editable ? '+ Add Photo' : 'Not submitted'}</Text>
                        </View>
                      )}
                      <Text style={styles.photoLabel} numberOfLines={2}>{slot.label}{slot.required ? ' *' : ''}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {editable && (
            <View style={{ gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={saveDraft} disabled={busy}>
                <Text style={styles.secondaryBtnText}>Save Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={submitStage} disabled={busy}>
                {busy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>Submit Stage Report</Text>}
              </TouchableOpacity>
            </View>
          )}

          {submission.pdfUrl && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => Linking.openURL(submission.pdfUrl)}>
              <Text style={styles.secondaryBtnText}>Download PDF Report</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  stageTitle: { fontSize: 18, fontWeight: '700', flex: 1, marginRight: 10 },
  group: { backgroundColor: 'white', borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e6e4' },
  groupLabel: { fontSize: 12.5, fontWeight: '700', color: '#0b6e4f', backgroundColor: '#eef7f2', padding: 8, marginBottom: 10, borderRadius: 6 },
  primaryBtn: { backgroundColor: '#0b6e4f', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 14.5 },
  secondaryBtn: { backgroundColor: 'white', borderWidth: 1, borderColor: '#0b6e4f', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  secondaryBtnText: { color: '#0b6e4f', fontWeight: '700', fontSize: 14 },
  error: { color: '#b3261e', marginBottom: 10 },
  errorBox: { backgroundColor: '#fde8e7', borderRadius: 8, padding: 12, marginBottom: 12 },
  errorBoxTitle: { color: '#b3261e', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  errorItem: { color: '#b3261e', fontSize: 12.5 },
  rejectBox: { backgroundColor: '#fde8e7', borderRadius: 10, padding: 14, marginBottom: 14 },
  rejectTitle: { color: '#b3261e', fontWeight: '700', marginBottom: 4 },
  rejectReason: { color: '#7a3330', marginBottom: 12 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCell: { width: '31%' },
  photoThumb: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#eee' },
  photoMissing: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#dde2df', borderStyle: 'dashed' },
  photoMissingText: { fontSize: 10.5, color: '#888', textAlign: 'center', paddingHorizontal: 4 },
  photoLabel: { fontSize: 10.5, marginTop: 4, fontWeight: '600', color: '#333' },
});
