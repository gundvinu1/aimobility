'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { tripApi } from '@/lib/trip/trip-api';
import { bookingApi } from '@/lib/booking/booking-api';
import { driverApi } from '@/lib/driver/driver-api';
import { vehicleApi } from '@/lib/vehicle/vehicle-api';
import type { TripType, DriverSummaryDto, VehicleSummaryDto } from '@ai-mos/types';
import { RouteGuard } from '@/components/auth/route-guard';
import {
  Route,
  ArrowLeft,
  Loader2,
  AlertCircle,
  UserCheck,
  DollarSign,
} from 'lucide-react';

export default function NewTripPage() {
  return (
    <RouteGuard requiredPermission="trip.create">
      <NewTripForm />
    </RouteGuard>
  );
}

function NewTripForm() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingIdParam = searchParams.get('bookingId');
  const { accessToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reference lists
  const [drivers, setDrivers] = useState<DriverSummaryDto[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummaryDto[]>([]);

  // Form State
  const [bookingId, setBookingId] = useState(bookingIdParam || '');
  const [tripType, setTripType] = useState<TripType>('ONE_WAY');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [scheduledEndTime, setScheduledEndTime] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [fareAmount, setFareAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function init() {
      if (!accessToken || !companyId) return;
      try {
        const [driversRes, vehiclesRes] = await Promise.all([
          driverApi.list(accessToken, companyId, { status: 'ACTIVE', limit: 100 }),
          vehicleApi.list(accessToken, companyId, { status: 'ACTIVE', limit: 100 }),
        ]);
        setDrivers(driversRes.drivers);
        setVehicles(vehiclesRes.vehicles);

        // If bookingId was passed, load booking details to pre-populate
        if (bookingIdParam) {
          const booking = await bookingApi.get(accessToken, companyId, bookingIdParam);
          setOriginAddress(booking.pickupAddress);
          setDestinationAddress(booking.dropoffAddress);
          setScheduledStartTime(new Date(booking.pickupTime).toISOString().slice(0, 16));
          if (booking.estimatedDistance) setDistanceKm(String(booking.estimatedDistance));
          if (booking.estimatedFare) setFareAmount(String(booking.estimatedFare));
          if (booking.notes) setNotes(`From Booking ${booking.bookingNumber}: ${booking.notes}`);
        }
      } catch (err: unknown) {
        console.error('Error initializing new trip:', err);
      } finally {
        setInitLoading(false);
      }
    }
    init();
  }, [accessToken, companyId, bookingIdParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !companyId) return;

    if (!originAddress.trim() || !destinationAddress.trim() || !scheduledStartTime) {
      setError('Origin, Destination, and Scheduled Start Time are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await tripApi.create(accessToken, companyId, {
        bookingId: bookingId.trim() || undefined,
        tripType,
        originAddress: originAddress.trim(),
        destinationAddress: destinationAddress.trim(),
        scheduledStartTime: new Date(scheduledStartTime).toISOString(),
        scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime).toISOString() : undefined,
        driverId: driverId || undefined,
        vehicleId: vehicleId || undefined,
        distanceKm: distanceKm ? Number(distanceKm) : undefined,
        fareAmount: fareAmount ? Number(fareAmount) : undefined,
        notes: notes.trim() || undefined,
      });

      router.push(`/companies/${companyId}/trips/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  if (initLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button */}
      <div>
        <Link
          href={`/companies/${companyId}/trips`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Trips
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Trip</h1>
        <p className="text-sm text-muted-foreground">
          Schedule an operational trip, assign a driver and vehicle, and prepare for dispatch
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
        {/* Route & Type Card */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-sm backdrop-blur space-y-4">
          <div className="flex items-center gap-2 border-b border-border/20 pb-3 text-base font-semibold text-foreground">
            <Route className="h-4 w-4 text-primary" />
            Trip Route & Type
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Trip Type
              </label>
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value as TripType)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="ONE_WAY">One Way</option>
                <option value="ROUND_TRIP">Round Trip</option>
                <option value="AIRPORT_TRANSFER">Airport Transfer</option>
                <option value="RENTAL">Rental</option>
                <option value="OUTSTATION">Outstation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Linked Booking ID (Optional)
              </label>
              <input
                type="text"
                placeholder="Paste Booking UUID if linked"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Origin Address <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 100 Main St, New York, NY"
                value={originAddress}
                onChange={(e) => setOriginAddress(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Destination Address <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. JFK Airport Terminal 4, NY"
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Scheduled Start Time <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledStartTime}
                onChange={(e) => setScheduledStartTime(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Scheduled End Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledEndTime}
                onChange={(e) => setScheduledEndTime(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>

        {/* Assignment Card */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-sm backdrop-blur space-y-4">
          <div className="flex items-center gap-2 border-b border-border/20 pb-3 text-base font-semibold text-foreground">
            <UserCheck className="h-4 w-4 text-primary" />
            Driver & Vehicle Assignment
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Assign Driver (Optional)
              </label>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">-- No Driver Assigned --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.driverCode} — {d.employee?.firstName} {d.employee?.lastName} ({d.dutyStatus})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Assign Vehicle (Optional)
              </label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">-- No Vehicle Assigned --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleNumber} — {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Metrics & Fare Card */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-sm backdrop-blur space-y-4">
          <div className="flex items-center gap-2 border-b border-border/20 pb-3 text-base font-semibold text-foreground">
            <DollarSign className="h-4 w-4 text-primary" />
            Distance & Fare
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 35.0"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Fare Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 75.00"
                value={fareAmount}
                onChange={(e) => setFareAmount(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Trip Notes / Instructions
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Customer requested meet and greet..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border/40 bg-background/50 px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/companies/${companyId}/trips`}
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
            Create Trip
          </button>
        </div>
      </form>
    </div>
  );
}
