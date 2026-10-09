'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import {
  fetchVehicleExpenses,
  createVehicleExpense,
  deleteVehicleExpense,
} from '@/lib/fleet-management/fleet-management-api';
import type {
  VehicleExpenseDto,
  CreateVehicleExpenseDto,
  VehicleExpenseCategory,
} from '@ai-mos/types';
import {
  Receipt,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<VehicleExpenseCategory, { bg: string; text: string }> = {
  FUEL:        { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
  MAINTENANCE: { bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400' },
  REPAIR:      { bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400' },
  PARTS:       { bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400' },
  INSURANCE:   { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
  TAX:         { bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-400' },
  TOLL:        { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
  PARKING:     { bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400' },
  CLEANING:    { bg: 'bg-sky-500/10 border-sky-500/30', text: 'text-sky-400' },
  OTHER:       { bg: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-400' },
};

export default function VehicleExpensesPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission('expense.create');
  const canDelete = hasPermission('expense.delete');

  const [expenses, setExpenses] = useState<VehicleExpenseDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateVehicleExpenseDto>>({
    category: 'TOLL',
    amount: 0,
    source: 'MANUAL',
  });

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const res = await fetchVehicleExpenses(companyId, {
        category: categoryFilter !== 'ALL' ? (categoryFilter as any) : undefined,
        page,
        limit: 20,
      });
      setExpenses(res.data || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Error fetching expenses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, categoryFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.category || !formData.amount) {
      alert('Vehicle ID, Category, and Amount are required.');
      return;
    }
    try {
      await createVehicleExpense(companyId, formData as CreateVehicleExpenseDto);
      setIsModalOpen(false);
      setFormData({ category: 'TOLL', amount: 0, source: 'MANUAL' });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record vehicle expense');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await deleteVehicleExpense(companyId, id);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete expense');
    }
  };

  return (
    <RouteGuard requiredPermission="expense.read">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Receipt className="h-7 w-7 text-emerald-400" />
              Unified Vehicle Expenses
            </h1>
            <p className="text-sm text-slate-400">
              Complete fleet expenditure ledger including fuel, maintenance, tolls, parking, taxes, and repairs.
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
                className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Add Expense
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none"
            >
              <option value="ALL">All Categories ({totalCount})</option>
              <option value="FUEL">Fuel</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="REPAIR">Repair</option>
              <option value="PARTS">Parts</option>
              <option value="INSURANCE">Insurance</option>
              <option value="TAX">Tax</option>
              <option value="TOLL">Toll</option>
              <option value="PARKING">Parking</option>
              <option value="CLEANING">Cleaning</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
              Loading expenses ledger...
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Receipt className="h-10 w-10 mx-auto text-slate-600 mb-3" />
              <p className="text-base font-medium text-slate-300">No expense records found</p>
              <p className="text-sm text-slate-500 mt-1">
                Record manual vehicle expenditures like tolls, parking, or insurance.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {expenses.map((exp) => {
                    const catCfg = CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.OTHER;
                    return (
                      <tr key={exp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {new Date(exp.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {exp.vehicleNumber || exp.vehicleId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs px-2.5 py-0.5 rounded-full font-semibold border',
                              catCfg.bg,
                              catCfg.text,
                            )}
                          >
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-400">
                          ${exp.amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                          {exp.source}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          {exp.reference || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 line-clamp-1">
                          {exp.description || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canDelete && exp.source === 'MANUAL' && (
                            <button
                              onClick={() => handleDelete(exp.id)}
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

          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Add Expense */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-emerald-400" />
                  Add Vehicle Expense
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Category *</label>
                    <select
                      value={formData.category || 'TOLL'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="TOLL">Toll</option>
                      <option value="PARKING">Parking</option>
                      <option value="INSURANCE">Insurance</option>
                      <option value="TAX">Tax</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="REPAIR">Repair</option>
                      <option value="PARTS">Parts</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Amount ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 75"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Reference</label>
                    <input
                      type="text"
                      placeholder="Receipt or tag # (e.g. FASTag-823)"
                      value={formData.reference || ''}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
                    <input
                      type="date"
                      value={formData.date ? formData.date.slice(0, 10) : ''}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Brief description of the expense..."
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
                  >
                    Save Expense
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
