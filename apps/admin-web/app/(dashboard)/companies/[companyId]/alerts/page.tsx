'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import {
  fetchAlerts,
  fetchAlertSummary,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  type AlertFilterOptions,
} from '@/lib/alert/alert-api';
import { useTrackingSocket } from '@/lib/tracking/use-tracking-socket';
import type {
  FleetAlertDto,
  FleetAlertSummaryDto,
  FleetAlertType,
  FleetAlertSeverity,
  FleetAlertStatus,
} from '@ai-mos/types';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Car,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  HIGH:     { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  MEDIUM:   { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  LOW:      { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  INFO:     { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
};

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  OPEN:         { bg: 'bg-red-500/20 text-red-300', text: 'OPEN' },
  ACKNOWLEDGED: { bg: 'bg-amber-500/20 text-amber-300', text: 'ACKNOWLEDGED' },
  RESOLVED:     { bg: 'bg-emerald-500/20 text-emerald-300', text: 'RESOLVED' },
  DISMISSED:    { bg: 'bg-slate-500/20 text-slate-400', text: 'DISMISSED' },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  OVERSPEED: 'Overspeed',
  HARSH_BRAKING: 'Harsh Braking',
  EXCESSIVE_IDLE: 'Excessive Idle',
  GEOFENCE_ENTRY: 'Geofence Entry',
  GEOFENCE_EXIT: 'Geofence Exit',
};

export default function AlertCenterPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';
  const { accessToken } = useAuth();
  const { hasPermission } = usePermissions();

  const canAcknowledge = hasPermission('alert.acknowledge');
  const canResolve = hasPermission('alert.resolve');
  const canConfigure = hasPermission('alert.configure');

  const [alerts, setAlerts] = useState<FleetAlertDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<FleetAlertSummaryDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Action Dialog State
  const [activeActionModal, setActiveActionModal] = useState<{
    type: 'ACKNOWLEDGE' | 'RESOLVE' | 'DISMISS';
    alert: FleetAlertDto;
  } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Alert Details Modal
  const [inspectAlert, setInspectAlert] = useState<FleetAlertDto | null>(null);

  // ─── 1. Load Data ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const filterOpts: AlertFilterOptions = {
        page,
        limit: 20,
        search: searchQuery.trim() || undefined,
        severity: severityFilter !== 'ALL' ? (severityFilter as FleetAlertSeverity) : undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as FleetAlertStatus) : undefined,
        type: typeFilter !== 'ALL' ? (typeFilter as FleetAlertType) : undefined,
      };

      const [alertsRes, summaryRes] = await Promise.all([
        fetchAlerts(companyId, filterOpts),
        fetchAlertSummary(companyId),
      ]);

      setAlerts(alertsRes.alerts);
      setTotalCount(alertsRes.total);
      setTotalPages(alertsRes.totalPages);
      setSummary(summaryRes);
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Failed to load fleet alerts');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, page, searchQuery, severityFilter, statusFilter, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── 2. Real-Time Socket.IO Updates ──────────────────────────────────────────

  const handleAlertCreated = useCallback((newAlert: FleetAlertDto) => {
    setAlerts((prev) => [newAlert, ...prev]);
    setSummary((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        totalOpen: prev.totalOpen + 1,
        totalAlerts: prev.totalAlerts + 1,
        criticalCount: newAlert.severity === 'CRITICAL' ? prev.criticalCount + 1 : prev.criticalCount,
        highCount: newAlert.severity === 'HIGH' ? prev.highCount + 1 : prev.highCount,
      };
    });
  }, []);

  const handleAlertUpdated = useCallback((updatedAlert: FleetAlertDto) => {
    setAlerts((prev) => prev.map((a) => (a.id === updatedAlert.id ? updatedAlert : a)));
  }, []);

  const { connectionStatus, isConnected } = useTrackingSocket({
    companyId,
    accessToken,
    enabled: !!companyId,
    onAlertCreated: handleAlertCreated,
    onAlertUpdated: handleAlertUpdated,
    onAlertAcknowledged: handleAlertUpdated,
    onAlertResolved: handleAlertUpdated,
  });

  // ─── 3. Action Handlers ──────────────────────────────────────────────────────

  const handleExecuteAction = async () => {
    if (!activeActionModal) return;
    setIsSubmittingAction(true);
    try {
      let updated: FleetAlertDto;
      if (activeActionModal.type === 'ACKNOWLEDGE') {
        updated = await acknowledgeAlert(companyId, activeActionModal.alert.id, actionNotes.trim() || undefined);
      } else if (activeActionModal.type === 'RESOLVE') {
        updated = await resolveAlert(companyId, activeActionModal.alert.id, actionNotes.trim() || undefined);
      } else {
        updated = await dismissAlert(companyId, activeActionModal.alert.id, actionNotes.trim() || undefined);
      }

      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setActiveActionModal(null);
      setActionNotes('');
      // Refresh summary
      fetchAlertSummary(companyId).then(setSummary).catch(() => {});
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <RouteGuard requiredPermission="alert.read">
      <div className="flex flex-col gap-6 p-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                  Alert Center
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                      isConnected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    )}
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400',
                      )}
                    />
                    {connectionStatus}
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Live operational, speeding, and geofencing safety events
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canConfigure && (
              <Link
                href={`/companies/${companyId}/alert-settings`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 border border-slate-700 transition"
              >
                <Sliders className="w-4 h-4 text-slate-400" />
                Alert Rules
              </Link>
            )}
            <button
              onClick={() => loadData()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 border border-slate-700 transition"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Open Alerts</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-white">{summary?.totalOpen ?? 0}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Active
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Critical</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-red-400">{summary?.criticalCount ?? 0}</span>
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">High</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-orange-400">{summary?.highCount ?? 0}</span>
              <ShieldAlert className="w-4 h-4 text-orange-400" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Acknowledged</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-amber-400">{summary?.acknowledgedCount ?? 0}</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Resolved Today</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-emerald-400">{summary?.resolvedTodayCount ?? 0}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search title, message, or vehicle..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Types</option>
              <option value="OVERSPEED">Overspeed</option>
              <option value="HARSH_BRAKING">Harsh Braking</option>
              <option value="EXCESSIVE_IDLE">Excessive Idle</option>
              <option value="GEOFENCE_ENTRY">Geofence Entry</option>
              <option value="GEOFENCE_EXIT">Geofence Exit</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Alerts Table */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Severity & Type</th>
                  <th className="px-4 py-3">Vehicle & Driver</th>
                  <th className="px-4 py-3">Triggered</th>
                  <th className="px-4 py-3">Alert Details</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading && alerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      Loading fleet alerts...
                    </td>
                  </tr>
                ) : alerts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                      No alerts found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  alerts.map((alert) => {
                    const sevStyle = SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.INFO;
                    const statusBadge = STATUS_BADGES[alert.status] ?? STATUS_BADGES.OPEN;

                    return (
                      <tr key={alert.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-semibold border',
                                sevStyle.bg,
                                sevStyle.text,
                                sevStyle.border,
                              )}
                            >
                              {alert.severity}
                            </span>
                            <span className="text-xs font-medium text-slate-300">
                              {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <Link
                              href={`/companies/${companyId}/vehicles/${alert.vehicleId}`}
                              className="font-medium text-blue-400 hover:underline flex items-center gap-1.5"
                            >
                              <Car className="w-3.5 h-3.5 text-slate-500" />
                              {alert.vehicleNumber ?? 'Vehicle'}
                            </Link>
                            {alert.driverName && (
                              <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <User className="w-3 h-3 text-slate-500" />
                                {alert.driverName}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                          {new Date(alert.triggeredAt).toLocaleString()}
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-md">
                            <p className="font-medium text-slate-200 text-sm line-clamp-1">{alert.title}</p>
                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{alert.message}</p>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn('px-2.5 py-0.5 rounded text-xs font-medium', statusBadge.bg)}>
                            {statusBadge.text}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setInspectAlert(alert)}
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {alert.status === 'OPEN' && canAcknowledge && (
                              <button
                                onClick={() => setActiveActionModal({ type: 'ACKNOWLEDGE', alert })}
                                className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium border border-amber-500/20 transition"
                              >
                                Acknowledge
                              </button>
                            )}

                            {alert.status !== 'RESOLVED' && alert.status !== 'DISMISSED' && canResolve && (
                              <button
                                onClick={() => setActiveActionModal({ type: 'RESOLVE', alert })}
                                className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/20 transition"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Showing {alerts.length} of {totalCount} alerts
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Confirmation Modal */}
        {activeActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  {activeActionModal.type === 'ACKNOWLEDGE'
                    ? 'Acknowledge Alert'
                    : activeActionModal.type === 'RESOLVE'
                      ? 'Resolve Alert'
                      : 'Dismiss Alert'}
                </h3>
                <button
                  onClick={() => setActiveActionModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-white">{activeActionModal.alert.title}</span>
                <p className="text-slate-400 mt-1">{activeActionModal.alert.message}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Describe actions taken or notes for the audit trail..."
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  onClick={() => setActiveActionModal(null)}
                  disabled={isSubmittingAction}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteAction}
                  disabled={isSubmittingAction}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition disabled:opacity-50"
                >
                  {isSubmittingAction ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Alert Details Inspection Modal */}
        {inspectAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-xs font-semibold border',
                      SEVERITY_COLORS[inspectAlert.severity]?.bg,
                      SEVERITY_COLORS[inspectAlert.severity]?.text,
                      SEVERITY_COLORS[inspectAlert.severity]?.border,
                    )}
                  >
                    {inspectAlert.severity}
                  </span>
                  <h3 className="text-lg font-bold text-white">{inspectAlert.title}</h3>
                </div>
                <button
                  onClick={() => setInspectAlert(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                {inspectAlert.message}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Vehicle</span>
                  <span className="font-semibold text-slate-200">{inspectAlert.vehicleNumber ?? '—'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Driver</span>
                  <span className="font-semibold text-slate-200">{inspectAlert.driverName ?? '—'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Coordinates</span>
                  <span className="font-semibold text-slate-200">
                    {inspectAlert.latitude && inspectAlert.longitude
                      ? `${inspectAlert.latitude.toFixed(5)}, ${inspectAlert.longitude.toFixed(5)}`
                      : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block mb-1">Speed at Trigger</span>
                  <span className="font-semibold text-slate-200">
                    {inspectAlert.speed !== undefined && inspectAlert.speed !== null
                      ? `${inspectAlert.speed} km/h`
                      : '—'}
                  </span>
                </div>
              </div>

              {inspectAlert.metadata && Object.keys(inspectAlert.metadata).length > 0 && (
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
                    Operational Metadata
                  </span>
                  <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                    {JSON.stringify(inspectAlert.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {inspectAlert.resolutionNotes && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                  <span className="font-bold block mb-1">Resolution Notes:</span>
                  {inspectAlert.resolutionNotes}
                </div>
              )}

              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setInspectAlert(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
