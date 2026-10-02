'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { bookingApi } from '@/lib/booking/booking-api';
import type { BookingDto } from '@ai-mos/types';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  User,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  Route,
  Plus,
  Trash2,
} from 'lucide-react';
import { PermissionGate } from '@/components/auth/permission-gate';
import { RouteGuard } from '@/components/auth/route-guard';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  DRAFT:     { label: 'Draft',     badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  CONFIRMED: { label: 'Confirmed', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  COMPLETED: { label: 'Completed', badge: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  CANCELLED: { label: 'Cancelled', badge: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
};

export default function BookingDetailPage() {
  return (
    <RouteGuard requiredPermission="booking.read">
      <BookingDetailContent />
    </RouteGuard>
  );
}

function BookingDetailContent() {
  const { companyId, id } = useParams<{ companyId: string; id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    if (!accessToken || !companyId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await bookingApi.get(accessToken, companyId, id);
      setBooking(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, id]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const handleConfirm = async () => {
    if (!accessToken || !companyId || !id) return;
    setActionLoading(true);
    try {
      await bookingApi.confirm(accessToken, companyId, id);
      loadBooking();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to confirm booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!accessToken || !companyId || !id) return;
    const reason = prompt('Enter reason for cancellation (optional):') ?? '';
    setActionLoading(true);
    try {
      await bookingApi.cancel(accessToken, companyId, id, reason);
      loadBooking();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !companyId || !id) return;
    if (!confirm('Are you sure you want to delete this booking?')) return;
    setActionLoading(true);
    try {
      await bookingApi.delete(accessToken, companyId, id);
      router.push(`/companies/${companyId}/bookings`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete booking');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error ?? 'Booking not found'}
        </div>
        <Link
          href={`/companies/${companyId}/bookings`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Bookings
        </Link>
      </div>
    );
  }

  const sc = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG['DRAFT']!;
  const pickupDate = new Date(booking.pickupTime);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back button */}
      <div>
        <Link
          href={`/companies/${companyId}/bookings`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Bookings
        </Link>
      </div>

      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/20 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{booking.bookingNumber}</h1>
            <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', sc.badge)}>
              {sc.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Booked on {new Date(booking.createdAt).toLocaleDateString()} via {booking.source}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {booking.status === 'DRAFT' && (
            <PermissionGate anyOf={['booking.confirm', 'booking.update']}>
              <button
                onClick={handleConfirm}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Booking
              </button>
            </PermissionGate>
          )}

          {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
            <PermissionGate anyOf={['booking.cancel', 'booking.update']}>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition"
              >
                <XCircle className="h-4 w-4" />
                Cancel Booking
              </button>
            </PermissionGate>
          )}

          <PermissionGate permission="trip.create">
            <Link
              href={`/companies/${companyId}/trips/new?bookingId=${booking.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition"
            >
              <Route className="h-4 w-4" />
              Create Trip
            </Link>
          </PermissionGate>

          <PermissionGate permission="booking.delete">
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 p-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Grid details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Customer Details */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/20 pb-2">
            <User className="h-4 w-4 text-primary" />
            Customer Details
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Customer Name</span>
              <span className="font-medium text-foreground">{booking.customerName}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Phone</span>
              <span className="font-medium text-foreground">{booking.customerPhone}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Email</span>
              <span className="font-medium text-foreground">{booking.customerEmail || '—'}</span>
            </div>
          </div>
        </div>

        {/* Schedule & Route */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/20 pb-2">
            <Clock className="h-4 w-4 text-primary" />
            Schedule & Route
          </div>
          <div className="space-y-2.5 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Pickup Date & Time</span>
              <span className="font-semibold text-foreground">
                {pickupDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at{' '}
                {pickupDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Pickup Address</span>
              <span className="text-foreground flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {booking.pickupAddress}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Dropoff Address</span>
              <span className="text-foreground flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                {booking.dropoffAddress}
              </span>
            </div>
          </div>
        </div>

        {/* Pricing & Estimation */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/20 pb-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Fare & Estimation
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Estimated Fare</span>
              <span className="text-base font-bold text-foreground">
                {booking.estimatedFare != null ? `$${booking.estimatedFare.toFixed(2)}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Actual Fare</span>
              <span className="text-base font-bold text-primary">
                {booking.actualFare != null ? `$${booking.actualFare.toFixed(2)}` : 'Pending'}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Estimated Distance</span>
              <span className="font-medium text-foreground">
                {booking.estimatedDistance != null ? `${booking.estimatedDistance} km` : '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Estimated Duration</span>
              <span className="font-medium text-foreground">
                {booking.estimatedDuration != null ? `${booking.estimatedDuration} mins` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/20 pb-2">
            <FileText className="h-4 w-4 text-primary" />
            Special Instructions / Notes
          </div>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {booking.notes || 'No notes recorded for this booking.'}
          </p>
        </div>
      </div>

      {/* Linked Trips Section */}
      <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-sm backdrop-blur space-y-4">
        <div className="flex items-center justify-between border-b border-border/20 pb-3">
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Route className="h-4 w-4 text-primary" />
            Linked Trips ({booking.trips?.length ?? 0})
          </div>
          <PermissionGate permission="trip.create">
            <Link
              href={`/companies/${companyId}/trips/new?bookingId=${booking.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Trip
            </Link>
          </PermissionGate>
        </div>

        {!booking.trips || booking.trips.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Route className="mx-auto h-7 w-7 opacity-30" />
            <p className="mt-2 text-xs">No operational trips have been dispatched for this booking yet.</p>
            <PermissionGate permission="trip.create">
              <Link
                href={`/companies/${companyId}/trips/new?bookingId=${booking.id}`}
                className="mt-3 inline-block rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition"
              >
                Create Trip from this Booking
              </Link>
            </PermissionGate>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {booking.trips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => router.push(`/companies/${companyId}/trips/${trip.id}`)}
                className="flex items-center justify-between py-3 hover:bg-muted/30 px-2 rounded-xl cursor-pointer transition"
              >
                <div>
                  <div className="font-semibold text-sm text-foreground">{trip.tripNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {trip.originAddress} &rarr; {trip.destinationAddress}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-muted text-foreground">
                    {trip.status}
                  </span>
                  <span className="text-xs text-primary font-semibold">&rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
