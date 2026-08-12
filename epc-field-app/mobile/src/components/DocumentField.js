import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { API_BASE_URL, getToken, uploadFormData } from '../lib/api';

/** Real file upload for a type:'file' FormFieldDef — replaces the old "confirm attached" checkbox. */
export default function DocumentField({ field, document, submissionId, editable, onChanged }) {
  const [busy, setBusy] = useState(false);

  async function pickAndUpload() {
    if (busy) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      setBusy(true);
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType || 'application/octet-stream' });
      formData.append('fieldKey', field.key);

      await uploadFormData(`/submissions/${submissionId}/documents`, formData);
      onChanged();
    } catch (err) {
      Alert.alert('Document upload failed', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/submissions/${submissionId}/documents/${field.key}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Remove failed');
      onChanged();
    } catch (err) {
      Alert.alert('Could not remove document', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
      {document ? (
        <View style={styles.attachedRow}>
          <Text style={styles.fileName} numberOfLines={1}>📄 {document.fileName}</Text>
          {editable && (
            <TouchableOpacity onPress={remove} disabled={busy}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : editable ? (
        <TouchableOpacity style={styles.uploadBtn} onPress={pickAndUpload} disabled={busy}>
          {busy ? <ActivityIndicator size="small" color="#0b6e4f" /> : <Text style={styles.uploadBtnText}>+ Upload document</Text>}
        </TouchableOpacity>
      ) : (
        <Text style={styles.missingText}>Not uploaded</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  attachedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#eef7f2', borderRadius: 8, padding: 10 },
  fileName: { fontSize: 13, color: '#0b6e4f', flex: 1, marginRight: 10 },
  removeText: { fontSize: 12.5, color: '#b3261e', fontWeight: '600' },
  uploadBtn: { borderWidth: 1, borderColor: '#0b6e4f', borderStyle: 'dashed', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  uploadBtnText: { color: '#0b6e4f', fontWeight: '600', fontSize: 13 },
  missingText: { fontSize: 12.5, color: '#888' },
});
