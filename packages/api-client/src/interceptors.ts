// =============================================================================
// Axios Interceptors
// =============================================================================

import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * Attach a request ID header to every request
 */
export function attachRequestIdInterceptor(http: AxiosInstance): void {
  http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    config.headers['X-Request-ID'] = requestId;
    return config;
  });
}

/**
 * Log response errors in development
 */
export function attachErrorLoggingInterceptor(http: AxiosInstance): void {
  http.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('[ApiClient]', error.config?.method?.toUpperCase(), error.config?.url, error.response?.status, error.message);
      }
      return Promise.reject(error);
    },
  );
}
