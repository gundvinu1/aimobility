const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface RequestConfig {
  headers?: Record<string, string>;
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
  config?: RequestConfig,
): Promise<{ data: T }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config?.headers || {}),
  };

  if (!headers['Authorization'] && typeof window !== 'undefined') {
    const token =
      sessionStorage.getItem('aimos_access_token') ||
      localStorage.getItem('aimos_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return { data: undefined as unknown as T };
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json as { error?: { message: string }; message?: string };
    throw new Error(err.error?.message ?? err.message ?? `Request failed: ${res.status}`);
  }

  const wrapped = json as { success?: boolean; data?: T };
  if (wrapped.success !== undefined && wrapped.data !== undefined) {
    return { data: wrapped.data };
  }

  return { data: json as T };
}

export const apiClient = {
  get<T>(path: string, config?: RequestConfig): Promise<{ data: T }> {
    return request<T>('GET', path, undefined, config);
  },
  post<T>(path: string, body?: any, config?: RequestConfig): Promise<{ data: T }> {
    return request<T>('POST', path, body, config);
  },
  patch<T>(path: string, body?: any, config?: RequestConfig): Promise<{ data: T }> {
    return request<T>('PATCH', path, body, config);
  },
  delete<T>(path: string, config?: RequestConfig): Promise<{ data: T }> {
    return request<T>('DELETE', path, undefined, config);
  },
};
