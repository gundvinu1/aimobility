'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { tripApi } from '@/lib/trip/trip-api';
import { useDispatchSocket } from '@/lib/dispatch/use-dispatch-socket';
import type {
  TripSummaryDto,
  TripStatsDto,
  DispatchAnalyticsDto,
  DispatchAvailabilityResponseDto,
  TripStopDto,
  RouteCalculationResult,
  EtaEstimateDto,
} from '@ai-mos/types';
import {
  Radio,
  RefreshCw,
  Send,
  UserCheck,
  CheckCircle2,
  Plus,
  Wifi,
  WifiOff,
  MapPin,
  Navigation,
  Trash2,
  X,
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

  // Primary State
  const [trips, setTrips] = useState<TripSummaryDto[]>([]);
  const [stats, setStats] = useState<TripStatsDto | null>(null);
  const [analytics, setAnalytics] = useState<DispatchAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Quick Assign Modal State
  const [assignModalTrip, setAssignModalTrip] = useState<TripSummaryDto | null>(null);
  const [availability, setAvailability] = useState<DispatchAvailabilityResponseDto | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Unassign Modal State
  const [unassignModal, setUnassignModal] = useState<{
    trip: TripSummaryDto;
    type: 'DRIVER' | 'VEHICLE';
  } | null>(null);
  const [unassignNotes, setUnassignNotes] = useState('');
  const [unassignSubmitting, setUnassignSubmitting] = useState(false);

  // Multi-Stop Waypoints Drawer State
  const [stopsTrip, setStopsTrip] = useState<TripSummaryDto | null>(null);
  const [stops, setStops] = useState<TripStopDto[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [routeCalc, setRouteCalc] = useState<RouteCalculationResult | null>(null);
  const [tripEta, setTripEta] = useState<EtaEstimateDto | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [newStopName, setNewStopName] = useState('');
  const [newStopAddress, setNewStopAddress] = useState('');
  const [newStopLat, setNewStopLat] = useState('37.7749');
  const [newStopLng, setNewStopLng] = useState('-122.4194');
  const [newStopType, setNewStopType] = useState<'PICKUP' | 'WAYPOINT' | 'DROPOFF'>('WAYPOINT');
  const [newStopPassenger, setNewStopPassenger] = useState('');

  // Primary Data Fetch
  const loadData = useCallback(async (silent = false) => {
    if (!accessToken || !companyId) return;
    if (!silent) setLoading(true);
    try {
      const [list, st, an] = await Promise.all([
        tripApi.list(accessToken, companyId, { limit: 100 }),
        tripApi.stats(accessToken, companyId),
        tripApi.dispatchAnalytics(accessToken, companyId).catch(() => null),
      ]);
      setTrips(list.trips);
      setStats(st);
      if (an) setAnalytics(an);
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error('Failed to load dispatch board data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [accessToken, companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time Socket.IO dispatch integration (Phase 12C)
  const { connectionStatus, isConnected } = useDispatchSocket({
    companyId,
    accessToken,
    enabled: true,
    onAnyDispatchEvent: () => {
      loadData(true);
    },
  });

  // Quick Dispatch Action
  const handleQuickDispatch = async (tripId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken || !companyId) return;
    setActionBusyId(tripId);
    try {
      await tripApi.dispatch(accessToken, companyId, tripId);
      loadData(true);
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
      loadData(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setActionBusyId(null);
    }
  };

  // Open Quick Assignment Modal
  const openAssignModal = async (trip: TripSummaryDto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken || !companyId) return;
    setAssignModalTrip(trip);
    setSelectedDriverId(trip.driverId ?? '');
    setSelectedVehicleId(trip.vehicleId ?? '');
    setAssignNotes('');
    setLoadingAvailability(true);
    try {
      const avail = await tripApi.availability(accessToken, companyId, {
        startTime: trip.scheduledStartTime,
      });
      setAvailability(avail);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load availability:', err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Execute Quick Assignment
  const handleConfirmAssignment = async () => {
    if (!accessToken || !companyId || !assignModalTrip) return;
    setAssignSubmitting(true);
    try {
      if (selectedDriverId && selectedDriverId !== assignModalTrip.driverId) {
        await tripApi.assignDriver(accessToken, companyId, assignModalTrip.id, {
          driverId: selectedDriverId,
          notes: assignNotes || undefined,
        });
      }
      if (selectedVehicleId && selectedVehicleId !== assignModalTrip.vehicleId) {
        await tripApi.assignVehicle(accessToken, companyId, assignModalTrip.id, {
          vehicleId: selectedVehicleId,
          notes: assignNotes || undefined,
        });
      }
      setAssignModalTrip(null);
      loadData(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Open Unassign Modal
  const openUnassignModal = (trip: TripSummaryDto, type: 'DRIVER' | 'VEHICLE', e: React.MouseEvent) => {
    e.stopPropagation();
    setUnassignModal({ trip, type });
    setUnassignNotes('');
  };

  // Confirm Unassign
  const handleConfirmUnassign = async () => {
    if (!accessToken || !companyId || !unassignModal) return;
    setUnassignSubmitting(true);
    try {
      if (unassignModal.type === 'DRIVER') {
        await tripApi.unassignDriver(accessToken, companyId, unassignModal.trip.id, {
          notes: unassignNotes || undefined,
        });
      } else {
        await tripApi.unassignVehicle(accessToken, companyId, unassignModal.trip.id, {
          notes: unassignNotes || undefined,
        });
      }
      setUnassignModal(null);
      loadData(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Unassignment failed');
    } finally {
      setUnassignSubmitting(false);
    }
  };

  // Open Multi-Stop Waypoints Drawer
  const openStopsDrawer = async (trip: TripSummaryDto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken || !companyId) return;
    setStopsTrip(trip);
    setRouteCalc(null);
    setTripEta(null);
    setLoadingStops(true);
    try {
      const [stopList, eta] = await Promise.all([
        tripApi.stops(accessToken, companyId, trip.id),
        tripApi.getEta(accessToken, companyId, trip.id).catch(() => null),
      ]);
      setStops(stopList);
      if (eta) setTripEta(eta);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load stops:', err);
    } finally {
      setLoadingStops(false);
    }
  };

  // Add Stop
  const handleAddStop = async () => {
    if (!accessToken || !companyId || !stopsTrip || !newStopName.trim()) return;
    try {
      const created = await tripApi.addStop(accessToken, companyId, stopsTrip.id, {
        locationName: newStopName.trim(),
        address: newStopAddress.trim() || undefined,
        latitude: parseFloat(newStopLat) || 0,
        longitude: parseFloat(newStopLng) || 0,
        stopType: newStopType,
        passengerName: newStopPassenger.trim() || undefined,
      });
      setStops((prev) => [...prev, created]);
      setNewStopName('');
      setNewStopAddress('');
      setNewStopPassenger('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add stop');
    }
  };

  // Delete Stop
  const handleDeleteStop = async (stopId: string) => {
    if (!accessToken || !companyId || !stopsTrip) return;
    try {
      await tripApi.deleteStop(accessToken, companyId, stopsTrip.id, stopId);
      setStops((prev) => prev.filter((s) => s.id !== stopId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete stop');
    }
  };

  // Calculate Route
  const handleCalculateRoute = async () => {
    if (!accessToken || !companyId || !stopsTrip) return;
    setCalculatingRoute(true);
    try {
      const res = await tripApi.calculateRoute(accessToken, companyId, stopsTrip.id);
      setRouteCalc(res);
      const eta = await tripApi.getEta(accessToken, companyId, stopsTrip.id);
      setTripEta(eta);
      loadData(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Route calculation failed');
    } finally {
      setCalculatingRoute(false);
    }
  };

  // 4 Kanban Stages
  const needsAssignment = trips.filter(
    (t) =>
      ['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED'].includes(t.status) &&
      (!t.driverId || !t.vehicleId),
  );

  const readyToDispatch = trips.filter(
    (t) =>
      ['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED'].includes(t.status) &&
      t.driverId &&
      t.vehicleId,
  );

  const dispatchedEnRoute = trips.filter((t) =>
    ['DISPATCHED', 'DRIVER_ARRIVED'].includes(t.status),
  );

  const activeInProgress = trips.filter((t) =>
    ['PASSENGER_ONBOARD', 'IN_PROGRESS'].includes(t.status),
  );

  return (
    <div className="space-y-6">
      {/* Header with Live Socket Badge */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-primary animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Dispatch &amp; Operations Board
            </h1>
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition',
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-muted/30 text-muted-foreground border-border/40',
              )}
            >
              {isConnected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <Wifi className="h-3 w-3" />
                  Live Sync
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  {connectionStatus}
                </>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time multi-stop routing, live fleet resource dispatching &amp; dynamic ETA optimization
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

      {/* Operational Dispatch Analytics KPIs Bar (Phase 12D) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
          <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">
            Needs Assign
          </span>
          <span className="text-2xl font-bold text-foreground">{needsAssignment.length}</span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">
            {trips.length > 0 ? `${Math.round((needsAssignment.length / trips.length) * 100)}% backlog` : '0%'}
          </span>
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5">
          <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider block">
            Ready Dispatch
          </span>
          <span className="text-2xl font-bold text-foreground">{readyToDispatch.length}</span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">Crew assigned</span>
        </div>

        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5">
          <span className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider block">
            Avg Lead Time
          </span>
          <span className="text-2xl font-bold text-foreground">
            {analytics?.averageLeadTimeMinutes != null ? `${analytics.averageLeadTimeMinutes}m` : '—'}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">Order to dispatch</span>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
          <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">
            Completed Trips
          </span>
          <span className="text-2xl font-bold text-foreground">
            {stats?.completed ?? analytics?.completedTrips ?? 0}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">
            {analytics?.onTimePickupRate != null ? `${analytics.onTimePickupRate}% on-time` : '&le; 15 min buffer'}
          </span>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
          <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider block">
            Driver Util
          </span>
          <span className="text-2xl font-bold text-foreground">
            {analytics?.driverUtilizationRate != null ? `${analytics.driverUtilizationRate}%` : '—'}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">Active on trip</span>
        </div>

        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5">
          <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wider block">
            Vehicle Util
          </span>
          <span className="text-2xl font-bold text-foreground">
            {analytics?.vehicleUtilizationRate != null ? `${analytics.vehicleUtilizationRate}%` : '—'}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">Active fleet</span>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {/* Column 1: Needs Assignment */}
        <div className="flex flex-col rounded-2xl border border-border/30 bg-card/30 p-4 backdrop-blur min-h-[500px]">
          <div className="flex items-center justify-between border-b border-border/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Needs Assignment
              </h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {needsAssignment.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {needsAssignment.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">
                No trips awaiting resource assignment
              </p>
            ) : (
              needsAssignment.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => router.push(`/companies/${companyId}/trips/${trip.id}`)}
                  className="rounded-xl border border-border/40 bg-card/60 p-3 shadow-sm hover:border-border transition space-y-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{trip.tripNumber}</span>
                    <span className="text-[10px] text-amber-400 font-medium bg-amber-400/10 px-1.5 py-0.5 rounded">
                      Unassigned
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

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/20">
                    <span>
                      {trip.scheduledStartTime
                        ? new Date(trip.scheduledStartTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Immediate'}
                    </span>
                    <button
                      onClick={(e) => openStopsDrawer(trip, e)}
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      <MapPin className="h-3 w-3" />
                      Waypoints
                    </button>
                  </div>

                  {/* Missing Resource Indicators */}
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded font-medium',
                        trip.driverId
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400',
                      )}
                    >
                      Driver: {trip.driverId ? '✓' : 'Missing'}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded font-medium',
                        trip.vehicleId
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400',
                      )}
                    >
                      Vehicle: {trip.vehicleId ? '✓' : 'Missing'}
                    </span>
                  </div>

                  <PermissionGate permission="trip.dispatch">
                    <button
                      onClick={(e) => openAssignModal(trip, e)}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Assign Crew &amp; Vehicle
                    </button>
                  </PermissionGate>
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
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Ready to Dispatch
              </h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {readyToDispatch.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {readyToDispatch.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">
                No trips ready for dispatch
              </p>
            ) : (
              readyToDispatch.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => router.push(`/companies/${companyId}/trips/${trip.id}`)}
                  className="rounded-xl border border-cyan-500/30 bg-card/60 p-3 shadow-sm hover:border-cyan-500/60 cursor-pointer transition space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">{trip.tripNumber}</span>
                    <span className="text-[10px] text-cyan-400 font-medium bg-cyan-400/10 px-1.5 py-0.5 rounded">
                      Ready
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

                  <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/20">
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        Driver: {trip.driver?.employee?.firstName} {trip.driver?.employee?.lastName}
                      </span>
                      <button
                        onClick={(e) => openUnassignModal(trip, 'DRIVER', e)}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Unassign
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">
                        Vehicle: {trip.vehicle?.vehicleNumber}
                      </span>
                      <button
                        onClick={(e) => openUnassignModal(trip, 'VEHICLE', e)}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Unassign
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={(e) => openStopsDrawer(trip, e)}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                    >
                      <MapPin className="h-3 w-3" />
                      Waypoints &amp; Route
                    </button>
                  </div>

                  <PermissionGate permission="trip.dispatch">
                    <button
                      onClick={(e) => handleQuickDispatch(trip.id, e)}
                      disabled={actionBusyId === trip.id}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 py-1.5 text-xs font-semibold text-white shadow hover:bg-cyan-500 transition disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Dispatch Trip Now &rarr;
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
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Dispatched / En Route
              </h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {dispatchedEnRoute.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {dispatchedEnRoute.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">
                No trips en route
              </p>
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
                      {trip.status === 'DRIVER_ARRIVED' ? 'Driver Arrived' : 'Dispatched'}
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

                  <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/20 flex items-center justify-between">
                    <span className="truncate">
                      Driver: {trip.driver?.employee?.firstName} {trip.driver?.employee?.lastName}
                    </span>
                    <button
                      onClick={(e) => openStopsDrawer(trip, e)}
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      Stops
                    </button>
                  </div>

                  <PermissionGate permission="trip.update.status">
                    <div className="flex items-center gap-2 mt-2">
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
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Active In Progress
              </h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
              {activeInProgress.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {activeInProgress.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10">
                No active trips currently in transit
              </p>
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

                  <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/20 flex items-center justify-between">
                    <span>
                      Driver: {trip.driver?.employee?.firstName} {trip.driver?.employee?.lastName}
                    </span>
                    <button
                      onClick={(e) => openStopsDrawer(trip, e)}
                      className="text-[10px] text-blue-400 hover:underline"
                    >
                      Waypoints
                    </button>
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

      {/* ─── Quick Assign Modal (Phase 12A) ─────────────────────────────────── */}
      {assignModalTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Assign Crew &amp; Vehicle — {assignModalTrip.tripNumber}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Validates conflict overlaps (&plusmn;30m buffer) and active work orders.
                </p>
              </div>
              <button
                onClick={() => setAssignModalTrip(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingAvailability ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Checking live fleet conflict availability...
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Driver Select */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Select Driver
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full rounded-xl border border-border/40 bg-card/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— Unassigned —</option>
                    {availability?.drivers.map((d) => (
                      <option
                        key={d.id}
                        value={d.id}
                        disabled={!d.isAvailable && d.id !== assignModalTrip.driverId}
                      >
                        {d.name} ({d.driverCode}) {d.isAvailable ? '— Available' : `[Conflict: ${d.conflictReason}]`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vehicle Select */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Select Vehicle
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full rounded-xl border border-border/40 bg-card/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— Unassigned —</option>
                    {availability?.vehicles.map((v) => (
                      <option
                        key={v.id}
                        value={v.id}
                        disabled={!v.isAvailable && v.id !== assignModalTrip.vehicleId}
                      >
                        {v.vehicleNumber} ({v.make} {v.model}) {v.isAvailable ? '— Available' : `[Conflict: ${v.conflictReason}]`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Assignment Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="e.g. Assigned per VIP request"
                    className="w-full rounded-xl border border-border/40 bg-card/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/20">
              <button
                onClick={() => setAssignModalTrip(null)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssignment}
                disabled={assignSubmitting || loadingAvailability}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {assignSubmitting ? 'Saving...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Unassign Modal (Phase 12A) ─────────────────────────────────────── */}
      {unassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">
              Unassign {unassignModal.type === 'DRIVER' ? 'Driver' : 'Vehicle'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to unassign the {unassignModal.type.toLowerCase()} from trip{' '}
              <span className="font-semibold text-foreground">{unassignModal.trip.tripNumber}</span>?
              Trip status will revert accordingly.
            </p>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Reason Notes (Optional)
              </label>
              <input
                type="text"
                value={unassignNotes}
                onChange={(e) => setUnassignNotes(e.target.value)}
                placeholder="e.g. Driver reported sick, reassignment required"
                className="w-full rounded-xl border border-border/40 bg-card/60 px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setUnassignModal(null)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnassign}
                disabled={unassignSubmitting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-rose-500 disabled:opacity-50"
              >
                {unassignSubmitting ? 'Unassigning...' : 'Confirm Unassign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Multi-Stop Waypoints Drawer (Phase 12B) ─────────────────────────── */}
      {stopsTrip && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl bg-card border-l border-border/40 p-6 overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/20 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Multi-Stop Route Planning
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trip {stopsTrip.tripNumber} &bull; {stopsTrip.originAddress} &rarr; {stopsTrip.destinationAddress}
                </p>
              </div>
              <button
                onClick={() => setStopsTrip(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Route Calculation Summary Bar */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">Calculated Route</span>
                <button
                  onClick={handleCalculateRoute}
                  disabled={calculatingRoute}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {calculatingRoute ? 'Calculating...' : 'Calculate Route & ETA'}
                </button>
              </div>

              {(routeCalc || tripEta) && (
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/20">
                  <div>
                    <span className="text-muted-foreground">Total Distance:</span>{' '}
                    <span className="font-semibold text-foreground">
                      {routeCalc?.distanceKm ?? tripEta?.distanceRemainingKm} km
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Est Duration:</span>{' '}
                    <span className="font-semibold text-foreground">
                      {routeCalc?.durationMinutes ?? tripEta?.durationRemainingMinutes} mins
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Waypoints Sequence List */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Stops &amp; Waypoints ({stops.length})
              </h4>

              {loadingStops ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Loading stops...</p>
              ) : stops.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No intermediate waypoints added yet. Direct point-to-point trip.
                </p>
              ) : (
                <div className="space-y-2">
                  {stops.map((stop) => (
                    <div
                      key={stop.id}
                      className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 p-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[11px]">
                          {stop.stopOrder}
                        </span>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            <span>{stop.locationName}</span>
                            <span className="text-[10px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded uppercase">
                              {stop.stopType}
                            </span>
                          </div>
                          {stop.address && (
                            <p className="text-[11px] text-muted-foreground">{stop.address}</p>
                          )}
                          {stop.passengerName && (
                            <p className="text-[11px] text-primary/80">Pax: {stop.passengerName}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {stop.status}
                        </span>
                        <button
                          onClick={() => handleDeleteStop(stop.id)}
                          className="text-muted-foreground hover:text-rose-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Stop Form */}
            <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3 text-xs">
              <h4 className="font-semibold text-foreground">Add New Waypoint</h4>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-0.5">Location Name *</label>
                  <input
                    type="text"
                    value={newStopName}
                    onChange={(e) => setNewStopName(e.target.value)}
                    placeholder="e.g. Client Office / Terminal 2"
                    className="w-full rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-0.5">Address</label>
                  <input
                    type="text"
                    value={newStopAddress}
                    onChange={(e) => setNewStopAddress(e.target.value)}
                    placeholder="e.g. 100 Main St, Suite 400"
                    className="w-full rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Latitude</label>
                    <input
                      type="text"
                      value={newStopLat}
                      onChange={(e) => setNewStopLat(e.target.value)}
                      className="w-full rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Longitude</label>
                    <input
                      type="text"
                      value={newStopLng}
                      onChange={(e) => setNewStopLng(e.target.value)}
                      className="w-full rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Stop Type</label>
                    <select
                      value={newStopType}
                      onChange={(e) => setNewStopType(e.target.value as any)}
                      className="w-full rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="WAYPOINT">WAYPOINT</option>
                      <option value="PICKUP">PICKUP</option>
                      <option value="DROPOFF">DROPOFF</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-0.5">Passenger Name</label>
                    <input
                      type="text"
                      value={newStopPassenger}
                      onChange={(e) => setNewStopPassenger(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-lg border border-border/40 bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddStop}
                  className="w-full mt-2 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition"
                >
                  + Add Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
