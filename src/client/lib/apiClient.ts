import {
  getFallbackBootstrap,
  getFallbackHandovers,
  getFallbackSession,
  getFallbackUser,
  saveFallbackHandover,
  FALLBACK_PRODUCTS,
} from './clientFallbackStore';

export const AUTH_TOKEN_STORAGE_KEY = 'GCCK_SESSION_TOKEN';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage quota/privacy errors
  }
}

function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/api/')) {
    return path;
  }
  if (path.startsWith('/')) {
    return `/api/v1${path}`;
  }
  return `/api/v1/${path}`;
}

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
  json?: unknown;
}

export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { timeoutMs = 15000, json, headers, ...rest } = options;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  const reqHeaders = new Headers(headers || undefined);
  const storedToken = getStoredAuthToken();
  if (storedToken && !reqHeaders.has('Authorization')) {
    reqHeaders.set('Authorization', `Bearer ${storedToken}`);
  }

  let body = rest.body;
  if (json !== undefined) {
    reqHeaders.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  } else if (body && typeof body === 'string' && !reqHeaders.has('Content-Type')) {
    reqHeaders.set('Content-Type', 'application/json');
  }

  try {
    const resp = await fetch(resolveApiUrl(path), {
      ...rest,
      headers: reqHeaders,
      body,
      credentials: 'include',
      signal: ctrl.signal,
    });

    const contentType = resp.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await resp.json()
      : await resp.text();

    if (!resp.ok) {
      if (resp.status === 404) {
        const fallback = handleClientFallback<T>(path, options);
        if (fallback !== null) return fallback;
      }

      const msg =
        (payload && typeof payload === 'object' && 'error' in payload && String((payload as any).error)) ||
        `Lỗi kết nối máy chủ (HTTP ${resp.status})`;
      throw new ApiError(msg, resp.status, payload);
    }

    return payload as T;
  } catch (err: any) {
    const fallback = handleClientFallback<T>(path, options);
    if (fallback !== null) return fallback;

    if (err instanceof ApiError) throw err;
    if (err?.name === 'AbortError') {
      throw new ApiError('Quá thời gian phản hồi từ máy chủ (Timeout).', 0);
    }
    throw new ApiError(
      err?.message || 'Mất kết nối mạng xưởng Wi-Fi.',
      0
    );
  } finally {
    clearTimeout(timer);
  }
}

function handleClientFallback<T>(path: string, options: ApiFetchOptions): T | null {
  const norm = path.toLowerCase();

  if (norm.includes('/auth/session')) {
    return getFallbackSession() as unknown as T;
  }
  if (norm.includes('/auth/quick-switch')) {
    const body = options.json as any;
    const workerId = body?.workerId || 'NV_KT02';
    const user = getFallbackUser(workerId);
    return {
      token: `client-demo-token-${workerId}`,
      user,
      authMode: 'DEMO_QUICK',
    } as unknown as T;
  }
  if (norm.includes('/auth/login')) {
    const body = options.json as any;
    const workerId = body?.workerId || 'NV00053';
    const user = getFallbackUser(workerId);
    return {
      token: `client-demo-token-${workerId}`,
      user,
      authMode: 'DEMO_QUICK',
    } as unknown as T;
  }
  if (norm.includes('/bootstrap')) {
    return getFallbackBootstrap() as unknown as T;
  }
  if (norm.includes('/schedules/daily')) {
    return [] as unknown as T;
  }
  if (norm.includes('/costing')) {
    return FALLBACK_PRODUCTS as unknown as T;
  }
  if (norm.includes('/qc/inspections')) {
    return [] as unknown as T;
  }
  if (norm.includes('/handovers')) {
    if (options.method === 'POST') {
      const body = options.json as any;
      if (body) saveFallbackHandover(body);
      return { success: true, item: body } as unknown as T;
    }
    return getFallbackHandovers() as unknown as T;
  }

  return null;
}

export const apiClient = {
  get: <T = any>(path: string, opts?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...opts, method: 'GET' }),
  post: <T = any>(path: string, json?: unknown, opts?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...opts, method: 'POST', json }),
  put: <T = any>(path: string, json?: unknown, opts?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...opts, method: 'PUT', json }),
  patch: <T = any>(path: string, json?: unknown, opts?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...opts, method: 'PATCH', json }),
  delete: <T = any>(path: string, opts?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...opts, method: 'DELETE' }),
};
