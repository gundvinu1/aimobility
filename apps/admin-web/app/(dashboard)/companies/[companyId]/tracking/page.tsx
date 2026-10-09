'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { RouteGuard } from '@/components/auth/route-guard';
import { trackingApi } from '@/lib/tracking/tracking-api';
import { useTrackingSocket } from '@/lib/tracking/use-tracking-socket';
import { fetchGeofences } from '@/lib/geofence/geofence-api';
import { fetchAlerts } from '@/lib/alert/alert-api';
import { FleetMap } from '@/components/tracking/fleet-map';
import { VehicleDetailsPanel } from '@/components/tracking/vehicle-details-panel';
import { TelemetrySimulatorDialog } from '@/components/tracking/telemetry-simulator-dialog';
import { AlertToastNotification } from '@/components/alert/alert-toast-notification';
import type {
  FleetTrackingVehicleDto,
  FleetSnapshotDto,
  GeofenceDto,
  FleetAlertDto,
} from '@ai-mos/types';
import {
  Navigation,
  Car,
  Activity,
  Search,
  RefreshCw,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = ['ALL', 'ACTIVE', 'ON_TRIP', 'IDLE', 'OFFLINE', 'MAINTENANCE'] as const;

export default function FleetTrackingPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';
  const { accessToken } = useAuth();

  const [vehicles, setVehicles] = useState<FleetTrackingVehicleDto[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Module 10: Geofences & Active Alerts State
  const [geofences, setGeofences] = useState<GeofenceDto[]>([]);
  const [showGeofences, setShowGeofences] = useState(true);
  const [activeAlertVehicleIds, setActiveAlertVehicleIds] = useState<Set<string>>(new Set());
  const [activeToastAlert, setActiveToastAlert] = useState<FleetAlertDto | null>(null);

  // ─── 1. Fetch Initial Fleet Snapshot & Geofences / Active Alerts ───────────
  const loadFleet = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await trackingApi.getFleetSnapshot(companyId, accessToken ?? undefined);
      setVehicles(data.vehicles);
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Failed to load fleet tracking snapshot');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, accessToken]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  // Load active geofences and open alerts for boundary and alert indicators
  useEffect(() => {
    if (!companyId) return;
    fetchGeofences(companyId, { isActive: true })
      .then(setGeofences)
      .catch(() => {});

    fetchAlerts(companyId, { status: 'OPEN', limit: 100 })
      .then((res) => {
        const ids = new Set<string>();
        res.alerts?.forEach((a: FleetAlertDto) => {
          if (a.vehicleId) ids.add(a.vehicleId);
        });
        setActiveAlertVehicleIds(ids);
      })
      .catch(() => {});
  }, [companyId]);

  // ─── 2. Real-Time WebSocket Connection ───────────────────────────────────────
  const handleLocationUpdated = useCallback(
    (data: {
      vehicleId: string;
      location: any;
      fleetStatus: any;
      driverId?: string | null;
      driverName?: string | null;
      currentTripId?: string | null;
    }) => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.vehicleId !== data.vehicleId) return v;
          return {
            ...v,
            location: data.location,
            fleetStatus: data.fleetStatus,
            driverId: data.driverId !== undefined ? data.driverId : v.driverId,
            driverName: data.driverName !== undefined ? data.driverName : v.driverName,
            currentTripId: data.currentTripId !== undefined ? data.currentTripId : v.currentTripId,
            lastSeenAt: data.location.timestamp,
            isOnline: true,
          };
        }),
      );
    },
    [],
  );

  const handleStatusUpdated = useCallback(
    (data: { vehicleId: string; vehicleStatus: string; fleetStatus: any }) => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.vehicleId !== data.vehicleId) return v;
          return {
            ...v,
            vehicleStatus: data.vehicleStatus,
            fleetStatus: data.fleetStatus,
          };
        }),
      );
    },
    [],
  );

  const handleFleetSnapshotReceived = useCallback((snapshot: FleetSnapshotDto) => {
    setVehicles(snapshot.vehicles);
  }, []);

  const handleAlertCreated = useCallback((alert: FleetAlertDto) => {
    if (alert.vehicleId) {
      setActiveAlertVehicleIds((prev) => new Set(prev).add(alert.vehicleId!));
    }
    if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
      setActiveToastAlert(alert);
    }
  }, []);

  const handleAlertResolved = useCallback((alert: FleetAlertDto) => {
    if (alert.vehicleId) {
      setActiveAlertVehicleIds((prev) => {
        const next = new Set(prev);
        next.delete(alert.vehicleId!);
        return next;
      });
    }
  }, []);

  const { connectionStatus } = useTrackingSocket({
    companyId,
    accessToken,
    enabled: !!companyId && !!accessToken,
    onLocationUpdated: handleLocationUpdated,
    onStatusUpdated: handleStatusUpdated,
    onFleetSnapshot: handleFleetSnapshotReceived,
    onAlertCreated: handleAlertCreated,
    onAlertResolved: handleAlertResolved,
  });

  // ─── 3. Filtered Vehicles ───────────────────────────────────────────────────
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesSearch =
        searchQuery === '' ||
        v.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.driverName && v.driverName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL' || v.fleetStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [vehicles, searchQuery, statusFilter]);

  // Derived counts
  const onlineCount = useMemo(() => vehicles.filter((v) => v.isOnline).length, [vehicles]);
  const onTripCount = useMemo(() => vehicles.filter((v) => v.fleetStatus === 'ON_TRIP').length, [vehicles]);
  const offlineCount = useMemo(() => vehicles.length - onlineCount, [vehicles, onlineCount]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.vehicleId === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId],
  );

  return (
    <RouteGuard requiredPermission="fleet.tracking.read" requireCompany>
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        {errorMsg && (
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive text-xs px-6 py-2">
            {errorMsg}
          </div>
        )}
        {/* Top Header Bar */}
        <div className="flex-shrink-0 border-b border-border/40 bg-card/60 backdrop-blur px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Navigation className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                    Live Fleet Tracking
                    {/* Real-time Connection Status Indicator */}
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border',
                        connectionStatus === 'LIVE'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/20',
                      )}
                      title={`Connection Status: ${connectionStatus}`}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          connectionStatus === 'LIVE'
                            ? 'bg-emerald-500 animate-pulse'
                            : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
                            ? 'bg-amber-500 animate-ping'
                            : 'bg-rose-500',
                        )}
                      />
                      {connectionStatus === 'LIVE' ? 'LIVE' : connectionStatus}
                    </span>
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time GPS vehicle positions, active trip monitoring, and operational telemetry
                  </p>
                </div>
              </div>
            </div>

            {/* Header Right Actions & KPIs */}
            <div className="flex items-center gap-3">
              {/* Quick Stat Chips */}
              <div className="hidden lg:flex items-center gap-2 text-xs">
                <div className="rounded-xl border border-border/30 bg-muted/20 px-3 py-1.5 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium">Total</span>
                  <p className="font-bold text-foreground text-sm leading-tight">{vehicles.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-center">
                  <span className="text-[10px] text-emerald-500 uppercase font-medium">Online</span>
                  <p className="font-bold text-emerald-500 text-sm leading-tight">{onlineCount}</p>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-center">
                  <span className="text-[10px] text-blue-500 uppercase font-medium">On Trip</span>
                  <p className="font-bold text-blue-500 text-sm leading-tight">{onTripCount}</p>
                </div>
                <div className="rounded-xl border border-zinc-500/20 bg-zinc-500/5 px-3 py-1.5 text-center">
                  <span className="text-[10px] text-zinc-400 uppercase font-medium">Offline</span>
                  <p className="font-bold text-zinc-400 text-sm leading-tight">{offlineCount}</p>
                </div>
              </div>

              {/* Geofence Layer Toggle */}
              <button
                type="button"
                onClick={() => setShowGeofences((prev) => !prev)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition',
                  showGeofences
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/40 text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
                title="Toggle geofence zones on map"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Geofences ({geofences.length})</span>
              </button>

              {/* Simulator Action */}
              <button
                type="button"
                onClick={() => setIsSimulatorOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition"
                title="Emit simulated GPS telemetry event"
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Simulate GPS Ping</span>
              </button>

              {/* Refresh Snapshot */}
              <button
                type="button"
                onClick={loadFleet}
                disabled={isLoading}
                className="rounded-xl border border-border/40 p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition disabled:opacity-50"
                title="Refresh fleet snapshot"
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content: Split Master-Detail Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Side: Vehicle Fleet Drawer / List */}
          <div className="w-80 md:w-96 flex-shrink-0 border-r border-border/40 bg-card/40 backdrop-blur flex flex-col h-full overflow-hidden">
            {/* Search and Filters */}
            <div className="p-3 border-b border-border/30 space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search vehicle number, model, driver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border/40 bg-muted/20 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Filter chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'whitespace-nowrap px-2.5 py-1 rounded-lg text-[10px] font-semibold transition',
                      statusFilter === s
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Cards List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredVehicles.length === 0 ? (
                <div className="py-12 text-center">
                  <Car className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs font-medium text-foreground">No vehicles found</p>
                  <p className="text-[11px] text-muted-foreground">Adjust your search or status filters</p>
                </div>
              ) : (
                filteredVehicles.map((vehicle) => {
                  const isSelected = selectedVehicleId === vehicle.vehicleId;
                  const loc = vehicle.location;

                  return (
                    <div
                      key={vehicle.vehicleId}
                      onClick={() => setSelectedVehicleId(vehicle.vehicleId)}
                      className={cn(
                        'flex items-center justify-between rounded-xl p-3 border transition-all cursor-pointer text-left',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border/30 bg-card/60 hover:bg-accent/50 hover:border-border/60',
                      )}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {/* Status Icon */}
                        <div
                          className={cn(
                            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-xs font-bold mt-0.5',
                            vehicle.fleetStatus === 'ACTIVE' && 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                            vehicle.fleetStatus === 'ON_TRIP' && 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                            vehicle.fleetStatus === 'IDLE' && 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                            vehicle.fleetStatus === 'OFFLINE' && 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                            vehicle.fleetStatus === 'MAINTENANCE' && 'bg-orange-500/10 text-orange-500 border-orange-500/20',
                          )}
                        >
                          <Car className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-xs text-foreground truncate">
                              {vehicle.vehicleNumber}
                            </p>
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full flex-shrink-0',
                                vehicle.isOnline ? 'bg-emerald-500' : 'bg-zinc-500',
                              )}
                              title={vehicle.isOnline ? 'Online' : 'Offline'}
                            />
                          </div>

                          <p className="text-[11px] text-muted-foreground truncate">
                            {vehicle.make} {vehicle.model}
                            {vehicle.driverName ? ` • ${vehicle.driverName}` : ''}
                          </p>

                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span>{loc ? `${Math.round(loc.speed)} km/h` : '0 km/h'}</span>
                            <span>•</span>
                            <span className="capitalize">{vehicle.fleetStatus.toLowerCase().replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className={cn('h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform', isSelected && 'text-primary transform rotate-90')} />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Side: Map Canvas & Slide-over Details Panel */}
          <div className="relative flex-1 h-full">
            <FleetMap
              vehicles={vehicles}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={(v) => setSelectedVehicleId(v.vehicleId)}
              activeAlertVehicleIds={activeAlertVehicleIds}
              geofences={geofences}
              showGeofences={showGeofences}
              className="h-full w-full rounded-none border-0"
            />

            {/* Slide-over Inspection Panel */}
            {selectedVehicle && (
              <div className="absolute right-0 top-0 bottom-0 z-[500] w-full max-w-sm sm:max-w-md shadow-2xl animate-in slide-in-from-right duration-200">
                <VehicleDetailsPanel
                  vehicle={selectedVehicle}
                  companyId={companyId}
                  onClose={() => setSelectedVehicleId(null)}
                  onOpenSimulator={() => setIsSimulatorOpen(true)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Telemetry Simulator Dialog */}
        <TelemetrySimulatorDialog
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          vehicles={vehicles}
          initialVehicle={selectedVehicle}
          companyId={companyId}
        />

        {/* Real-Time In-App Alert Toast Notification Banner */}
        <AlertToastNotification
          alert={activeToastAlert}
          companyId={companyId}
          onDismiss={() => setActiveToastAlert(null)}
        />
      </div>
    </RouteGuard>
  );
}
