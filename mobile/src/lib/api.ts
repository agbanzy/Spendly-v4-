import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://spendlymanager.com';
const ACTIVE_COMPANY_KEY = 'spendly_active_company_id';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// Refresh the Firebase ID token and store it
async function refreshAuthToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const user = auth.currentUser;
      if (!user) return null;
      const newToken = await user.getIdToken(true); // Force refresh
      await AsyncStorage.setItem('authToken', newToken);
      return newToken;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// Event listeners for auth state changes (401 redirect)
type AuthExpiredCallback = () => void;
let onAuthExpired: AuthExpiredCallback | null = null;

export function setOnAuthExpired(callback: AuthExpiredCallback) {
  onAuthExpired = callback;
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const [token, activeCompanyId] = await Promise.all([
    AsyncStorage.getItem('authToken'),
    AsyncStorage.getItem(ACTIVE_COMPANY_KEY),
  ]);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Multi-business isolation: send active company ID on every request
  if (activeCompanyId) {
    headers['X-Company-Id'] = activeCompanyId;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // If 401, try refreshing the token once and retry
  if (response.status === 401 && token) {
    const newToken = await refreshAuthToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    // If still 401 after refresh, token is truly expired — force logout
    if (response.status === 401) {
      await AsyncStorage.removeItem('authToken');
      if (onAuthExpired) {
        onAuthExpired();
      }
      throw new Error('Session expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>('GET', endpoint),
  post: <T>(endpoint: string, body: Record<string, unknown>) => apiRequest<T>('POST', endpoint, body),
  put: <T>(endpoint: string, body: Record<string, unknown>) => apiRequest<T>('PUT', endpoint, body),
  patch: <T>(endpoint: string, body: Record<string, unknown>) => apiRequest<T>('PATCH', endpoint, body),
  delete: <T>(endpoint: string) => apiRequest<T>('DELETE', endpoint),
};
