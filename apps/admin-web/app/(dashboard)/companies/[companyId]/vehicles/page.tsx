'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { useCompany } from '@/lib/company/company-context';
import { vehicleApi } from '@/lib/vehicle/vehicle-api';
import type { VehicleSummaryDto, VehicleStatsDto } from '@ai-mos/types';
import {
  Car, Plus, Search, ChevronLeft, ChevronRight,
  MoreVertical, Loader2, AlertCircle, X,
  Wrench, RefreshCw, TrendingUp, FileWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';
import { PermissionGate } from '@/components/auth/permission-gate';

// ─── Config maps ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  ACTIVE:      { label: 'Active',      dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  INACTIVE:    { label: 'Inactive',    dot: 'bg-slate-400',   badge: 'text-slate-400   bg-slate-400/10   border-slate-400/20'   },
  MAINTENANCE: { label: 'Maintenance', dot: 'bg-amber-400',   badge: 'text-amber-400   bg-amber-400/10   border-amber-400/20'   },
  ON_TRIP:     { label: 'On Trip',     dot: 'bg-blue-400',    badge: 'text-blue-400    bg-blue-400/10    border-blue-400/20'    },
  RETIRED:     { label: 'Retired',     dot: 'bg-red-400',     badge: 'text-red-400     bg-red-400/10     border-red-400/20'     },
};

const FUEL_LABEL: Record<string, string> = {
  PETROL: 'Petrol', DIESEL: 'Diesel', ELECTRIC: 'Electric',
  HYBRID: 'Hybrid', CNG: 'CNG', LPG: 'LPG', OTHER: 'Other',
};

const OWN_LABEL: Record<string, string> = {
  OWNED: 'Owned', LEASED: 'Leased', RENTED: 'Rented',
};

const STATUSES  = Object.keys(STATUS_CONFIG);
const FUELS     = Object.keys(FUEL_LABEL);
const OWNERSHIPS = Object.keys(OWN_LABEL);

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: number; color: string;
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

// ─── Vehicle row ─────────────────────────────────────────────────────────────
function VehicleRow({
  vehicle, companyId, canManage, onStatusChange, onDelete,
}: {
  vehicle: VehicleSummaryDto;
  companyId: string;
  canManage: boolean;
  onStatusChange: (_id: string, _status: string) => Promise<void>;
  onDelete: (_id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const sc = STATUS_CONFIG[vehicle.status] ?? STATUS_CONFIG['ACTIVE']!;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleStatus = async (status: string) => {
    setBusy(true);
    setOpen(false);
    try { await onStatusChange(vehicle.id, status); } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirm(`Delete vehicle ${vehicle.vehicleNumber}? This cannot be undone.`)) return;
    setBusy(true);
    setOpen(false);
    try { await onDelete(vehicle.id); } finally { setBusy(false); }
  };

  // Check if registration/insurance is expiring soon (≤30 days)
  const isExpiringSoon = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const diff = new Date(dateStr).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };
  const regExpiring = isExpiringSoon(vehicle.registrationExpiry);
  const insExpiring = isExpiringSoon(vehicle.insuranceExpiry);

  return (
    <tr
      className={cn('group border-b border-border/20 transition-colors hover:bg-muted/30 cursor-pointer', busy && 'opacity-60')}
      onClick={() => router.push(`/companies/${companyId}/vehicles/${vehicle.id}`)}
    >
      {/* Vehicle */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Car className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{vehicle.vehicleNumber}</p>
            <p className="text-xs text-muted-foreground">{vehicle.make} {vehicle.model} · {vehicle.year}</p>
          </div>
        </div>
      </td>

      {/* Fuel + Ownership */}
      <td className="hidden px-4 py-3 sm:table-cell">
        <p className="text-sm text-foreground">{FUEL_LABEL[vehicle.fuelType] ?? vehicle.fuelType}</p>
        <p className="text-xs text-muted-foreground">{OWN_LABEL[vehicle.ownership] ?? vehicle.ownership}</p>
      </td>

      {/* Odometer */}
      <td className="hidden px-4 py-3 lg:table-cell">
        <p className="text-sm text-foreground">{vehicle.odometer.toLocaleString()} km</p>
      </td>

      {/* Expiry warnings */}
      <td className="hidden px-4 py-3 md:table-cell">
        <div className="flex flex-col gap-1">
          {regExpiring && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <FileWarning className="h-3 w-3" /> Reg expiring
            </span>
          )}
          {insExpiring && (
            <span className="flex items-center gap-1 text-[10px] text-orange-400">
              <FileWarning className="h-3 w-3" /> Ins expiring
            </span>
          )}
          {!regExpiring && !insExpiring && (
            <span className="text-xs text-muted-foreground/50">—</span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium', sc.badge)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
          {sc.label}
        </span>
      </td>

      {/* Actions */}
      {canManage && (
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="relative flex justify-end" ref={ref}>
            {busy
              ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              : (
                <button
                  id={`vehicle-menu-${vehicle.id}`}
                  onClick={() => setOpen((o) => !o)}
                  className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                >
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              )
            }
            {open && (
              <div className="absolute right-0 top-6 z-20 min-w-[160px] rounded-lg border border-border bg-card p-1 shadow-xl">
                <PermissionGate permission="vehicle.status.write">
                  {STATUSES.filter(s => s !== vehicle.status).map(s => (
                    <button
                      key={s}
                      className="w-full rounded px-3 py-1.5 text-left text-xs hover:bg-muted"
                      onClick={() => handleStatus(s)}
                    >
                      Set {STATUS_CONFIG[s]?.label ?? s}
                    </button>
                  ))}
                </PermissionGate>
                <PermissionGate permission="vehicle.delete">
                  <hr className="my-1 border-border/30" />
                  <button
                    className="w-full rounded px-3 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                </PermissionGate>
              </div>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VehiclesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { accessToken } = useAuth();
  const { companies, activeCompany, setActiveCompany } = useCompany();

  const [vehicles, setVehicles]   = useState<VehicleSummaryDto[]>([]);
  const [stats, setStats]         = useState<VehicleStatsDto | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState('');
  const [fuelType, setFuelType]   = useState('');
  const [ownership, setOwnership] = useState('');

  const membership = companies.find(c => c.id === companyId);
  const canManage  = ['OWNER', 'ADMIN', 'MANAGER'].includes(membership?.role ?? '');

  // Sync active company
  useEffect(() => {
    const found = companies.find(c => c.id === companyId);
    if (found && (!activeCompany || activeCompany.id !== companyId)) setActiveCompany(found);
  }, [companyId, companies]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async (p = 1) => {
    if (!accessToken || !companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        vehicleApi.list(accessToken, companyId, { page: p, limit: 20, search: search || undefined, status: status || undefined, fuelType: fuelType || undefined, ownership: ownership || undefined }),
        vehicleApi.stats(accessToken, companyId),
      ]);
      setVehicles(list.vehicles);
      setTotal(list.total);
      setTotalPages(list.totalPages);
      setPage(list.page);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, search, status, fuelType, ownership]);

  useEffect(() => { void fetchData(1); }, [fetchData]);

  const handleStatusChange = async (id: string, s: string) => {
    if (!accessToken) return;
    await vehicleApi.updateStatus(accessToken, companyId, id, s);
    await fetchData(page);
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    await vehicleApi.remove(accessToken, companyId, id);
    await fetchData(page);
  };

  return (
    <RouteGuard requiredPermission="vehicle.read" requireCompany>
      <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Vehicles</h1>
            <p className="text-xs text-muted-foreground">{total} vehicle{total !== 1 ? 's' : ''} total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(page)}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <PermissionGate permission="vehicle.create">
            <Link
              href={`/companies/${companyId}/vehicles/new`}
              id="add-vehicle-btn"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Vehicle
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={Car}         label="Total"       value={stats.total}       color="bg-primary/10 text-primary" />
          <StatCard icon={TrendingUp}  label="Active"      value={stats.active}      color="bg-emerald-400/10 text-emerald-400" />
          <StatCard icon={Car}         label="On Trip"     value={stats.onTrip}      color="bg-blue-400/10 text-blue-400" />
          <StatCard icon={Wrench}      label="Maintenance" value={stats.maintenance}  color="bg-amber-400/10 text-amber-400" />
          <StatCard icon={Car}         label="Inactive"    value={stats.inactive}    color="bg-slate-400/10 text-slate-400" />
          <StatCard icon={FileWarning} label="Docs Expiring" value={stats.expiringSoon} color="bg-orange-400/10 text-orange-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="vehicle-search"
            type="text"
            placeholder="Search by number, make, model…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-card/50 pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <select
          id="vehicle-status-filter"
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="rounded-lg border border-border bg-card/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
          ))}
        </select>

        <select
          id="vehicle-fuel-filter"
          value={fuelType}
          onChange={e => setFuelType(e.target.value)}
          className="rounded-lg border border-border bg-card/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Fuel Types</option>
          {FUELS.map(f => (
            <option key={f} value={f}>{FUEL_LABEL[f]}</option>
          ))}
        </select>

        <select
          id="vehicle-ownership-filter"
          value={ownership}
          onChange={e => setOwnership(e.target.value)}
          className="rounded-lg border border-border bg-card/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Ownership</option>
          {OWNERSHIPS.map(o => (
            <option key={o} value={o}>{OWN_LABEL[o]}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => fetchData(page)} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <Car className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">No vehicles found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || status || fuelType || ownership ? 'Try adjusting your filters.' : 'Add your first vehicle to get started.'}
              </p>
            </div>
            {canManage && !search && !status && !fuelType && !ownership && (
              <Link
                href={`/companies/${companyId}/vehicles/new`}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> Add Vehicle
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Vehicle</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:table-cell">Fuel / Ownership</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground lg:table-cell">Odometer</th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground md:table-cell">Alerts</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  {canManage && <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => (
                  <VehicleRow
                    key={v.id}
                    vehicle={v}
                    companyId={companyId}
                    canManage={canManage}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground text-xs">
            Page {page} of {totalPages} · {total} vehicles
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(page - 1)}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-muted"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </button>
            <button
              onClick={() => fetchData(page + 1)}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-muted"
            >
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
      </div>
    </RouteGuard>
  );
}
