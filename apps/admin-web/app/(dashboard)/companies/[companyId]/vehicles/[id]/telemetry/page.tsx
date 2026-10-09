'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { RouteGuard } from '@/components/auth/route-guard';
import { trackingApi } from '@/lib/tracking/tracking-api';
import { vehicleApi } from '@/lib/vehicle/vehicle-api';
import type {
  VehicleTelemetryDto,
  VehicleDto,
} from '@ai-mos/types';
import {
  History,
  ArrowLeft,
  Navigation,
  Zap,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TIME_WINDOWS = [
  { label: 'Last 1 Hour', hours: 1 },
  { label: 'Last 6 Hours', hours: 6 },
  { label: 'Last 24 Hours', hours: 24 },
  { label: 'Last 7 Days', hours: 168 },
] as const;

const SOURCES = ['ALL', 'API', 'GPS_DEVICE', 'MOBILE', 'IOT', 'SIMULATOR', 'MANUAL'] as const;

export default function VehicleTelemetryHistoryPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';
  const vehicleId = (params?.['id'] as string) || (params?.['vehicleId'] as string) || '';
  const { accessToken } = useAuth();

  const [vehicle, setVehicle] = useState<VehicleDto | null>(null);
  const [telemetry, setTelemetry] = useState<VehicleTelemetryDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [windowHours, setWindowHours] = useState<number>(24);
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load vehicle details
  useEffect(() => {
    if (!companyId || !vehicleId || !accessToken) return;
    vehicleApi
      .get(accessToken, companyId, vehicleId)
      .then(setVehicle)
      .catch(() => {});
  }, [companyId, vehicleId, accessToken]);

  // Load telemetry records
  const loadHistory = useCallback(async () => {
    if (!companyId || !vehicleId) return;
    setIsLoading(true);
    setErrorMsg(null);

    const now = new Date();
    const from = new Date(now.getTime() - windowHours * 3600 * 1000).toISOString();

    try {
      const data = await trackingApi.getTelemetryHistory(
        vehicleId,
        {
          page,
          limit,
          from,
          to: now.toISOString(),
          source: selectedSource !== 'ALL' ? selectedSource : undefined,
        },
        companyId,
        accessToken ?? undefined,
      );

      setTelemetry(data.telemetry);
      setTotal(data.total);
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Failed to load telemetry history');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, vehicleId, page, limit, windowHours, selectedSource, accessToken]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const totalPages = Math.ceil(total / limit) || 1;

  // Stats for the current telemetry window
  const stats = useMemo(() => {
    if (telemetry.length === 0) {
      return { maxSpeed: 0, avgSpeed: 0, ignitionOnCount: 0 };
    }
    const speeds = telemetry.map((t) => t.speed);
    const maxSpeed = Math.round(Math.max(...speeds));
    const avgSpeed = Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length);
    const ignitionOnCount = telemetry.filter((t) => t.ignition).length;
    return { maxSpeed, avgSpeed, ignitionOnCount };
  }, [telemetry]);

  return (
    <RouteGuard requiredPermission="vehicle.telemetry.read" requireCompany>
      <div className="flex flex-col min-h-screen p-6 space-y-6 max-w-7xl mx-auto">
        {errorMsg && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3">
            {errorMsg}
          </div>
        )}
        {/* Navigation Breadcrumb & Back */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/companies/${companyId}/tracking`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition shadow-sm"
              title="Back to fleet tracking map"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Telemetry History: {vehicle?.vehicleNumber ?? 'Vehicle'}
                </h1>
                {vehicle && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {vehicle.make} {vehicle.model}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Audit trail of GPS coordinates, speed, heading, and sensor telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/companies/${companyId}/tracking`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition shadow-sm"
            >
              <Navigation className="h-3.5 w-3.5 text-primary" />
              Live Map View
            </Link>
            <button
              type="button"
              onClick={loadHistory}
              disabled={isLoading}
              className="rounded-xl border border-border/40 p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Filters & Time Window Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/40 bg-card/60 backdrop-blur p-4">
          {/* Time Window Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Window:
            </span>
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.hours}
                type="button"
                onClick={() => {
                  setWindowHours(tw.hours);
                  setPage(1);
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                  windowHours === tw.hours
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {tw.label}
              </button>
            ))}
          </div>

          {/* Source and Limit Dropdowns */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium">Source:</span>
              <select
                value={selectedSource}
                onChange={(e) => {
                  setSelectedSource(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium">Rows:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur p-4">
            <span className="text-xs text-muted-foreground">Recorded Events</span>
            <p className="text-2xl font-bold text-foreground mt-1">{total}</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur p-4">
            <span className="text-xs text-muted-foreground">Max Speed</span>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.maxSpeed} <span className="text-xs font-normal text-muted-foreground">km/h</span>
            </p>
          </div>
          <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur p-4">
            <span className="text-xs text-muted-foreground">Avg Speed</span>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.avgSpeed} <span className="text-xs font-normal text-muted-foreground">km/h</span>
            </p>
          </div>
          <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur p-4">
            <span className="text-xs text-muted-foreground">Ignition ON Events</span>
            <p className="text-2xl font-bold text-amber-500 mt-1">
              {stats.ignitionOnCount} <span className="text-xs font-normal text-muted-foreground">/ {telemetry.length}</span>
            </p>
          </div>
        </div>

        {/* Telemetry Event Table */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/30 bg-muted/30 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Coordinates (Lat, Lng)</th>
                  <th className="px-4 py-3">Speed</th>
                  <th className="px-4 py-3">Heading</th>
                  <th className="px-4 py-3">Ignition</th>
                  <th className="px-4 py-3">Diagnostics</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading telemetry events...
                    </td>
                  </tr>
                ) : telemetry.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      No telemetry records found for this time window.
                    </td>
                  </tr>
                ) : (
                  telemetry.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/10 transition">
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-foreground">
                        {new Date(t.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">
                        {Math.round(t.speed)} km/h
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {t.heading !== null && t.heading !== undefined ? `${Math.round(t.heading)}°` : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            t.ignition
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                          )}
                        >
                          <Zap className="h-3 w-3" />
                          {t.ignition ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-[11px]">
                        <div className="flex items-center gap-2">
                          {t.fuelLevel !== null && t.fuelLevel !== undefined && (
                            <span title="Fuel Level">{t.fuelLevel}% fuel</span>
                          )}
                          {t.batteryLevel !== null && t.batteryLevel !== undefined && (
                            <span title="Battery">{t.batteryLevel}% bat</span>
                          )}
                          {t.engineTemperature !== null && t.engineTemperature !== undefined && (
                            <span title="Engine Temp">{t.engineTemperature}°C</span>
                          )}
                          {t.fuelLevel === null && t.batteryLevel === null && t.engineTemperature === null && (
                            <span>Standard GPS</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {t.source}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">
            <div>
              Showing {telemetry.length} of {total} events
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 hover:bg-accent disabled:opacity-40 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 hover:bg-accent disabled:opacity-40 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
