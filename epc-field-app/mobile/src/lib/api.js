import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4100/api';
const TOKEN_KEY = 'epc_field_app_token';
const USER_KEY = 'epc_field_app_user';

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setSession(token, user) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser() {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = await getToken();
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.details = data;
    throw err;
  }
  return data;
}

// Multipart uploads must NOT go through global `fetch`: Expo SDK 57 replaces it with
// `expo/fetch`, whose FormData-to-multipart converter only accepts a string, a Blob, or an
// object with a `.bytes()` method — it throws "Unsupported FormDataPart implementation" for
// the classic React Native `{uri, name, type}` file part. `EXPO_PUBLIC_USE_RN_FETCH=1` looks
// like the documented escape hatch, but it can't take effect in EAS production/preview builds
// (Metro doesn't inline EXPO_PUBLIC_* env vars inside node_modules, and only does the
// runtime process.env fallback in dev mode). XMLHttpRequest is untouched by expo/fetch and
// natively understands the `{uri, name, type}` shape, so use it directly for file uploads.
export async function uploadFormData(path, formData) {
  const token = await getToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response body
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        const err = new Error(data.error || `Request failed: ${xhr.status}`);
        err.details = data;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.send(formData);
  });
}

export { API_BASE_URL };
