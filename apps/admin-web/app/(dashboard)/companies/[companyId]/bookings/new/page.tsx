'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { bookingApi } from '@/lib/booking/booking-api';
import type { BookingSource } from '@ai-mos/types';
import { RouteGuard } from '@/components/auth/route-guard';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  MapPin,
  User,
  DollarSign,
} from 'lucide-react';

export default function NewBookingPage() {
  return (
    <RouteGuard requiredPermission="booking.create">
      <NewBookingForm />
    </RouteGuard>
  );
}

function NewBookingForm() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [estimatedDistance, setEstimatedDistance] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [estimatedFare, setEstimatedFare] = useState('');
  const [source, setSource] = useState<BookingSource>('ADMIN');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !companyId) return;

    if (!customerName.trim() || !customerPhone.trim() || !pickupAddress.trim() || !dropoffAddress.trim() || !pickupTime) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await bookingApi.create(accessToken, companyId, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        pickupAddress: pickupAddress.trim(),
        dropoffAddress: dropoffAddress.trim(),
        pickupTime: new Date(pickupTime).toISOString(),
        passengerCount: Number(passengerCount) || 1,
        estimatedDistance: estimatedDistance ? Number(estimatedDistance) : undefined,
        estimatedDuration: estimatedDuration ? Number(estimatedDuration) : undefined,
        estimatedFare: estimatedFare ? Number(estimatedFare) : undefined,
        source,
        notes: notes.trim() || undefined,
      });

      router.push(`/companies/${companyId}/bookings/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Booking</h1>
        <p className="text-sm text-muted-foreground">
          Create a new trip booking and reservation for your fleet
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Information Card */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-sm backdrop-blur space-y-4">
          <div className="flex items-center gap-2 border-b border-border/20 pb-3 text-base font-semibold text-foreground">
            <User className="h-4 w-4 text-primary" />
            Customer Information
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Customer Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Eleanor Vance"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Phone Number <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. +1-555-0199"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. eleanor@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Booking Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as BookingSource)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="ADMIN">Admin Console</option>
                <option value="PHONE">Phone Reservation</option>
                <option value="WEB">Web Portal</option>
                <option value="MOBILE">Mobile App</option>
                <option value="API">API Integration</option>
              </select>
            </div>
          </div>
        </div>

        {/* Route & Schedule Card */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-sm backdrop-blur space-y-4">
          <div className="flex items-center gap-2 border-b border-border/20 pb-3 text-base font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            Route & Schedule
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Pickup Address <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 742 Evergreen Terrace, Springfield"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Dropoff Address <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Terminal 1, Metro Airport"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Pickup Date & Time <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Passenger Count
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={passengerCount}
                onChange={(e) => setPassengerCount(Number(e.target.value))}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>

        {/* Fare & Estimation Card */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-sm backdrop-blur space-y-4">
          <div className="flex items-center gap-2 border-b border-border/20 pb-3 text-base font-semibold text-foreground">
            <DollarSign className="h-4 w-4 text-primary" />
            Fare & Trip Details
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Est. Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 24.5"
                value={estimatedDistance}
                onChange={(e) => setEstimatedDistance(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Est. Duration (minutes)
              </label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 45"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Estimated Fare ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 65.00"
                value={estimatedFare}
                onChange={(e) => setEstimatedFare(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Special Instructions / Notes
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Luggage assistance needed, VIP passenger..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/companies/${companyId}/bookings`}
            className="rounded-xl border border-border/40 px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Booking
          </button>
        </div>
      </form>
    </div>
  );
}
