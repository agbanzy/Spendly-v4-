import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore has a 2048 byte limit on values
// For larger values, fall back to a chunked approach

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    // SecureStore not available on web, fall back to localStorage
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
