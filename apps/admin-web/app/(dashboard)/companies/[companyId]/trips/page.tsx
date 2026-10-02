'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { tripApi } from '@/lib/trip/trip-api';
import type { TripSummaryDto, TripStatsDto } from '@ai-mos/types';
import {
  Route,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Loader2,
  AlertCircle,
  Clock,
  Car,
  UserCheck,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  Radio,
  Zap,
} from 'lucide-react';
import { PermissionGate } from '@/components/auth/permission-gate';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
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

const STATUSES = Object.keys(STATUS_CONFIG);

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/30 bg-card/50 p-4 backdrop-blur">
      <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

// ─── Trip Row ────────────────────────────────────────────────────────────────
function TripRow({
  trip,
  companyId,
  onDispatch,
  onDelete,
}: {
  trip: TripSummaryDto;
  companyId: string;
  onDispatch: (_id: string) => Promise<void>;
  onDelete: (_id: string) => Promise<void>;
}) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const sc = STATUS_CONFIG[trip.status] ?? STATUS_CONFIG['SCHEDULED']!;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDispatch = async () => {
    setBusy(true);
    setOpen(false);
    try { await onDispatch(trip.id); } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete trip ${trip.tripNumber}?`)) return;
    setBusy(true);
    setOpen(false);
    try { await onDelete(trip.id); } finally { setBusy(false); }
  };

  const startTime = new Date(trip.scheduledStartTime);
  const canDispatchTrip =
    hasPermission('trip.dispatch') &&
    trip.driverId &&
    trip.vehicleId &&
    ['SCHEDULED', 'DRIVER_ASSIGNED', 'VEHICLE_ASSIGNED'].includes(trip.status);
  const canDeleteTrip = hasPermission('trip.delete');

  return (
    <tr
      onClick={() => router.push(`/companies/${companyId}/trips/${trip.id}`)}
      className="cursor-pointer border-b border-border/20 hover:bg-muted/30 transition-colors"
    >
      {/* Trip # & Type */}
      <td className="px-4 py-3">
        <div className="font-semibold text-foreground">{trip.tripNumber}</div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
          {trip.tripType.replace(/_/g, ' ')}
        </div>
      </td>

      {/* Origin & Destination */}
      <td className="px-4 py-3 text-xs max-w-[240px]">
        <div className="truncate text-foreground font-medium flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="truncate">{trip.originAddress}</span>
        </div>
        <div className="truncate text-muted-foreground flex items-center gap-1 mt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 flex-shrink-0" />
          <span className="truncate">{trip.destinationAddress}</span>
        </div>
      </td>

      {/* Scheduled Time */}
      <td className="px-4 py-3 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          {startTime.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
        <div className="text-muted-foreground pl-5">
          {startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </div>
      </td>

      {/* Driver */}
      <td className="px-4 py-3 text-xs">
        {trip.driver ? (
          <div>
            <div className="font-medium text-foreground flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              <span>{trip.driver.employee?.firstName} {trip.driver.employee?.lastName}</span>
            </div>
            <div className="text-[11px] text-muted-foreground pl-4.5">
              Code: {trip.driver.driverCode}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground italic text-xs">Unassigned</span>
        )}
      </td>

      {/* Vehicle */}
      <td className="px-4 py-3 text-xs">
        {trip.vehicle ? (
          <div>
            <div className="font-medium text-foreground flex items-center gap-1">
              <Car className="h-3.5 w-3.5 text-primary" />
              <span>{trip.vehicle.vehicleNumber}</span>
            </div>
            <div className="text-[11px] text-muted-foreground pl-4.5">
              {trip.vehicle.make} {trip.vehicle.model}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground italic text-xs">Unassigned</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', sc.badge)}>
          {sc.label}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="relative inline-block" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </button>

          {open && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-border/50 bg-popover p-1 shadow-xl text-left">
              <button
                onClick={() => {
                  setOpen(false);
                  router.push(`/companies/${companyId}/trips/${trip.id}`);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                View Trip
              </button>

              {canDispatchTrip && (
                <button
                  onClick={handleDispatch}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-primary hover:bg-primary/10"
                >
                  <Send className="h-3.5 w-3.5" />
                  Dispatch Trip
                </button>
              )}

              {canDeleteTrip && (
                <>
                  <div className="my-1 border-t border-border/50" />
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-red-400 hover:bg-red-400/10"
                  >
                    Delete Trip
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Trips Page ─────────────────────────────────────────────────────────
export default function TripsPage() {
  return (
    <RouteGuard requiredPermission="trip.read">
      <TripsContent />
    </RouteGuard>
  );
}

function TripsContent() {
  const { companyId } = useParams<{ companyId: string }>();
  const { accessToken } = useAuth();

  const [trips, setTrips] = useState<TripSummaryDto[]>([]);
  const [stats, setStats] = useState<TripStatsDto | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = useCallback(async () => {
    if (!accessToken || !companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([
        tripApi.list(accessToken, companyId, {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
        }),
        tripApi.stats(accessToken, companyId),
      ]);
      setTrips(list.trips);
      setTotal(list.total);
      setTotalPages(list.totalPages);
      setStats(st);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, page, search, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDispatch = async (id: string) => {
    if (!accessToken || !companyId) return;
    await tripApi.dispatch(accessToken, companyId, id);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !companyId) return;
    await tripApi.delete(accessToken, companyId, id);
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Trips</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage fleet trips, dispatches, and status updates</p>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate permission="trip.dispatch">
            <Link
              href={`/companies/${companyId}/dispatch`}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/20"
            >
              <Radio className="h-4 w-4" />
              Dispatch Board
            </Link>
          </PermissionGate>
          <PermissionGate permission="trip.create">
            <Link
              href={`/companies/${companyId}/trips/new`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Trip
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          <StatCard icon={Route} label="Total" value={stats.total} color="bg-indigo-500/10 text-indigo-400" />
          <StatCard icon={Clock} label="Scheduled" value={stats.scheduled} color="bg-amber-500/10 text-amber-400" />
          <StatCard icon={UserCheck} label="Assigned" value={stats.assigned} color="bg-cyan-500/10 text-cyan-400" />
          <StatCard icon={Send} label="Dispatched" value={stats.dispatched} color="bg-purple-500/10 text-purple-400" />
          <StatCard icon={Zap} label="Active" value={stats.active} color="bg-blue-500/10 text-blue-400" />
          <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} color="bg-emerald-500/10 text-emerald-400" />
          <StatCard icon={XCircle} label="Cancelled" value={stats.cancelled} color="bg-rose-500/10 text-rose-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search trip #, route, driver, or vehicle..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-border/40 bg-card/40 pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-border/40 bg-card/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>
          ))}
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border/30 bg-card/30 overflow-hidden shadow-sm backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/30 bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Trip #</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Scheduled</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    <span className="mt-2 block text-xs">Loading trips...</span>
                  </td>
                </tr>
              ) : trips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Route className="mx-auto h-8 w-8 opacity-30" />
                    <p className="mt-2 text-sm">No trips found</p>
                    {search || statusFilter ? (
                      <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                    ) : (
                      <PermissionGate permission="trip.create">
                        <Link
                          href={`/companies/${companyId}/trips/new`}
                          className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
                        >
                          Create your first trip
                        </Link>
                      </PermissionGate>
                    )}
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <TripRow
                    key={trip.id}
                    trip={trip}
                    companyId={companyId}
                    onDispatch={handleDispatch}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/30 px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} trips
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
