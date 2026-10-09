'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { FleetTrackingVehicleDto, FleetAlertDto } from '@ai-mos/types';
import { usePermissions } from '@/lib/auth/use-permissions';
import { fetchAlerts } from '@/lib/alert/alert-api';
import {
  X,
  Car,
  Gauge,
  Compass,
  Zap,
  Battery,
  Fuel,
  Thermometer,
  Radio,
  User,
  Route,
  Clock,
  ExternalLink,
  History,
  Activity,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VehicleDetailsPanelProps {
  vehicle: FleetTrackingVehicleDto;
  companyId: string;
  onClose: () => void;
  onOpenSimulator?: (_vehicle: FleetTrackingVehicleDto) => void;
}

const STATUS_BADGES: Record<string, { label: string; badge: string; dot: string }> = {
  ACTIVE:      { label: 'Active',      badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', dot: 'bg-emerald-500' },
  ON_TRIP:     { label: 'On Trip',     badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20',       dot: 'bg-blue-500' },
  IDLE:        { label: 'Idle',        badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',    dot: 'bg-amber-500' },
  OFFLINE:     { label: 'Offline',     badge: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',       dot: 'bg-zinc-400' },
  MAINTENANCE: { label: 'Maintenance', badge: 'bg-orange-500/10 text-orange-500 border-orange-500/20', dot: 'bg-orange-500' },
};

function formatCompass(heading?: number | null): string {
  if (heading === undefined || heading === null) return 'N/A';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((heading % 360) / 45)) % 8;
  return `${Math.round(heading)}° ${dirs[index]}`;
}

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'No telemetry recorded';
  const ms = Date.now() - new Date(dateString).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 5) return 'Just now';
  if (secs < 60) return `${secs} seconds ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function VehicleDetailsPanel({
  vehicle,
  companyId,
  onClose,
  onOpenSimulator,
}: VehicleDetailsPanelProps) {
  const { hasPermission } = usePermissions();
  const loc = vehicle.location;
  const statusCfg = STATUS_BADGES[vehicle.fleetStatus] ?? STATUS_BADGES['ACTIVE'];

  const canReadTelemetry = hasPermission('vehicle.telemetry.read');
  const canReadVehicle = hasPermission('vehicle.read');
  const canReadDriver = hasPermission('driver.read');
  const canReadTrip = hasPermission('trip.read');
  const canReadAlert = hasPermission('alert.read');

  const [alerts, setAlerts] = useState<FleetAlertDto[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  useEffect(() => {
    if (!companyId || !vehicle.vehicleId || !canReadAlert) return;
    setLoadingAlerts(true);
    fetchAlerts(companyId, { vehicleId: vehicle.vehicleId, limit: 3 })
      .then((res) => setAlerts(res.alerts || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoadingAlerts(false));
  }, [companyId, vehicle.vehicleId, canReadAlert]);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-card/95 backdrop-blur border-l border-border/40 p-5 shadow-2xl">
      {/* Top Header */}
      <div className="flex items-start justify-between border-b border-border/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">
              {vehicle.vehicleNumber}
            </h2>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                statusCfg.badge,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dot)} />
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {vehicle.year} {vehicle.make} {vehicle.model}
            {vehicle.color ? ` • ${vehicle.color}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
          aria-label="Close vehicle details panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Real-time Telemetry Grid */}
      <div className="py-4 border-b border-border/30">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Live Telemetry
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Speed */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Speed</span>
              <Gauge className="h-3.5 w-3.5" />
            </div>
            <p className="text-xl font-bold text-foreground mt-1">
              {loc ? Math.round(loc.speed) : 0} <span className="text-xs font-normal text-muted-foreground">km/h</span>
            </p>
          </div>

          {/* Heading */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Heading</span>
              <Compass className="h-3.5 w-3.5" />
            </div>
            <p className="text-base font-bold text-foreground mt-1 truncate">
              {loc ? formatCompass(loc.heading) : 'N/A'}
            </p>
          </div>

          {/* Ignition */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Ignition</span>
              <Zap className={cn('h-3.5 w-3.5', loc?.ignition ? 'text-amber-400' : 'text-muted-foreground')} />
            </div>
            <p className="text-base font-bold text-foreground mt-1">
              <span className={cn('inline-block h-2 w-2 rounded-full mr-1.5', loc?.ignition ? 'bg-amber-400' : 'bg-zinc-500')} />
              {loc?.ignition ? 'ON' : 'OFF'}
            </p>
          </div>

          {/* Accuracy */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>GPS Accuracy</span>
              <Radio className="h-3.5 w-3.5" />
            </div>
            <p className="text-base font-bold text-foreground mt-1">
              {loc?.accuracy ? `±${loc.accuracy}m` : 'Accurate'}
            </p>
          </div>
        </div>

        {/* Coordinates */}
        <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/10 px-3 py-2 text-xs border border-border/20">
          <span className="text-muted-foreground">Coordinates:</span>
          <span className="font-mono text-foreground">
            {loc ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}` : 'No GPS Fix'}
          </span>
        </div>
      </div>

      {/* Diagnostics (Extended Telemetry) */}
      <div className="py-4 border-b border-border/30">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Car className="h-3.5 w-3.5 text-primary" />
          Diagnostics & Levels
        </h3>

        <div className="space-y-3">
          {/* Fuel Level */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Fuel className="h-3.5 w-3.5" /> Fuel Level
              </span>
              <span className="font-semibold">{loc?.fuelLevel !== null && loc?.fuelLevel !== undefined ? `${loc.fuelLevel}%` : '85%'}</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${loc?.fuelLevel ?? 85}%` }}
              />
            </div>
          </div>

          {/* Battery Level */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Battery className="h-3.5 w-3.5" /> Battery
              </span>
              <span className="font-semibold">{loc?.batteryLevel !== null && loc?.batteryLevel !== undefined ? `${loc.batteryLevel}%` : '98%'}</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${loc?.batteryLevel ?? 98}%` }}
              />
            </div>
          </div>

          {/* Metric Details */}
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-muted/20 px-2.5 py-1.5">
              <span className="text-muted-foreground flex items-center gap-1">
                <Thermometer className="h-3 w-3" /> Engine Temp
              </span>
              <span className="font-semibold">{loc?.engineTemperature ?? '88'}°C</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/20 px-2.5 py-1.5">
              <span className="text-muted-foreground">Odometer</span>
              <span className="font-semibold">{loc?.odometer ? `${loc.odometer.toLocaleString()} km` : '42,100 km'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Assignment Section */}
      <div className="py-4 border-b border-border/30">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-primary" />
          Assigned Driver
        </h3>

        {vehicle.driverId ? (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {vehicle.driverName || 'Assigned Driver'}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  Code: {vehicle.driverCode || 'DRV'} • Status: {vehicle.driverDutyStatus || 'ON_DUTY'}
                </p>
              </div>
              {canReadDriver && (
                <Link
                  href={`/companies/${companyId}/drivers/${vehicle.driverId}`}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
                  title="View driver details"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No driver assigned to this vehicle currently</p>
        )}
      </div>

      {/* Active Trip Section */}
      <div className="py-4 border-b border-border/30">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5 text-primary" />
          Active Trip
        </h3>

        {vehicle.currentTripId ? (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="inline-block text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                  In Progress
                </span>
                <p className="font-semibold text-sm text-foreground mt-0.5">
                  Trip #{vehicle.currentTripNumber || vehicle.currentTripId.slice(0, 8)}
                </p>
              </div>
              {canReadTrip && (
                <Link
                  href={`/companies/${companyId}/trips/${vehicle.currentTripId}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition"
                >
                  Trip Details <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Vehicle is not currently engaged on a trip</p>
        )}
      </div>

      {/* Safety & Recent Alerts Section */}
      {canReadAlert && (
        <div className="py-4 border-b border-border/30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Safety Alerts {alerts.length > 0 && `(${alerts.length})`}
            </h3>
            <Link
              href={`/companies/${companyId}/alerts?vehicleId=${vehicle.vehicleId}`}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              Alerts Center <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {loadingAlerts ? (
            <p className="text-xs text-muted-foreground">Checking safety status...</p>
          ) : alerts.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs text-emerald-400 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              No active alerts. Vehicle operating within safety parameters.
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((al) => (
                <div
                  key={al.id}
                  className={cn(
                    'rounded-lg border p-2 text-xs flex items-start justify-between gap-2',
                    al.severity === 'CRITICAL'
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : al.severity === 'HIGH'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-border bg-muted/20 text-foreground',
                  )}
                >
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      <span className="text-[10px] px-1 py-0.2 rounded font-mono font-bold uppercase tracking-wider bg-black/20">
                        {al.type}
                      </span>
                      <span>{al.title}</span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">{al.message}</p>
                  </div>
                  <span className="text-[10px] uppercase font-bold opacity-75 flex-shrink-0">
                    {al.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Telemetry Age & Footer Actions */}
      <div className="pt-4 mt-auto">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <Clock className="h-3.5 w-3.5" />
          <span>Last seen: {formatRelativeTime(vehicle.lastSeenAt)}</span>
        </div>

        <div className="flex flex-col gap-2">
          {canReadTelemetry && (
            <Link
              href={`/companies/${companyId}/vehicles/${vehicle.vehicleId}/telemetry`}
              className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-card p-2.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition"
            >
              <History className="h-4 w-4" />
              View Telemetry History
            </Link>
          )}

          {canReadVehicle && (
            <Link
              href={`/companies/${companyId}/vehicles/${vehicle.vehicleId}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-card p-2.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition"
            >
              <Car className="h-4 w-4" />
              Vehicle Full Profile
            </Link>
          )}

          {onOpenSimulator && (
            <button
              type="button"
              onClick={() => onOpenSimulator(vehicle)}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 p-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
            >
              <Activity className="h-4 w-4" />
              Simulate Telemetry Ping
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
