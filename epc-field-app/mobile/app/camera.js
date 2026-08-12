import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { uploadFormData } from '../src/lib/api';

export default function CameraScreen() {
  const { submissionId, slotKey, slotLabel } = useLocalSearchParams();
  const router = useRouter();
  const [cameraRef, setCameraRef] = useState(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const [uploading, setUploading] = useState(false);
  const [statusText, setStatusText] = useState('');

  if (!cameraPermission || !locationPermission) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted || !locationPermission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Camera and location access are required to capture geotagged site photos.
        </Text>
        {!cameraPermission.granted && (
          <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
            <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        )}
        {!locationPermission.granted && (
          <TouchableOpacity style={styles.permissionBtn} onPress={requestLocationPermission}>
            <Text style={styles.permissionBtnText}>Grant Location Access</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  async function capture() {
    if (!cameraRef || uploading) return;
    setUploading(true);
    try {
      setStatusText('Capturing photo…');
      const photo = await cameraRef.takePictureAsync({ quality: 0.7, skipProcessing: true });

      setStatusText('Reading GPS location…');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      setStatusText('Uploading…');
      const formData = new FormData();
      formData.append('file', { uri: photo.uri, name: `${slotKey}.jpg`, type: 'image/jpeg' });
      formData.append('photoSlotKey', String(slotKey));
      formData.append('lat', String(position.coords.latitude));
      formData.append('lng', String(position.coords.longitude));
      formData.append('accuracyM', String(position.coords.accuracy ?? ''));
      formData.append('capturedAt', new Date().toISOString());

      await uploadFormData(`/submissions/${submissionId}/photos`, formData);

      router.back();
    } catch (err) {
      Alert.alert('Photo upload failed', err.message);
    } finally {
      setUploading(false);
      setStatusText('');
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={setCameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <Text style={styles.slotLabel}>{slotLabel}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomBar}>
          {uploading ? (
            <View style={styles.uploadingBox}>
              <ActivityIndicator color="white" />
              <Text style={styles.uploadingText}>{statusText}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.captureBtn} onPress={capture}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  slotLabel: { color: 'white', fontSize: 15, fontWeight: '700', flex: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: 'white', fontSize: 16 },
  bottomBar: { alignItems: 'center', paddingBottom: 40, backgroundColor: 'rgba(0,0,0,0.35)', paddingTop: 20 },
  captureBtn: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  captureBtnInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'white' },
  uploadingBox: { alignItems: 'center', gap: 8 },
  uploadingText: { color: 'white', fontSize: 13 },
  permissionContainer: { flex: 1, backgroundColor: '#0b6e4f', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  permissionText: { color: 'white', fontSize: 15, textAlign: 'center', marginBottom: 10 },
  permissionBtn: { backgroundColor: 'white', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, width: '100%', alignItems: 'center' },
  permissionBtnText: { color: '#0b6e4f', fontWeight: '700' },
  cancelBtn: { marginTop: 10 },
  cancelBtnText: { color: 'white', textDecorationLine: 'underline' },
});
