import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const MAX_TOKEN_SYNC_RETRIES = 3;
const TOKEN_SYNC_KEY = 'push_token_synced';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });
  }

  // Get project ID from Expo config (set in app.json/app.config.js)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  if (!projectId) {
    console.error('Missing EAS project ID for push notifications. Set EXPO_PUBLIC_EAS_PROJECT_ID or configure eas.projectId in app.json.');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return tokenData.data;
}

export async function savePushToken(token: string): Promise<void> {
  await AsyncStorage.setItem('pushToken', token);

  let retries = 0;
  while (retries < MAX_TOKEN_SYNC_RETRIES) {
    try {
      await api.post('/api/user-profile/push-token', { token, platform: Platform.OS });
      await AsyncStorage.setItem(TOKEN_SYNC_KEY, 'true');
      return;
    } catch (error) {
      retries++;
      if (retries < MAX_TOKEN_SYNC_RETRIES) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries - 1)));
      }
    }
  }
  // Mark as unsynced so we retry on next app launch
  await AsyncStorage.setItem(TOKEN_SYNC_KEY, 'false');
  console.warn('Failed to sync push token to server after retries. Will retry on next launch.');
}

export async function retrySyncPushTokenIfNeeded(): Promise<void> {
  const synced = await AsyncStorage.getItem(TOKEN_SYNC_KEY);
  if (synced === 'false') {
    const token = await AsyncStorage.getItem('pushToken');
    if (token) {
      await savePushToken(token);
    }
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem('pushToken');
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function scheduleLocalNotification(title: string, body: string, data?: Record<string, unknown>) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}

export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count);
}

export async function isNotificationsEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem('notifications_enabled');
  return value !== 'false'; // Enabled by default
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem('notifications_enabled', enabled ? 'true' : 'false');
}
