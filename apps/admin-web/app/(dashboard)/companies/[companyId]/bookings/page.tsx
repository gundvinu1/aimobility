'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { bookingApi } from '@/lib/booking/booking-api';
import type { BookingSummaryDto, BookingStatsDto } from '@ai-mos/types';
import {
  CalendarDays,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Loader2,
  AlertCircle,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';
import { PermissionGate } from '@/components/auth/permission-gate';
import { usePermissions } from '@/lib/auth/use-permissions';

// ─── Status Configs ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  DRAFT:     { label: 'Draft',     badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  CONFIRMED: { label: 'Confirmed', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  COMPLETED: { label: 'Completed', badge: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  CANCELLED: { label: 'Cancelled', badge: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
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

// ─── Booking Row ─────────────────────────────────────────────────────────────
function BookingRow({
  booking,
  companyId,
  canManage,
  onConfirm,
  onCancel,
  onDelete,
}: {
  booking: BookingSummaryDto;
  companyId: string;
  canManage: boolean;
  onConfirm: (_id: string) => Promise<void>;
  onCancel: (_id: string, _reason?: string) => Promise<void>;
  onDelete: (_id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const sc = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG['DRAFT']!;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleConfirm = async () => {
    setBusy(true);
    setOpen(false);
    try { await onConfirm(booking.id); } finally { setBusy(false); }
  };

  const handleCancel = async () => {
    const reason = prompt('Enter reason for cancellation (optional):') ?? '';
    setBusy(true);
    setOpen(false);
    try { await onCancel(booking.id, reason || undefined); } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete booking ${booking.bookingNumber}? This action is irreversible.`)) return;
    setBusy(true);
    setOpen(false);
    try { await onDelete(booking.id); } finally { setBusy(false); }
  };

  const pickupDate = new Date(booking.pickupTime);

  return (
    <tr
      onClick={() => router.push(`/companies/${companyId}/bookings/${booking.id}`)}
      className="cursor-pointer border-b border-border/20 hover:bg-muted/30 transition-colors"
    >
      {/* Booking # & Source */}
      <td className="px-4 py-3">
        <div className="font-semibold text-foreground">{booking.bookingNumber}</div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
          via {booking.source}
        </div>
      </td>

      {/* Customer Info */}
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-foreground">{booking.customerName}</div>
        <div className="text-xs text-muted-foreground">{booking.customerPhone}</div>
      </td>

      {/* Pickup Date & Time */}
      <td className="px-4 py-3 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          {pickupDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="text-muted-foreground pl-5">
          {pickupDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </div>
      </td>

      {/* Route */}
      <td className="px-4 py-3 text-xs max-w-[220px]">
        <div className="truncate text-foreground font-medium flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="truncate">{booking.pickupAddress}</span>
        </div>
        <div className="truncate text-muted-foreground flex items-center gap-1 mt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 flex-shrink-0" />
          <span className="truncate">{booking.dropoffAddress}</span>
        </div>
      </td>

      {/* Passengers & Fare */}
      <td className="px-4 py-3 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{booking.passengerCount} pax</span>
        </div>
        <div className="font-medium text-foreground mt-0.5">
          {booking.actualFare != null
            ? `$${booking.actualFare.toFixed(2)}`
            : booking.estimatedFare != null
            ? `Est. $${booking.estimatedFare.toFixed(2)}`
            : '—'}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', sc.badge)}>
          {sc.label}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        {canManage && (
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
                    router.push(`/companies/${companyId}/bookings/${booking.id}`);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  View Details
                </button>

                <PermissionGate permission="booking.confirm">
                  {booking.status === 'DRAFT' && (
                    <button
                      onClick={handleConfirm}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-emerald-400 hover:bg-emerald-400/10"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm Booking
                    </button>
                  )}
                </PermissionGate>

                <PermissionGate permission="booking.cancel">
                  {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
                    <button
                      onClick={handleCancel}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-400/10"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel Booking
                    </button>
                  )}
                </PermissionGate>

                <PermissionGate permission="booking.delete">
                  <div className="my-1 border-t border-border/50" />
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-red-400 hover:bg-red-400/10"
                  >
                    Delete Booking
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

// ─── Main Bookings Page ──────────────────────────────────────────────────────
export default function BookingsPage() {
  return (
    <RouteGuard requiredPermission="booking.read">
      <BookingsContent />
    </RouteGuard>
  );
}

function BookingsContent() {
  const { companyId } = useParams<{ companyId: string }>();
  const { accessToken } = useAuth();

  const [bookings, setBookings] = useState<BookingSummaryDto[]>([]);
  const [stats, setStats] = useState<BookingStatsDto | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { hasPermission } = usePermissions();
  const canManage = hasPermission('booking.create') || hasPermission('booking.update');

  const loadData = useCallback(async () => {
    if (!accessToken || !companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([
        bookingApi.list(accessToken, companyId, {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter || undefined,
        }),
        bookingApi.stats(accessToken, companyId),
      ]);
      setBookings(list.bookings);
      setTotal(list.total);
      setTotalPages(list.totalPages);
      setStats(st);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, page, search, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirm = async (id: string) => {
    if (!accessToken || !companyId) return;
    await bookingApi.confirm(accessToken, companyId, id);
    loadData();
  };

  const handleCancel = async (id: string, reason?: string) => {
    if (!accessToken || !companyId) return;
    await bookingApi.cancel(accessToken, companyId, id, reason);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!accessToken || !companyId) return;
    await bookingApi.delete(accessToken, companyId, id);
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground">Manage customer reservations, dispatches, and fares</p>
        </div>
        <PermissionGate permission="booking.create">
          <Link
            href={`/companies/${companyId}/bookings/new`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Booking
          </Link>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={CalendarDays} label="Total" value={stats.total} color="bg-indigo-500/10 text-indigo-400" />
          <StatCard icon={Clock} label="Draft" value={stats.draft} color="bg-amber-500/10 text-amber-400" />
          <StatCard icon={CheckCircle2} label="Confirmed" value={stats.confirmed} color="bg-emerald-500/10 text-emerald-400" />
          <StatCard icon={CalendarDays} label="Completed" value={stats.completed} color="bg-blue-500/10 text-blue-400" />
          <StatCard icon={XCircle} label="Cancelled" value={stats.cancelled} color="bg-rose-500/10 text-rose-400" />
          <StatCard icon={DollarSign} label="Today" value={stats.todayCount} color="bg-cyan-500/10 text-cyan-400" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search booking #, customer, phone, or route..."
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
                <th className="px-4 py-3">Booking #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Pickup Time</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Passengers & Fare</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                    <span className="mt-2 block text-xs">Loading bookings...</span>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <CalendarDays className="mx-auto h-8 w-8 opacity-30" />
                    <p className="mt-2 text-sm">No bookings found</p>
                    {search || statusFilter ? (
                      <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                    ) : canManage ? (
                      <Link
                        href={`/companies/${companyId}/bookings/new`}
                        className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
                      >
                        Create your first booking
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    companyId={companyId}
                    canManage={canManage}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
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
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total} bookings
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
