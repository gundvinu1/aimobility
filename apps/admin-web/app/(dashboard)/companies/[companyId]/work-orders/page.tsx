'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import {
  fetchWorkOrders,
  createWorkOrder,
  updateWorkOrderStatus,
  deleteWorkOrder,
} from '@/lib/fleet-management/fleet-management-api';
import type {
  WorkOrderDto,
  CreateWorkOrderDto,
  WorkOrderStatus,
  WorkOrderPriority,
} from '@ai-mos/types';
import {
  ClipboardList,
  CheckCircle,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<WorkOrderStatus, { bg: string; text: string; border: string }> = {
  DRAFT:       { bg: 'bg-slate-500/10 text-slate-300', border: 'border-slate-500/30', text: 'DRAFT' },
  OPEN:        { bg: 'bg-blue-500/10 text-blue-300', border: 'border-blue-500/30', text: 'OPEN' },
  IN_PROGRESS: { bg: 'bg-amber-500/10 text-amber-300', border: 'border-amber-500/30', text: 'IN PROGRESS' },
  COMPLETED:   { bg: 'bg-emerald-500/10 text-emerald-300', border: 'border-emerald-500/30', text: 'COMPLETED' },
  CANCELLED:   { bg: 'bg-red-500/10 text-red-300', border: 'border-red-500/30', text: 'CANCELLED' },
};

const PRIORITY_BADGES: Record<WorkOrderPriority, { bg: string }> = {
  CRITICAL: { bg: 'bg-red-500 text-white' },
  HIGH:     { bg: 'bg-orange-500/20 text-orange-300 border border-orange-500/40' },
  MEDIUM:   { bg: 'bg-amber-500/20 text-amber-300 border border-amber-500/40' },
  LOW:      { bg: 'bg-slate-500/20 text-slate-300 border border-slate-500/40' },
};

export default function WorkOrdersPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission('workorder.create');
  const canUpdate = hasPermission('workorder.update');
  const canDelete = hasPermission('workorder.delete');

  const [workOrders, setWorkOrders] = useState<WorkOrderDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateWorkOrderDto>>({
    title: '',
    priority: 'MEDIUM',
    estimatedCost: 0,
    items: [],
  });

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const res = await fetchWorkOrders(companyId, {
        status: statusFilter !== 'ALL' ? (statusFilter as any) : undefined,
      });
      setWorkOrders(res.data || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      console.error('Error fetching work orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusTransition = async (id: string, newStatus: WorkOrderStatus) => {
    let actualCost: number | undefined;
    if (newStatus === 'COMPLETED') {
      const costInput = prompt('Enter actual final cost (or leave blank to use items total):');
      if (costInput && !isNaN(parseFloat(costInput))) {
        actualCost = parseFloat(costInput);
      }
    }

    try {
      await updateWorkOrderStatus(companyId, id, { status: newStatus, actualCost });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update work order status');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.title) {
      alert('Vehicle ID and Title are required.');
      return;
    }
    try {
      await createWorkOrder(companyId, formData as CreateWorkOrderDto);
      setIsModalOpen(false);
      setFormData({ title: '', priority: 'MEDIUM', estimatedCost: 0, items: [] });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create work order');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work order?')) return;
    try {
      await deleteWorkOrder(companyId, id);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete work order');
    }
  };

  return (
    <RouteGuard requiredPermission="workorder.read">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ClipboardList className="h-7 w-7 text-teal-400" />
              Maintenance Work Orders
            </h1>
            <p className="text-sm text-slate-400">
              Track lifecycle maintenance tasks, assign technicians, allocate parts and labor, and record completion costs.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData()}
              className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 border border-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {canCreate && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Create Work Order
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Status Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Statuses ({totalCount})</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Work Orders List */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-teal-400" />
            Loading work orders...
          </div>
        ) : workOrders.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
            <ClipboardList className="h-10 w-10 mx-auto text-slate-600 mb-3" />
            <p className="text-base font-medium text-slate-300">No work orders found</p>
            <p className="text-sm text-slate-500 mt-1">
              Create a new work order to dispatch maintenance or repair tasks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workOrders.map((wo) => {
              const statusCfg = STATUS_CONFIG[wo.status] || STATUS_CONFIG.DRAFT;
              const prioCfg = PRIORITY_BADGES[wo.priority] || PRIORITY_BADGES.MEDIUM;
              return (
                <div
                  key={wo.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 space-y-4 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-teal-400">
                        {wo.workOrderNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs px-2 py-0.5 rounded font-semibold', prioCfg.bg)}>
                          {wo.priority}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded font-semibold border',
                            statusCfg.bg,
                            statusCfg.border,
                          )}
                        >
                          {statusCfg.text}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white line-clamp-1">{wo.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                        {wo.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-800/80">
                      <div>
                        <span className="text-slate-500">Vehicle:</span>
                        <p className="font-semibold text-slate-200 mt-0.5">
                          {wo.vehicleNumber || wo.vehicleId.slice(0, 8)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Estimated Cost:</span>
                        <p className="font-semibold text-slate-200 mt-0.5">
                          ${wo.estimatedCost.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Actual Cost:</span>
                        <p className="font-semibold text-emerald-400 mt-0.5">
                          ${wo.actualCost.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Technician:</span>
                        <p className="font-medium text-slate-300 mt-0.5">
                          {wo.assignedTechnician || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Transitions */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800">
                    <div className="flex items-center gap-1.5">
                      {canUpdate && wo.status === 'DRAFT' && (
                        <button
                          onClick={() => handleStatusTransition(wo.id, 'OPEN')}
                          className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-1"
                        >
                          <Play className="h-3 w-3" /> Open
                        </button>
                      )}
                      {canUpdate && wo.status === 'OPEN' && (
                        <button
                          onClick={() => handleStatusTransition(wo.id, 'IN_PROGRESS')}
                          className="px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded font-medium flex items-center gap-1"
                        >
                          <Play className="h-3 w-3" /> Start
                        </button>
                      )}
                      {canUpdate && wo.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleStatusTransition(wo.id, 'COMPLETED')}
                          className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" /> Complete
                        </button>
                      )}
                      {canUpdate && (wo.status === 'DRAFT' || wo.status === 'OPEN' || wo.status === 'IN_PROGRESS') && (
                        <button
                          onClick={() => handleStatusTransition(wo.id, 'CANCELLED')}
                          className="px-2 py-1 text-xs hover:bg-red-500/20 text-red-400 rounded transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(wo.id)}
                        className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Create Work Order */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-teal-400" />
                  Create Work Order
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Vehicle ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter vehicle UUID"
                    value={formData.vehicleId || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Work Order Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Front Suspension & Brake Overhaul"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Provide details on maintenance or repair instructions..."
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Priority</label>
                    <select
                      value={formData.priority || 'MEDIUM'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Estimated Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 500"
                      value={formData.estimatedCost || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Technician</label>
                  <input
                    type="text"
                    placeholder="e.g. Mike Vance"
                    value={formData.assignedTechnician || ''}
                    onChange={(e) => setFormData({ ...formData, assignedTechnician: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg"
                  >
                    Create Work Order
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
