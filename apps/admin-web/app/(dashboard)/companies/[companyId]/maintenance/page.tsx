'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import {
  fetchMaintenanceSchedules,
  createMaintenanceSchedule,
  fetchMaintenanceRecords,
  createMaintenanceRecord,
  triggerMaintenanceReminders,
  deleteMaintenanceSchedule,
} from '@/lib/fleet-management/fleet-management-api';
import type {
  MaintenanceScheduleDto,
  MaintenanceRecordDto,
  CreateMaintenanceScheduleDto,
  CreateMaintenanceRecordDto,
  MaintenanceDueStatus,
} from '@ai-mos/types';
import {
  Wrench,
  Plus,
  RefreshCw,
  Bell,
  Trash2,
  X,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_BADGES: Record<MaintenanceDueStatus, { bg: string; text: string; border: string }> = {
  OVERDUE:  { bg: 'bg-red-500/20 text-red-300', border: 'border-red-500/40', text: 'OVERDUE' },
  DUE:      { bg: 'bg-orange-500/20 text-orange-300', border: 'border-orange-500/40', text: 'DUE NOW' },
  DUE_SOON: { bg: 'bg-amber-500/20 text-amber-300', border: 'border-amber-500/40', text: 'DUE SOON' },
  UPCOMING: { bg: 'bg-blue-500/20 text-blue-300', border: 'border-blue-500/40', text: 'UPCOMING' },
  COMPLETED:{ bg: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500/40', text: 'COMPLETED' },
};

export default function MaintenancePage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission('maintenance.create');
  const canDelete = hasPermission('maintenance.delete');

  const [activeTab, setActiveTab] = useState<'schedules' | 'records'>('schedules');
  const [schedules, setSchedules] = useState<MaintenanceScheduleDto[]>([]);
  const [records, setRecords] = useState<MaintenanceRecordDto[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<string | null>(null);

  // Modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<Partial<CreateMaintenanceScheduleDto>>({
    serviceType: 'Engine Oil & Filter',
    intervalKm: 10000,
    intervalDays: 180,
    isActive: true,
  });
  const [recordForm, setRecordForm] = useState<Partial<CreateMaintenanceRecordDto>>({
    serviceType: 'Oil & Filter Replacement',
    partsCost: 0,
    laborCost: 0,
    tax: 0,
  });

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      if (activeTab === 'schedules') {
        const res = await fetchMaintenanceSchedules(companyId, {
          dueStatus: statusFilter !== 'ALL' ? (statusFilter as any) : undefined,
        });
        setSchedules(res.data || []);
      } else {
        const res = await fetchMaintenanceRecords(companyId);
        setRecords(res.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching maintenance data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, activeTab, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEvaluateReminders = async () => {
    setIsEvaluating(true);
    setEvalResult(null);
    try {
      const res = await triggerMaintenanceReminders(companyId);
      setEvalResult(`Evaluated active schedules. Created ${res.alertsSent} maintenance alert(s).`);
      await loadData();
    } catch (err: any) {
      setEvalResult('Failed to evaluate reminders.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.vehicleId || !scheduleForm.serviceType) {
      alert('Vehicle ID and Service Type are required.');
      return;
    }
    try {
      await createMaintenanceSchedule(companyId, scheduleForm as CreateMaintenanceScheduleDto);
      setIsScheduleModalOpen(false);
      setScheduleForm({ serviceType: 'Engine Oil & Filter', intervalKm: 10000, intervalDays: 180, isActive: true });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create schedule');
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordForm.vehicleId || !recordForm.serviceType) {
      alert('Vehicle ID and Service Type are required.');
      return;
    }
    try {
      await createMaintenanceRecord(companyId, recordForm as CreateMaintenanceRecordDto);
      setIsRecordModalOpen(false);
      setRecordForm({ serviceType: 'Oil & Filter Replacement', partsCost: 0, laborCost: 0, tax: 0 });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record maintenance event');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this maintenance schedule?')) return;
    try {
      await deleteMaintenanceSchedule(companyId, id);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete schedule');
    }
  };

  return (
    <RouteGuard requiredPermission="maintenance.read">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Wrench className="h-7 w-7 text-indigo-400" />
              Preventive Maintenance
            </h1>
            <p className="text-sm text-slate-400">
              Manage mileage and time-based service schedules, overdue reminders, and completed maintenance records.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleEvaluateReminders}
              disabled={isEvaluating}
              className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg flex items-center gap-2 border border-slate-700 disabled:opacity-50"
              title="Evaluate overdue schedules and dispatch alerts"
            >
              <Bell className="h-4 w-4" />
              {isEvaluating ? 'Evaluating...' : 'Check Alerts'}
            </button>
            {canCreate && (
              <>
                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  New Schedule
                </button>
                <button
                  onClick={() => setIsRecordModalOpen(true)}
                  className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                  <FileText className="h-4 w-4" />
                  Log Service
                </button>
              </>
            )}
          </div>
        </div>

        {evalResult && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {evalResult}
          </div>
        )}

        {/* Tab Selector & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 pb-3 gap-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('schedules')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'schedules'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white',
              )}
            >
              Active Schedules
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                activeTab === 'records'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white',
              )}
            >
              Completed Service History
            </button>
          </div>

          {activeTab === 'schedules' && (
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="DUE">Due Now</option>
                <option value="DUE_SOON">Due Soon</option>
                <option value="UPCOMING">Upcoming</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
            Loading maintenance data...
          </div>
        ) : activeTab === 'schedules' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {schedules.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Wrench className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                <p className="text-base font-medium text-slate-300">No maintenance schedules found</p>
                <p className="text-sm text-slate-500 mt-1">
                  Create schedules to proactively track service intervals (km or days).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Service Type</th>
                      <th className="px-4 py-3">Interval</th>
                      <th className="px-4 py-3">Next Due Odometer</th>
                      <th className="px-4 py-3">Next Due Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {schedules.map((s) => {
                      const badge = STATUS_BADGES[s.dueStatus] || STATUS_BADGES.UPCOMING;
                      return (
                        <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">
                            {s.vehicleNumber || s.vehicleId.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-200">
                            {s.serviceType}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {s.intervalKm ? `${s.intervalKm.toLocaleString()} km` : ''}
                            {s.intervalKm && s.intervalDays ? ' / ' : ''}
                            {s.intervalDays ? `${s.intervalDays} days` : ''}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {s.nextDueOdometer ? `${s.nextDueOdometer.toLocaleString()} km` : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {s.nextDueDate ? new Date(s.nextDueDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'text-xs px-2.5 py-0.5 rounded-full font-semibold border',
                                badge.bg,
                                badge.border,
                              )}
                            >
                              {badge.text}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteSchedule(s.id)}
                                className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {records.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                <p className="text-base font-medium text-slate-300">No maintenance records logged yet</p>
                <p className="text-sm text-slate-500 mt-1">Log completed services to track historic maintenance costs.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">Service Type</th>
                      <th className="px-4 py-3">Odometer</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Parts / Labor</th>
                      <th className="px-4 py-3">Total Cost</th>
                      <th className="px-4 py-3">Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {new Date(r.serviceDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {r.vehicleNumber || r.vehicleId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-200">{r.serviceType}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {r.odometer ? `${r.odometer.toLocaleString()} km` : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{r.vendorName || '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          ${r.partsCost} / ${r.laborCost}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-400">
                          ${r.totalCost.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{r.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Modal: New Schedule */}
        {isScheduleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-indigo-400" />
                  Create Preventive Maintenance Schedule
                </h3>
                <button onClick={() => setIsScheduleModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSchedule} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Vehicle ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter vehicle UUID"
                    value={scheduleForm.vehicleId || ''}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, vehicleId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Service Type *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Engine Oil & Filter"
                    value={scheduleForm.serviceType || ''}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, serviceType: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Interval (KM)</label>
                    <input
                      type="number"
                      placeholder="e.g. 10000"
                      value={scheduleForm.intervalKm || ''}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, intervalKm: parseInt(e.target.value, 10) || undefined })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Interval (Days)</label>
                    <input
                      type="number"
                      placeholder="e.g. 180 (6 months)"
                      value={scheduleForm.intervalDays || ''}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, intervalDays: parseInt(e.target.value, 10) || undefined })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
                  >
                    Save Schedule
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Log Service Record */}
        {isRecordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-400" />
                  Log Completed Maintenance Event
                </h3>
                <button onClick={() => setIsRecordModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRecord} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Vehicle ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter vehicle UUID"
                    value={recordForm.vehicleId || ''}
                    onChange={(e) => setRecordForm({ ...recordForm, vehicleId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Service Type *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Brake Pad Replacement"
                    value={recordForm.serviceType || ''}
                    onChange={(e) => setRecordForm({ ...recordForm, serviceType: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Parts Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={recordForm.partsCost || ''}
                      onChange={(e) => setRecordForm({ ...recordForm, partsCost: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Labor Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={recordForm.laborCost || ''}
                      onChange={(e) => setRecordForm({ ...recordForm, laborCost: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Tax</label>
                    <input
                      type="number"
                      step="0.01"
                      value={recordForm.tax || ''}
                      onChange={(e) => setRecordForm({ ...recordForm, tax: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Odometer (KM)</label>
                    <input
                      type="number"
                      placeholder="e.g. 25000"
                      value={recordForm.odometer || ''}
                      onChange={(e) =>
                        setRecordForm({ ...recordForm, odometer: parseInt(e.target.value, 10) || undefined })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Reference / Invoice</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-1004"
                      value={recordForm.reference || ''}
                      onChange={(e) => setRecordForm({ ...recordForm, reference: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsRecordModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
                  >
                    Record Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
