'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { tripApi } from '@/lib/trip/trip-api';
import type { TripSummaryDto, TripStatsDto } from '@ai-mos/types';
import {
  Radio,
  RefreshCw,
  Send,
  Car,
  UserCheck,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { PermissionGate } from '@/components/auth/permission-gate';
import { RouteGuard } from '@/components/auth/route-guard';
import { cn } from '@/lib/utils';

export default function DispatchBoardPage() {
  return (
    <RouteGuard requiredPermission="trip.dispatch">
      <DispatchBoardContent />
    </RouteGuard>
  );
}

function DispatchBoardContent() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [trips, setTrips] = useState<TripSummaryDto[]>([]);
  const [stats, setStats] = useState<TripStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken || !companyId) return;
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        tripApi.list(accessToken, companyId, { limit: 100 }),
        tripApi.stats(accessToken, companyId),
      ]);
      setTrips(list.trips);
      setStats(st);
    } catch (err: unknown) {
      console.error('Failed to load dispatch board:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dispatch Action
  const handleQuickDispatch = async (tripId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken || !companyId) return;
    setActionBusyId(tripId);
    try {
      await tripApi.dispatch(accessToken, companyId, tripId);
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Dispatch failed');
    } finally {
      setActionBusyId(null);
    }
  };

  // Status Progression Action
  const handleAdvanceStatus = async (tripId: string, nextStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken || !companyId) return;
    setActionBusyId(tripId);
    try {
      await tripApi.updateStatus(accessToken, companyId, tripId, {
        status: nextStatus as any,
      });
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setActionBusyId(null);
    }
  };

  // Partition Trips by Operational Stage
  // 1. Needs Assignment: SCHEDULED or DRIVER_ASSIGNED or VEHICLE_ASSIGNED missing one
  const needsAssignment = trips.filter(
    (t) =>
      ['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED'].includes(t.status) &&
      (!t.driverId || !t.vehicleId),
  );

  // 2. Ready to Dispatch: has both driver and vehicle, not yet dispatched
  const readyToDispatch = trips.filter(
    (t) =>
      ['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED'].includes(t.status) &&
      t.driverId &&
      t.vehicleId,
  );

  // 3. Dispatched / En Route: DISPATCHED or DRIVER_ARRIVED
  const dispatchedEnRoute = trips.filter((t) =>
    ['DISPATCHED', 'DRIVER_ARRIVED'].includes(t.status),
  );

  // 4. Active / In Progress: PASSENGER_ONBOARD or IN_PROGRESS
  const activeInProgress = trips.filter((t) =>
    ['PASSENGER_ONBOARD', 'IN_PROGRESS'].includes(t.status),
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dispatch Board</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Live operations dashboard for vehicle, driver dispatching and execution tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-card/40 px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted/40 transition disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>

          <PermissionGate permission="trip.create">
            <Link
              href={`/companies/${companyId}/trips/new`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              New Trip
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* Stats Summary Bar */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
            <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">Needs Assignment</span>
            <span className="text-2xl font-bold text-foreground">{needsAssignment.length}</span>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5">
            <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider block">Ready to Dispatch</span>
            <span className="text-2xl font-bold text-foreground">{readyToDispatch.length}</span>
          </div>
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5">
            <span className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider block">Dispatched / En Route</span>
            <span className="text-2xl font-bold text-foreground">{dispatchedEnRoute.length}</span>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
            <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider block">Active In Progress</span>
            <span className="text-2xl font-bold text-foreground">{activeInProgress.length}</span>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">Completed</span>
            <span className="text-2xl font-bold text-foreground">{stats.completed}</span>
          </div>
        </div>
      )}

      {/* Operational Kanban / Columns Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Column 1: Needs Assignment */}
        <div className="flex flex-col rounded-2xl border border-border/30 bg-card/30 p-4 backdrop-blur min-h-[500px]">
          <div className="flex items-center justify-between border-b border-border/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Needs Assignment</h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {needsAssignment.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {needsAssignment.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">No pending assignments</p>
            ) : (
              needsAssignment.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => router.push(`/companies/${companyId}/trips/${trip.id}`)}
                  className="rounded-xl border border-border/40 bg-card/60 p-3 shadow-sm hover:border-primary/40 cursor-pointer transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{trip.tripNumber}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{trip.tripType.replace(/_/g, ' ')}</span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="truncate text-foreground font-medium flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="truncate">{trip.originAddress}</span>
                    </div>
                    <div className="truncate flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                      <span className="truncate">{trip.destinationAddress}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] pt-1 border-t border-border/20">
                    <span className={cn('px-1.5 py-0.5 rounded', trip.driverId ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>
                      {trip.driverId ? '✓ Driver' : '✗ No Driver'}
                    </span>
                    <span className={cn('px-1.5 py-0.5 rounded', trip.vehicleId ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>
                      {trip.vehicleId ? '✓ Vehicle' : '✗ No Vehicle'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Ready to Dispatch */}
        <div className="flex flex-col rounded-2xl border border-border/30 bg-card/30 p-4 backdrop-blur min-h-[500px]">
          <div className="flex items-center justify-between border-b border-border/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Ready to Dispatch</h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {readyToDispatch.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {readyToDispatch.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">No trips waiting for dispatch</p>
            ) : (
              readyToDispatch.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => router.push(`/companies/${companyId}/trips/${trip.id}`)}
                  className="rounded-xl border border-cyan-500/30 bg-card/60 p-3 shadow-sm hover:border-cyan-500/60 cursor-pointer transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{trip.tripNumber}</span>
                    <span className="text-[10px] text-cyan-400 font-medium bg-cyan-400/10 px-1.5 py-0.5 rounded">Ready</span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="truncate text-foreground font-medium flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="truncate">{trip.originAddress}</span>
                    </div>
                    <div className="truncate flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                      <span className="truncate">{trip.destinationAddress}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/20">
                    <div className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3 text-primary" />
                      <span>{trip.driver?.employee?.firstName} {trip.driver?.employee?.lastName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Car className="h-3 w-3 text-primary" />
                      <span>{trip.vehicle?.vehicleNumber}</span>
                    </div>
                  </div>

                  <PermissionGate permission="trip.dispatch">
                    <button
                      onClick={(e) => handleQuickDispatch(trip.id, e)}
                      disabled={actionBusyId === trip.id}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Dispatch Now
                    </button>
                  </PermissionGate>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Dispatched / En Route */}
        <div className="flex flex-col rounded-2xl border border-border/30 bg-card/30 p-4 backdrop-blur min-h-[500px]">
          <div className="flex items-center justify-between border-b border-border/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Dispatched / En Route</h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {dispatchedEnRoute.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {dispatchedEnRoute.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">No dispatched trips en route</p>
            ) : (
              dispatchedEnRoute.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => router.push(`/companies/${companyId}/trips/${trip.id}`)}
                  className="rounded-xl border border-indigo-500/30 bg-card/60 p-3 shadow-sm hover:border-indigo-500/60 cursor-pointer transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{trip.tripNumber}</span>
                    <span className="text-[10px] text-indigo-400 font-medium bg-indigo-400/10 px-1.5 py-0.5 rounded">
                      {trip.status === 'DRIVER_ARRIVED' ? 'Arrived' : 'Dispatched'}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="truncate text-foreground font-medium flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="truncate">{trip.originAddress}</span>
                    </div>
                    <div className="truncate flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                      <span className="truncate">{trip.destinationAddress}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/20">
                    <span>Driver: {trip.driver?.employee?.firstName} {trip.driver?.employee?.lastName}</span>
                  </div>

                  <PermissionGate permission="trip.update.status">
                    <div className="flex gap-1.5 pt-1">
                      {trip.status === 'DISPATCHED' && (
                        <button
                          onClick={(e) => handleAdvanceStatus(trip.id, 'DRIVER_ARRIVED', e)}
                          disabled={actionBusyId === trip.id}
                          className="flex-1 rounded-lg bg-indigo-600/30 border border-indigo-500/40 py-1 text-[11px] font-medium text-indigo-200 hover:bg-indigo-600/50"
                        >
                          Driver Arrived
                        </button>
                      )}
                      <button
                        onClick={(e) => handleAdvanceStatus(trip.id, 'IN_PROGRESS', e)}
                        disabled={actionBusyId === trip.id}
                        className="flex-1 rounded-lg bg-blue-600 py-1 text-[11px] font-medium text-white shadow hover:bg-blue-500"
                      >
                        Start Trip &rarr;
                      </button>
                    </div>
                  </PermissionGate>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 4: Active In Progress */}
        <div className="flex flex-col rounded-2xl border border-border/30 bg-card/30 p-4 backdrop-blur min-h-[500px]">
          <div className="flex items-center justify-between border-b border-border/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Active In Progress</h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {activeInProgress.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {activeInProgress.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">No active trips currently in transit</p>
            ) : (
              activeInProgress.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => router.push(`/companies/${companyId}/trips/${trip.id}`)}
                  className="rounded-xl border border-blue-500/30 bg-card/60 p-3 shadow-sm hover:border-blue-500/60 cursor-pointer transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{trip.tripNumber}</span>
                    <span className="text-[10px] text-blue-400 font-medium bg-blue-400/10 px-1.5 py-0.5 rounded">
                      In Transit
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="truncate text-foreground font-medium flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="truncate">{trip.originAddress}</span>
                    </div>
                    <div className="truncate flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                      <span className="truncate">{trip.destinationAddress}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/20">
                    <span>Driver: {trip.driver?.employee?.firstName} {trip.driver?.employee?.lastName}</span>
                  </div>

                  <PermissionGate permission="trip.update.status">
                    <button
                      onClick={(e) => handleAdvanceStatus(trip.id, 'COMPLETED', e)}
                      disabled={actionBusyId === trip.id}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Complete Trip
                    </button>
                  </PermissionGate>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
