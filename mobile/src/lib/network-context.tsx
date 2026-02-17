import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import { subscribeToNetworkChanges, checkConnection, getOfflineQueue, clearOfflineQueue, removeFromQueue } from './offline';
import { api } from './api';

const MAX_QUEUE_RETRIES = 3;

interface NetworkContextType {
  isConnected: boolean;
  pendingMutations: number;
  failedMutations: number;
}

const NetworkContext = createContext<NetworkContextType>({ isConnected: true, pendingMutations: 0, failedMutations: 0 });

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [pendingMutations, setPendingMutations] = useState(0);
  const [failedMutations, setFailedMutations] = useState(0);

  useEffect(() => {
    checkConnection().then(setIsConnected);

    const unsubscribe = subscribeToNetworkChanges(async (status) => {
      setIsConnected(status.isConnected);

      // Process offline queue when connection is restored
      if (status.isConnected) {
        const queue = await getOfflineQueue();
        if (queue.length === 0) return;

        setPendingMutations(queue.length);
        let processed = 0;
        let failed = 0;

        for (const mutation of queue) {
          let success = false;

          for (let attempt = 1; attempt <= MAX_QUEUE_RETRIES; attempt++) {
            try {
              if (mutation.method === 'POST' && mutation.body) {
                await api.post(mutation.endpoint, mutation.body);
              } else if (mutation.method === 'PATCH' && mutation.body) {
                await api.patch(mutation.endpoint, mutation.body);
              } else if (mutation.method === 'DELETE') {
                await api.delete(mutation.endpoint);
              }
              success = true;
              break;
            } catch (error) {
              if (attempt < MAX_QUEUE_RETRIES) {
                await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
              }
            }
          }

          if (success) {
            await removeFromQueue(mutation.id);
            processed++;
          } else {
            failed++;
            console.error(`Offline mutation permanently failed: ${mutation.method} ${mutation.endpoint}`);
          }

          setPendingMutations(queue.length - processed - failed);
        }

        // Clean up successfully processed items; leave failures in queue
        if (failed === 0) {
          await clearOfflineQueue();
        }

        setFailedMutations(failed);
        setPendingMutations(0);

        if (failed > 0) {
          Alert.alert(
            'Sync Issue',
            `${processed} action${processed !== 1 ? 's' : ''} synced successfully, but ${failed} failed. These will be retried automatically.`,
            [{ text: 'OK' }]
          );
        } else if (processed > 0) {
          // Silently succeed — no need to bother the user
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, pendingMutations, failedMutations }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
