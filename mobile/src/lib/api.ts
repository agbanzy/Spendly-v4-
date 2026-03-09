import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIdToken } from './cognito';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://app.thefinanciar.com';
const ACTIVE_COMPANY_KEY = 'financiar_active_company_id';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// Refresh the Cognito ID token via getSession() (auto-refreshes if expired)
async function refreshAuthToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const newToken = await getIdToken();
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
  let [token, activeCompanyId] = await Promise.all([
    AsyncStorage.getItem('authToken'),
    AsyncStorage.getItem(ACTIVE_COMPANY_KEY),
  ]);

  // If no token in AsyncStorage, try refreshing from Cognito session
  if (!token) {
    token = await refreshAuthToken();
  }

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
  if (response.status === 401) {
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
