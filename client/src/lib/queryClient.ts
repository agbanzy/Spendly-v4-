import { QueryClient, QueryFunction, MutationCache } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getIdToken } from "./cognito";
import { getCachedPin } from "./pin-cache";

// Active company ID — set by CompanyProvider, read by all API calls
let _activeCompanyId: string | null = null;

export function setActiveCompanyId(id: string | null) {
  _activeCompanyId = id;
}

export function getActiveCompanyId(): string | null {
  return _activeCompanyId;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest", // CSRF protection
  };
  try {
    const token = await getIdToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
  }
  // Include active company ID so server can scope queries
  const companyId = _activeCompanyId || localStorage.getItem("financiar-active-company");
  if (companyId) {
    headers["X-Company-Id"] = companyId;
  }
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Like apiRequest but injects the cached transaction PIN header.
 * Use this for all PIN-protected mutations (payments, approvals, etc.).
 */
export async function pinProtectedRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const pin = getCachedPin();
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };
  if (pin) {
    headers["x-transaction-pin"] = pin;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(queryKey.join("/") as string, {
        headers: authHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export function sanitizeErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  // Strip HTTP status codes and server internals
  const cleaned = msg.replace(/^\d{3}:\s*/, '').replace(/\{.*\}/, '').trim();
  // Don't expose stack traces, SQL errors, or connection details
  if (cleaned.includes('ECONNREFUSED') || cleaned.includes('stack') || cleaned.includes('SELECT') || cleaned.includes('INSERT')) {
    return 'An unexpected error occurred. Please try again.';
  }
  // Truncate long messages
  return cleaned.length > 200 ? cleaned.substring(0, 200) + '...' : cleaned || 'An unexpected error occurred';
}

/** Determine if a failed request is retryable (network/5xx only, not auth/client errors) */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    // Network failures
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED')) return true;
    // 5xx server errors are transient
    const status = parseInt(msg);
    if (status >= 500 && status < 600) return true;
  }
  return false;
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError(error) {
      toast({
        title: "Error",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    },
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      retry(failureCount, error) {
        // Only retry transient errors, max 2 attempts
        if (failureCount >= 2) return false;
        return isRetryableError(error);
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      retry: false,
    },
  },
});
