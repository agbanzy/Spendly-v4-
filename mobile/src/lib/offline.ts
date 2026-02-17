import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NetworkStatus = {
  isConnected: boolean;
  type: string;
};

// Subscribe to network state changes
export function subscribeToNetworkChanges(callback: (status: NetworkStatus) => void) {
  return NetInfo.addEventListener((state: NetInfoState) => {
    callback({
      isConnected: state.isConnected ?? false,
      type: state.type,
    });
  });
}

// Check current connection status
export async function checkConnection(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
}

// Offline mutation queue
const OFFLINE_QUEUE_KEY = 'offline_mutation_queue';

interface QueuedMutation {
  id: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  body?: Record<string, unknown>;
  timestamp: number;
}

export async function queueOfflineMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): Promise<void> {
  const queue = await getOfflineQueue();
  queue.push({
    ...mutation,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  });
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function getOfflineQueue(): Promise<QueuedMutation[]> {
  const stored = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getOfflineQueue();
  const filtered = queue.filter((item) => item.id !== id);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
}
