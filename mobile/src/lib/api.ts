import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-replit-app.replit.app';

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const token = await AsyncStorage.getItem('authToken');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

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
