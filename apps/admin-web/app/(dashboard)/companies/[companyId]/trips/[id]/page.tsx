'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { tripApi } from '@/lib/trip/trip-api';
import { driverApi } from '@/lib/driver/driver-api';
import { vehicleApi } from '@/lib/vehicle/vehicle-api';
import type { TripDto, DriverSummaryDto, VehicleSummaryDto, TripStatus } from '@ai-mos/types';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  MapPin,
  Clock,
  Car,
  UserCheck,
  Send,
  XCircle,
  FileText,
  History,
  Trash2,
  Zap,
} from 'lucide-react';
import { PermissionGate } from '@/components/auth/permission-gate';
import { RouteGuard } from '@/components/auth/route-guard';
import { cn } from '@/lib/utils';

// ─── Status Configs ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  SCHEDULED:        { label: 'Scheduled',        badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  DRIVER_ASSIGNED:  { label: 'Driver Assigned',  badge: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
  VEHICLE_ASSIGNED: { label: 'Vehicle Assigned', badge: 'text-teal-400 bg-teal-400/10 border-teal-400/20' },
  DISPATCHED:       { label: 'Dispatched',       badge: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' },
  DRIVER_ARRIVED:   { label: 'Driver Arrived',   badge: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  PASSENGER_ONBOARD:{ label: 'On Board',         badge: 'text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20' },
  IN_PROGRESS:      { label: 'In Progress',      badge: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  COMPLETED:        { label: 'Completed',        badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  CANCELLED:        { label: 'Cancelled',        badge: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
  NO_SHOW:          { label: 'No Show',          badge: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
};

// ─── Allowed Transitions ─────────────────────────────────────────────────────
const ALLOWED_NEXT_TRANSITIONS: Record<string, TripStatus[]> = {
  SCHEDULED:         ['DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED', 'DISPATCHED', 'CANCELLED'],
  DRIVER_ASSIGNED:   ['VEHICLE_ASSIGNED', 'DISPATCHED', 'SCHEDULED', 'CANCELLED'],
  VEHICLE_ASSIGNED:  ['DRIVER_ASSIGNED', 'DISPATCHED', 'SCHEDULED', 'CANCELLED'],
  DISPATCHED:        ['DRIVER_ARRIVED', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  DRIVER_ARRIVED:    ['PASSENGER_ONBOARD', 'IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  PASSENGER_ONBOARD: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS:       ['COMPLETED', 'CANCELLED'],
  COMPLETED:         [],
  CANCELLED:         [],
  NO_SHOW:           [],
};

export default function TripDetailPage() {
  return (
    <RouteGuard requiredPermission="trip.read">
      <TripDetailContent />
    </RouteGuard>
  );
}

function TripDetailContent() {
  const { companyId, id } = useParams<{ companyId: string; id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [trip, setTrip] = useState<TripDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available drivers & vehicles for assignment
  const [availableDrivers, setAvailableDrivers] = useState<DriverSummaryDto[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<VehicleSummaryDto[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  const loadTrip = useCallback(async () => {
    if (!accessToken || !companyId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [tripData, driversRes, vehiclesRes] = await Promise.all([
        tripApi.get(accessToken, companyId, id),
        driverApi.list(accessToken, companyId, { status: 'ACTIVE', limit: 100 }),
        vehicleApi.list(accessToken, companyId, { status: 'ACTIVE', limit: 100 }),
      ]);
      setTrip(tripData);
      setAvailableDrivers(driversRes.drivers);
      setAvailableVehicles(vehiclesRes.vehicles);
      if (tripData.driverId) setSelectedDriverId(tripData.driverId);
      if (tripData.vehicleId) setSelectedVehicleId(tripData.vehicleId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, id]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  // Dispatch Action
  const handleDispatch = async () => {
    if (!accessToken || !companyId || !id) return;
    setActionLoading(true);
    try {
      await tripApi.dispatch(accessToken, companyId, id);
      loadTrip();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to dispatch trip');
    } finally {
      setActionLoading(false);
    }
  };

  // Status Change Action
  const handleStatusChange = async (targetStatus: TripStatus) => {
    if (!accessToken || !companyId || !id) return;
    const notes = prompt(`Enter notes for transitioning to ${targetStatus} (optional):`) ?? '';
    setActionLoading(true);
    try {
      await tripApi.updateStatus(accessToken, companyId, id, {
        status: targetStatus,
        notes: notes || undefined,
      });
      loadTrip();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  // Assign Driver Action
  const handleAssignDriver = async () => {
    if (!accessToken || !companyId || !id || !selectedDriverId) return;
    setActionLoading(true);
    try {
      await tripApi.assignDriver(accessToken, companyId, id, { driverId: selectedDriverId });
      loadTrip();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to assign driver');
    } finally {
      setActionLoading(false);
    }
  };

  // Assign Vehicle Action
  const handleAssignVehicle = async () => {
    if (!accessToken || !companyId || !id || !selectedVehicleId) return;
    setActionLoading(true);
    try {
      await tripApi.assignVehicle(accessToken, companyId, id, { vehicleId: selectedVehicleId });
      loadTrip();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to assign vehicle');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Trip Action
  const handleDelete = async () => {
    if (!accessToken || !companyId || !id) return;
    if (!confirm('Are you sure you want to delete this trip?')) return;
    setActionLoading(true);
    try {
      await tripApi.delete(accessToken, companyId, id);
      router.push(`/companies/${companyId}/trips`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete trip');
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

  if (error || !trip) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8">
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error ?? 'Trip not found'}
        </div>
        <Link
          href={`/companies/${companyId}/trips`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Trips
        </Link>
      </div>
    );
  }

  const sc = STATUS_CONFIG[trip.status] ?? STATUS_CONFIG['SCHEDULED']!;
  const nextTransitions = ALLOWED_NEXT_TRANSITIONS[trip.status] ?? [];
  const canDispatch =
    trip.driverId &&
    trip.vehicleId &&
    ['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED'].includes(trip.status);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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

      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/20 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{trip.tripNumber}</h1>
            <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', sc.badge)}>
              {sc.label}
            </span>
            <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md uppercase font-semibold">
              {trip.tripType.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Created on {new Date(trip.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canDispatch && (
            <PermissionGate permission="trip.dispatch">
              <button
                onClick={handleDispatch}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 transition"
              >
                <Send className="h-4 w-4" />
                Dispatch Trip
              </button>
            </PermissionGate>
          )}

          {/* Allowed next status transitions */}
          {nextTransitions.length > 0 && (
            <div className="flex items-center gap-1.5">
              {nextTransitions
                .filter((t) => t !== 'CANCELLED')
                .map((t) => (
                  <PermissionGate key={t} permission="trip.update.status">
                    <button
                      onClick={() => handleStatusChange(t)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-card/60 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50 transition"
                    >
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      &rarr; {STATUS_CONFIG[t]?.label ?? t}
                    </button>
                  </PermissionGate>
                ))}
              {nextTransitions.includes('CANCELLED') && (
                <PermissionGate permission="trip.cancel">
                  <button
                    onClick={() => handleStatusChange('CANCELLED')}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                </PermissionGate>
              )}
            </div>
          )}

          {trip.status !== 'IN_PROGRESS' && (
            <PermissionGate permission="trip.delete">
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 p-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Route Details */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/20 pb-2">
            <MapPin className="h-4 w-4 text-primary" />
            Route & Addresses
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Origin</span>
              <span className="text-foreground font-medium flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {trip.originAddress}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Destination</span>
              <span className="text-foreground font-medium flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                {trip.destinationAddress}
              </span>
            </div>
          </div>
        </div>

        {/* Schedule & Timing */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/20 pb-2">
            <Clock className="h-4 w-4 text-primary" />
            Schedule & Execution
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block">Scheduled Start</span>
              <span className="font-medium text-foreground">
                {new Date(trip.scheduledStartTime).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Scheduled End</span>
              <span className="font-medium text-foreground">
                {trip.scheduledEndTime ? new Date(trip.scheduledEndTime).toLocaleString() : '—'}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Actual Start</span>
              <span className="font-medium text-foreground">
                {trip.actualStartTime ? new Date(trip.actualStartTime).toLocaleString() : 'Not started'}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Actual End</span>
              <span className="font-medium text-foreground">
                {trip.actualEndTime ? new Date(trip.actualEndTime).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Driver Assignment Card */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-4">
          <div className="flex items-center justify-between border-b border-border/20 pb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserCheck className="h-4 w-4 text-primary" />
              Driver Assignment
            </div>
            {trip.driver && (
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                Assigned
              </span>
            )}
          </div>

          {trip.driver ? (
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-foreground text-base">
                {trip.driver.employee?.firstName} {trip.driver.employee?.lastName}
              </div>
              <div className="text-xs text-muted-foreground">Driver Code: {trip.driver.driverCode}</div>
              <div className="text-xs text-muted-foreground">Phone: {trip.driver.employee?.phone}</div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No driver assigned to this trip yet.</p>
          )}

          {['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED'].includes(trip.status) && (
            <PermissionGate permission="trip.assign.driver">
              <div className="pt-2 border-t border-border/20 flex gap-2">
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="flex-1 rounded-xl border border-border/40 bg-background/50 px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="">Select an active driver...</option>
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.driverCode} — {d.employee?.firstName} {d.employee?.lastName} ({d.dutyStatus})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssignDriver}
                  disabled={!selectedDriverId || actionLoading}
                  className="rounded-xl bg-primary/20 border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 disabled:opacity-40"
                >
                  Assign
                </button>
              </div>
            </PermissionGate>
          )}
        </div>

        {/* Vehicle Assignment Card */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-4">
          <div className="flex items-center justify-between border-b border-border/20 pb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Car className="h-4 w-4 text-primary" />
              Vehicle Assignment
            </div>
            {trip.vehicle && (
              <span className="text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                Assigned
              </span>
            )}
          </div>

          {trip.vehicle ? (
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-foreground text-base">
                {trip.vehicle.vehicleNumber}
              </div>
              <div className="text-xs text-muted-foreground">
                {trip.vehicle.make} {trip.vehicle.model} ({trip.vehicle.year ?? 'N/A'})
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No vehicle assigned to this trip yet.</p>
          )}

          {['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED'].includes(trip.status) && (
            <PermissionGate permission="trip.assign.vehicle">
              <div className="pt-2 border-t border-border/20 flex gap-2">
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="flex-1 rounded-xl border border-border/40 bg-background/50 px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                >
                  <option value="">Select an active vehicle...</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} — {v.make} {v.model}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssignVehicle}
                  disabled={!selectedVehicleId || actionLoading}
                  className="rounded-xl bg-primary/20 border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/30 disabled:opacity-40"
                >
                  Assign
                </button>
              </div>
            </PermissionGate>
          )}
        </div>

        {/* Linked Booking Card (if present) */}
        {trip.bookingId && (
          <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/20 pb-2">
              <FileText className="h-4 w-4 text-primary" />
              Linked Booking
            </div>
            <p className="text-xs text-muted-foreground">This trip was created from booking:</p>
            <Link
              href={`/companies/${companyId}/bookings/${trip.bookingId}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              {trip.bookingNumber ?? 'View Booking Details'} &rarr;
            </Link>
          </div>
        )}

        {/* Notes Card */}
        <div className="rounded-2xl border border-border/40 bg-card/40 p-5 shadow-sm backdrop-blur space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/20 pb-2">
            <FileText className="h-4 w-4 text-primary" />
            Notes & Instructions
          </div>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {trip.notes || 'No special notes recorded.'}
          </p>
        </div>
      </div>

      {/* Immutable Status History Timeline */}
      <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-sm backdrop-blur space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground border-b border-border/20 pb-3">
          <History className="h-4 w-4 text-primary" />
          Trip Status History ({trip.statusHistory?.length ?? 0})
        </div>

        {!trip.statusHistory || trip.statusHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No history records logged.</p>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:bottom-0 before:left-2.5 before:top-2 before:w-0.5 before:bg-border/40">
            {trip.statusHistory.map((item) => {
              const itemSc = STATUS_CONFIG[item.status] ?? STATUS_CONFIG['SCHEDULED']!;
              return (
                <div key={item.id} className="relative">
                  <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary" />
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', itemSc.badge)}>
                      {itemSc.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.changedAt).toLocaleString()}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-xs text-foreground/80 mt-1 bg-muted/20 p-2 rounded-lg border border-border/20">
                      {item.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
