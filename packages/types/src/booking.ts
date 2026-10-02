// =============================================================================
// Booking Management Types — Module 7
// =============================================================================

import type { UUID } from './common';
import type { TripSummaryDto } from './trip';

export type BookingStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type BookingSource = 'WEB' | 'MOBILE' | 'ADMIN' | 'PHONE' | 'API';

/** Minimal booking summary for list views */
export interface BookingSummaryDto {
  id: UUID;
  companyId: UUID;
  bookingNumber: string;
  bookingDate: string;
  customerId?: UUID | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string;
  passengerCount: number;
  estimatedFare?: number | null;
  actualFare?: number | null;
  status: BookingStatus;
  source: BookingSource;
  tripsCount?: number;
  createdAt: string;
}

/** Full booking detail */
export interface BookingDto extends BookingSummaryDto {
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffLatitude?: number | null;
  dropoffLongitude?: number | null;
  estimatedDistance?: number | null;
  estimatedDuration?: number | null;
  notes?: string | null;
  trips?: TripSummaryDto[];
  updatedAt: string;
}

/** Paginated booking list response */
export interface BookingListDto {
  bookings: BookingSummaryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Booking statistics */
export interface BookingStatsDto {
  total: number;
  draft: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  todayCount: number;
}

/** Create booking payload */
export interface CreateBookingPayload {
  customerId?: UUID;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  pickupTime: string;
  passengerCount?: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
  estimatedFare?: number;
  source?: BookingSource;
  notes?: string;
}

/** Update booking payload */
export interface UpdateBookingPayload {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  pickupTime?: string;
  passengerCount?: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
  estimatedFare?: number;
  actualFare?: number;
  notes?: string;
}
