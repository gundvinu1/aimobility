// =============================================================================
// Base API Client
// =============================================================================

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import type { ApiResponse, ApiErrorResponse } from '@ai-mos/types';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class ApiClient {
  protected readonly http: AxiosInstance;

  constructor(config: ApiClientConfig) {
    this.http = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config.headers,
      },
    });
  }

  protected async get<T>(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.http.get(path, config);
    return response.data;
  }

  protected async post<T>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.http.post(path, data, config);
    return response.data;
  }

  protected async put<T>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.http.put(path, data, config);
    return response.data;
  }

  protected async patch<T>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.http.patch(path, data, config);
    return response.data;
  }

  protected async delete<T>(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.http.delete(path, config);
    return response.data;
  }
}

/**
 * Factory function to create an API client instance
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

export type { ApiResponse, ApiErrorResponse };
