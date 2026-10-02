// =============================================================================
// Booking API Client — Module 7
// =============================================================================

import type {
  BookingDto,
  BookingListDto,
  BookingStatsDto,
  CreateBookingPayload,
  UpdateBookingPayload,
} from '@ai-mos/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface BookingFetchOptions extends RequestInit {
  accessToken?: string;
  companyId?: string;
}

async function bookingFetch<T>(
  path: string,
  options: BookingFetchOptions = {},
): Promise<T> {
  const { accessToken, companyId, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(companyId ? { 'x-company-id': companyId } : {}),
  };
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) ?? {}) },
  });
  if (res.status === 204) return undefined as unknown as T;
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    const err = json as { error?: { message: string }; message?: string };
    throw new Error(err.error?.message ?? err.message ?? `Request failed: ${res.status}`);
  }
  const wrapped = json as { success?: boolean; data?: T };
  if (wrapped.success !== undefined && wrapped.data !== undefined) return wrapped.data as T;
  return json as T;
}

// ─── Query params ─────────────────────────────────────────────────────────────

export interface ListBookingsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function buildBookingQuery(params: ListBookingsParams): string {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.search?.trim()) sp.set('search', params.search.trim());
  if (params.status) sp.set('status', params.status);
  if (params.source) sp.set('source', params.source);
  if (params.fromDate) sp.set('fromDate', params.fromDate);
  if (params.toDate) sp.set('toDate', params.toDate);
  if (params.sortBy) sp.set('sortBy', params.sortBy);
  if (params.sortOrder) sp.set('sortOrder', params.sortOrder);
  const q = sp.toString();
  return q ? `?${q}` : '';
}

// ─── API Methods ──────────────────────────────────────────────────────────────

export async function getBookings(
  params: ListBookingsParams = {},
  options: BookingFetchOptions = {},
): Promise<BookingListDto> {
  return bookingFetch<BookingListDto>(`/bookings${buildBookingQuery(params)}`, {
    method: 'GET',
    ...options,
  });
}

export async function getBookingStats(
  options: BookingFetchOptions = {},
): Promise<BookingStatsDto> {
  return bookingFetch<BookingStatsDto>('/bookings/stats', {
    method: 'GET',
    ...options,
  });
}

export async function getBooking(
  id: string,
  options: BookingFetchOptions = {},
): Promise<BookingDto> {
  return bookingFetch<BookingDto>(`/bookings/${id}`, {
    method: 'GET',
    ...options,
  });
}

export async function createBooking(
  payload: CreateBookingPayload,
  options: BookingFetchOptions = {},
): Promise<BookingDto> {
  return bookingFetch<BookingDto>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
    ...options,
  });
}

export async function updateBooking(
  id: string,
  payload: UpdateBookingPayload,
  options: BookingFetchOptions = {},
): Promise<BookingDto> {
  return bookingFetch<BookingDto>(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    ...options,
  });
}

export async function confirmBooking(
  id: string,
  options: BookingFetchOptions = {},
): Promise<BookingDto> {
  return bookingFetch<BookingDto>(`/bookings/${id}/confirm`, {
    method: 'POST',
    ...options,
  });
}

export async function cancelBooking(
  id: string,
  reason?: string,
  options: BookingFetchOptions = {},
): Promise<BookingDto> {
  return bookingFetch<BookingDto>(`/bookings/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    ...options,
  });
}

export async function deleteBooking(
  id: string,
  options: BookingFetchOptions = {},
): Promise<{ success: boolean; message: string }> {
  return bookingFetch<{ success: boolean; message: string }>(`/bookings/${id}`, {
    method: 'DELETE',
    ...options,
  });
}

export const bookingApi = {
  list: (accessToken: string, companyId: string, params?: ListBookingsParams) =>
    getBookings(params, { accessToken, companyId }),
  stats: (accessToken: string, companyId: string) =>
    getBookingStats({ accessToken, companyId }),
  get: (accessToken: string, companyId: string, id: string) =>
    getBooking(id, { accessToken, companyId }),
  create: (accessToken: string, companyId: string, payload: CreateBookingPayload) =>
    createBooking(payload, { accessToken, companyId }),
  update: (accessToken: string, companyId: string, id: string, payload: UpdateBookingPayload) =>
    updateBooking(id, payload, { accessToken, companyId }),
  confirm: (accessToken: string, companyId: string, id: string) =>
    confirmBooking(id, { accessToken, companyId }),
  cancel: (accessToken: string, companyId: string, id: string, reason?: string) =>
    cancelBooking(id, reason, { accessToken, companyId }),
  delete: (accessToken: string, companyId: string, id: string) =>
    deleteBooking(id, { accessToken, companyId }),
};

