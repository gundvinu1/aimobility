'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { useCompany } from '@/lib/company/company-context';
import { employeeApi } from '@/lib/employee/employee-api';
import type { EmployeeSummaryDto, EmployeeStatsDto } from '@ai-mos/types';
import {
  Users, Plus, Search, ChevronLeft, ChevronRight,
  MoreVertical, Loader2, AlertCircle, X, UserCheck, UserX,
  Clock, TrendingUp, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';
import { PermissionGate } from '@/components/auth/permission-gate';
import { usePermissions } from '@/lib/auth/use-permissions';

// ─── Config maps ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  ACTIVE:     { label: 'Active',     dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  INACTIVE:   { label: 'Inactive',   dot: 'bg-slate-400',   badge: 'text-slate-400   bg-slate-400/10   border-slate-400/20'   },
  ON_LEAVE:   { label: 'On Leave',   dot: 'bg-amber-400',   badge: 'text-amber-400   bg-amber-400/10   border-amber-400/20'   },
  SUSPENDED:  { label: 'Suspended',  dot: 'bg-orange-400',  badge: 'text-orange-400  bg-orange-400/10  border-orange-400/20'  },
  TERMINATED: { label: 'Terminated', dot: 'bg-red-400',     badge: 'text-red-400     bg-red-400/10     border-red-400/20'     },
};

const TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Full-Time', PART_TIME: 'Part-Time',
  CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern',
};

const DEPT_LABEL: Record<string, string> = {
  OPERATIONS: 'Operations', DISPATCH: 'Dispatch', ACCOUNTS: 'Accounts',
  HR: 'HR', SALES: 'Sales', CUSTOMER_SUPPORT: 'Support',
  ADMINISTRATION: 'Admin', MANAGEMENT: 'Management', OTHER: 'Other',
};

const DEPARTMENTS = Object.keys(DEPT_LABEL);
const STATUSES    = Object.keys(STATUS_CONFIG);
const TYPES       = Object.keys(TYPE_LABEL);

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: {
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

// ─── Employee row ─────────────────────────────────────────────────────────────
function EmployeeRow({
  employee, companyId, canManage, onStatusChange, onDelete,
}: {
  employee: EmployeeSummaryDto;
  companyId: string;
  canManage: boolean;
  onStatusChange: (_id: string, _status: string) => Promise<void>;
  onDelete: (_id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const sc = STATUS_CONFIG[employee.employmentStatus] ?? STATUS_CONFIG['ACTIVE'];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function action(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); setOpen(false); }
  }

  return (
    <div className="relative grid grid-cols-[3fr_2fr_2fr_1.5fr_2.5rem] items-center gap-4 border-b border-border/20 px-4 py-3 last:border-0 hover:bg-white/3 transition-colors">
      {/* Employee info */}
      <button
        className="flex items-center gap-3 text-left"
        onClick={() => router.push(`/companies/${companyId}/employees/${employee.id}`)}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-sm font-semibold text-primary select-none">
          {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">
            {employee.displayName ?? `${employee.firstName} ${employee.lastName}`}
          </p>
          <p className="truncate text-xs text-muted-foreground">{employee.email ?? employee.phone}</p>
        </div>
      </button>

      {/* ID + Dept */}
      <div>
        <p className="text-xs font-mono text-muted-foreground">{employee.employeeNumber}</p>
        {employee.department && (
          <p className="text-xs text-foreground/70">{DEPT_LABEL[employee.department] ?? employee.department}</p>
        )}
      </div>

      {/* Designation + Type */}
      <div>
        <p className="text-xs truncate">{employee.designation ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{TYPE_LABEL[employee.employmentType] ?? employee.employmentType}</p>
      </div>

      {/* Status badge */}
      <div>
        <span className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
          sc.badge,
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
          {sc.label}
        </span>
      </div>

      {/* Actions */}
      {canManage && (
        <div ref={ref} className="relative flex justify-end">
          <button
            onClick={() => setOpen(o => !o)}
            className="rounded p-1 hover:bg-white/10 transition-colors"
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
          </button>

          {open && (
            <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-lg border border-border/40 bg-card shadow-xl">
              <PermissionGate permission="employee.status.write">
                {employee.employmentStatus !== 'ACTIVE' && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-emerald-400"
                    onClick={() => action(() => onStatusChange(employee.id, 'ACTIVE'))}
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Activate
                  </button>
                )}
                {employee.employmentStatus !== 'ON_LEAVE' && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-amber-400"
                    onClick={() => action(() => onStatusChange(employee.id, 'ON_LEAVE'))}
                  >
                    <Clock className="h-3.5 w-3.5" /> Set On Leave
                  </button>
                )}
                {employee.employmentStatus !== 'SUSPENDED' && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-orange-400"
                    onClick={() => action(() => onStatusChange(employee.id, 'SUSPENDED'))}
                  >
                    <UserX className="h-3.5 w-3.5" /> Suspend
                  </button>
                )}
                {employee.employmentStatus !== 'TERMINATED' && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-red-400"
                    onClick={() => action(() => onStatusChange(employee.id, 'TERMINATED'))}
                  >
                    <X className="h-3.5 w-3.5" /> Terminate
                  </button>
                )}
              </PermissionGate>
              <PermissionGate permission="employee.delete">
                <div className="my-1 border-t border-border/30" />
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/5"
                  onClick={() => { if (confirm('Delete this employee? This cannot be undone.')) action(() => onDelete(employee.id)); }}
                >
                  <X className="h-3.5 w-3.5" /> Delete
                </button>
              </PermissionGate>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { accessToken } = useAuth();
  const { activeCompany, companies, setActiveCompany } = useCompany();

  const [employees, setEmployees] = useState<EmployeeSummaryDto[]>([]);
  const [stats, setStats] = useState<EmployeeStatsDto | null>(null);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Filters
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [dept, setDept]         = useState('');
  const [type, setType]         = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync activeCompany when navigating to this company
  useEffect(() => {
    if (companyId && (!activeCompany || activeCompany.id !== companyId) && companies.length > 0) {
      const match = companies.find(c => c.id === companyId);
      if (match) setActiveCompany(match);
    }
  }, [companyId, activeCompany, companies, setActiveCompany]);

  const { hasPermission } = usePermissions();
  const canManage = hasPermission('employee.update') || hasPermission('employee.create');

  const load = useCallback(async (p = 1) => {
    if (!accessToken || !companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        employeeApi.list(accessToken, companyId, {
          page: p, limit: 20, search: search || undefined,
          employmentStatus: status || undefined,
          department: dept || undefined,
          employmentType: type || undefined,
          sortBy: 'createdAt', sortOrder: 'desc',
        }),
        employeeApi.stats(accessToken, companyId),
      ]);
      setEmployees(list.employees);
      setTotal(list.total);
      setTotalPages(list.totalPages);
      setPage(list.page);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load employees');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, companyId, search, status, dept, type]);

  useEffect(() => { void load(1); }, [load]);

  function handleSearchChange(v: string) {
    setSearchInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(v), 400);
  }

  async function handleStatusChange(id: string, s: string) {
    if (!accessToken || !companyId) return;
    await employeeApi.updateStatus(accessToken, companyId, id, s);
    await load(page);
  }

  async function handleDelete(id: string) {
    if (!accessToken || !companyId) return;
    await employeeApi.remove(accessToken, companyId, id);
    await load(page);
  }

  return (
    <RouteGuard requiredPermission="employee.read" requireCompany>
      <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Employees
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your company workforce
          </p>
        </div>
        <PermissionGate permission="employee.create">
          <Link
            href={`/companies/${companyId}/employees/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Employee
          </Link>
        </PermissionGate>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
          <StatCard icon={Users}    label="Total"       value={stats.total}      color="bg-primary/10 text-primary" />
          <StatCard icon={UserCheck} label="Active"     value={stats.active}     color="bg-emerald-400/10 text-emerald-400" />
          <StatCard icon={Clock}    label="On Leave"    value={stats.onLeave}    color="bg-amber-400/10 text-amber-400" />
          <StatCard icon={UserX}    label="Inactive"    value={stats.inactive}   color="bg-slate-400/10 text-slate-400" />
          <StatCard icon={TrendingUp} label="New (30d)" value={stats.recentHires} color="bg-sky-400/10 text-sky-400" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search employees…"
            className="w-full rounded-lg border border-border/40 bg-card/50 pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label}</option>)}
        </select>

        {/* Department filter */}
        <select
          value={dept}
          onChange={e => { setDept(e.target.value); setPage(1); }}
          className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABEL[d]}</option>)}
        </select>

        {/* Type filter */}
        <select
          value={type}
          onChange={e => { setType(e.target.value); setPage(1); }}
          className="rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>

        <button
          onClick={() => load(page)}
          className="ml-auto rounded-lg border border-border/40 p-2 hover:bg-white/5 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/30 bg-card/50 backdrop-blur overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[3fr_2fr_2fr_1.5fr_2.5rem] items-center gap-4 border-b border-border/30 bg-white/2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Employee</span>
          <span>ID / Dept</span>
          <span>Role / Type</span>
          <span>Status</span>
          <span />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-20 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm">No employees found</p>
            {canManage && (
              <Link
                href={`/companies/${companyId}/employees/new`}
                className="mt-1 text-xs text-primary hover:underline"
              >
                Add your first employee
              </Link>
            )}
          </div>
        ) : (
          employees.map(e => (
            <EmployeeRow
              key={e.id}
              employee={e}
              companyId={companyId}
              canManage={canManage}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} employee{total !== 1 ? 's' : ''} total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-border/40 p-1.5 hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs">Page {page} of {totalPages}</span>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-border/40 p-1.5 hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      </div>
    </RouteGuard>
  );
}
