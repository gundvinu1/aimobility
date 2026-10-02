'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { driverApi } from '@/lib/driver/driver-api';
import type { DriverSummaryDto, DriverStatsDto } from '@ai-mos/types';
import {
  UserCheck, Plus, Search, ChevronLeft, ChevronRight,
  MoreVertical, Loader2, AlertCircle, X,
  Car, Shield, Clock, AlertTriangle, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';
import { PermissionGate } from '@/components/auth/permission-gate';
import { usePermissions } from '@/lib/auth/use-permissions';

// ─── Status Configs ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  ACTIVE:     { label: 'Active',     badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  INACTIVE:   { label: 'Inactive',   badge: 'text-slate-400   bg-slate-400/10   border-slate-400/20'   },
  SUSPENDED:  { label: 'Suspended',  badge: 'text-amber-400   bg-amber-400/10   border-amber-400/20'   },
  TERMINATED: { label: 'Terminated', badge: 'text-red-400     bg-red-400/10     border-red-400/20'     },
};

const DUTY_STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  OFF_DUTY:    { label: 'Off Duty',    dot: 'bg-slate-400',   badge: 'text-slate-400   bg-slate-400/10   border-slate-400/20'   },
  ON_DUTY:     { label: 'On Duty',     dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  ON_TRIP:     { label: 'On Trip',     dot: 'bg-blue-400',    badge: 'text-blue-400    bg-blue-400/10    border-blue-400/20'    },
  ON_BREAK:    { label: 'On Break',    dot: 'bg-amber-400',   badge: 'text-amber-400   bg-amber-400/10   border-amber-400/20'   },
  UNAVAILABLE: { label: 'Unavailable', dot: 'bg-rose-400',    badge: 'text-rose-400    bg-rose-400/10    border-rose-400/20'    },
};

const STATUSES     = Object.keys(STATUS_CONFIG);
const DUTY_STATUSES = Object.keys(DUTY_STATUS_CONFIG);

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

// ─── License Expiry Badge ────────────────────────────────────────────────────
function LicenseExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded">
        <AlertTriangle className="h-3 w-3" /> Expired
      </span>
    );
  }
  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-400/10 border border-rose-400/20 px-1.5 py-0.5 rounded">
        <AlertTriangle className="h-3 w-3" /> Exp in {diffDays}d
      </span>
    );
  }
  if (diffDays <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
        <Clock className="h-3 w-3" /> Exp in {diffDays}d
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">
      {expiry.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
    </span>
  );
}

// ─── Driver Row ──────────────────────────────────────────────────────────────
function DriverRow({
  driver,
  companyId,
  canManage,
  onStatusChange,
  onDutyStatusChange,
  onDelete,
}: {
  driver: DriverSummaryDto;
  companyId: string;
  canManage: boolean;
  onStatusChange: (_id: string, _status: string) => Promise<void>;
  onDutyStatusChange: (_id: string, _dutyStatus: string) => Promise<void>;
  onDelete: (_id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const sc = STATUS_CONFIG[driver.status] ?? STATUS_CONFIG['ACTIVE']!;
  const dsc = DUTY_STATUS_CONFIG[driver.dutyStatus] ?? DUTY_STATUS_CONFIG['OFF_DUTY']!;

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
    try { await onStatusChange(driver.id, status); } finally { setBusy(false); }
  };

  const handleDuty = async (dutyStatus: string) => {
    setBusy(true);
    setOpen(false);
    try { await onDutyStatusChange(driver.id, dutyStatus); } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete driver ${driver.driverCode}? This will soft-delete the driver.`)) return;
    setBusy(true);
    setOpen(false);
    try { await onDelete(driver.id); } finally { setBusy(false); }
  };

  const employeeName = driver.employee
    ? `${driver.employee.firstName} ${driver.employee.lastName}`
    : 'No linked employee';

  return (
    <tr
      className={cn(
        'group border-b border-border/20 transition-colors hover:bg-muted/30 cursor-pointer',
        busy && 'opacity-60',
      )}
      onClick={() => router.push(`/companies/${companyId}/drivers/${driver.id}`)}
    >
      {/* Driver info */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {driver.driverCode}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {employeeName}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {driver.employee?.phone ?? 'No phone recorded'}
            </p>
          </div>
        </div>
      </td>

      {/* License */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono font-medium text-foreground">{driver.licenseNumber}</span>
            <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-semibold">
              {driver.licenseType}
            </span>
          </div>
          <div className="mt-0.5">
            <LicenseExpiryBadge expiryDate={driver.licenseExpiryDate} />
          </div>
        </div>
      </td>

      {/* Duty Status */}
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
            dsc.badge,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', dsc.dot)} />
          {dsc.label}
        </span>
      </td>

      {/* Operational Status */}
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
            sc.badge,
          )}
        >
          {sc.label}
        </span>
      </td>

      {/* Assigned Vehicle */}
      <td className="px-4 py-3">
        {driver.assignedVehicle ? (
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <Car className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="font-medium">{driver.assignedVehicle.vehicleNumber}</span>
            <span className="text-muted-foreground">
              ({driver.assignedVehicle.make} {driver.assignedVehicle.model})
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">None</span>
        )}
      </td>

      {/* Experience / Joining */}
      <td className="px-4 py-3 text-xs text-muted-foreground">
        <div>{driver.experienceYears} yrs exp</div>
        <div className="text-[11px]">
          Joined {new Date(driver.joiningDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        {canManage && (
          <div className="relative inline-block" ref={ref}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {open && (
              <div className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-border bg-popover p-1 shadow-xl text-left">
                <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                  Duty Status
                </p>
                <PermissionGate permission="driver.duty.update">
                  {DUTY_STATUSES.map((ds) => (
                    <button
                      key={ds}
                      onClick={() => handleDuty(ds)}
                      disabled={driver.dutyStatus === ds}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', DUTY_STATUS_CONFIG[ds]?.dot)} />
                      {DUTY_STATUS_CONFIG[ds]?.label}
                    </button>
                  ))}
                </PermissionGate>

                <div className="my-1 border-t border-border/50" />
                <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                  Driver Status
                </p>
                <PermissionGate permission="driver.status.update">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatus(s)}
                      disabled={driver.status === s}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
                    >
                      {STATUS_CONFIG[s]?.label}
                    </button>
                  ))}
                </PermissionGate>

                <PermissionGate permission="driver.delete">
                  <div className="my-1 border-t border-border/50" />
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center rounded-lg px-2 py-1.5 text-xs text-red-400 hover:bg-red-400/10"
                  >
                    Delete Driver
                  </button>
                </PermissionGate>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Main Drivers Page ───────────────────────────────────────────────────────
export default function DriversPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { accessToken } = useAuth();

  const [drivers, setDrivers] = useState<DriverSummaryDto[]>([]);
  const [stats, setStats] = useState<DriverStatsDto | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dutyFilter, setDutyFilter] = useState('');

  const { hasPermission } = usePermissions();
  const canManage = hasPermission('driver.update') || hasPermission('driver.create');

  const loadData = useCallback(async () => {
    if (!accessToken || !companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([
        driverApi.list(accessToken, companyId, {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
          dutyStatus: dutyFilter || undefined,
        }),
        driverApi.stats(accessToken, companyId),
      ]);
      setDrivers(list.drivers);
      setTotal(list.total);
      setTotalPages(list.totalPages);
      setStats(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, page, search, statusFilter, dutyFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (id: string, status: string) => {
    if (!accessToken || !companyId) return;
    await driverApi.updateStatus(accessToken, companyId, id, status);
    loadData();
  };

  const handleDutyStatusChange = async (id: string, dutyStatus: string) => {
    if (!accessToken || !companyId) return;
    await driverApi.updateDutyStatus(accessToken, companyId, id, dutyStatus);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !companyId) return;
    await driverApi.remove(accessToken, companyId, id);
    loadData();
  };

  return (
    <RouteGuard requiredPermission="driver.read" requireCompany>
      <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Drivers</h1>
          <p className="text-xs text-muted-foreground">
            Manage company drivers, license compliance, duty shifts, and vehicle assignments
          </p>
        </div>
        <PermissionGate permission="driver.create">
          <Link
            href={`/companies/${companyId}/drivers/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Driver
          </Link>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={UserCheck} label="Total Drivers" value={stats.total} color="bg-primary/10 text-primary" />
          <StatCard icon={Shield} label="Active" value={stats.active} color="bg-emerald-500/10 text-emerald-400" />
          <StatCard icon={Clock} label="On Duty" value={stats.onDuty} color="bg-emerald-500/10 text-emerald-400" />
          <StatCard icon={Car} label="On Trip" value={stats.onTrip} color="bg-blue-500/10 text-blue-400" />
          <StatCard icon={Clock} label="Off Duty" value={stats.offDuty} color="bg-slate-500/10 text-slate-400" />
          <StatCard
            icon={AlertTriangle}
            label="Expiring Licenses"
            value={stats.expiringLicenses}
            color={stats.expiringLicenses > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-muted text-muted-foreground'}
          />
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/30 bg-card/40 p-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search code, license, employee name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-border/50 bg-background/80 py-1.5 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-border/50 bg-background/80 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>
          ))}
        </select>

        {/* Duty Status filter */}
        <select
          value={dutyFilter}
          onChange={(e) => { setDutyFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-border/50 bg-background/80 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Duty Statuses</option>
          {DUTY_STATUSES.map((ds) => (
            <option key={ds} value={ds}>{DUTY_STATUS_CONFIG[ds]?.label}</option>
          ))}
        </select>

        {(search || statusFilter || dutyFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setDutyFilter(''); setPage(1); }}
            className="text-xs text-primary hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border/30 bg-card/40">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
            <UserCheck className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No drivers found</p>
            <p className="text-xs text-muted-foreground">
              {search || statusFilter || dutyFilter
                ? 'Try clearing filters to find drivers'
                : 'Get started by registering your first driver.'}
            </p>
            {canManage && !search && !statusFilter && !dutyFilter && (
              <Link
                href={`/companies/${companyId}/drivers/new`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Driver
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/30 bg-muted/20 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Driver & Employee</th>
                  <th className="px-4 py-3">License & Expiry</th>
                  <th className="px-4 py-3">Duty Status</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned Vehicle</th>
                  <th className="px-4 py-3">Experience</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <DriverRow
                    key={d.id}
                    driver={d}
                    companyId={companyId}
                    canManage={canManage}
                    onStatusChange={handleStatusChange}
                    onDutyStatusChange={handleDutyStatusChange}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/20 px-4 py-3 text-xs text-muted-foreground">
            <span>
              Page {page} of {totalPages} · {total} total drivers
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </RouteGuard>
  );
}
