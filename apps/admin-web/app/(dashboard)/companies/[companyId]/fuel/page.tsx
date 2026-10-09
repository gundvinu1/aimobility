'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import {
  fetchFuelTransactions,
  fetchFuelAnalytics,
  createFuelTransaction,
  deleteFuelTransaction,
} from '@/lib/fleet-management/fleet-management-api';
import type {
  FuelTransactionDto,
  FuelAnalyticsDto,
  CreateFuelTransactionDto,
} from '@ai-mos/types';
import {
  Fuel,
  TrendingUp,
  DollarSign,
  Gauge,
  Plus,
  RefreshCw,
  Trash2,
  X,
  AlertCircle,
} from 'lucide-react';

export default function FuelManagementPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission('fuel.create');
  const canDelete = hasPermission('fuel.delete');

  const [transactions, setTransactions] = useState<FuelTransactionDto[]>([]);
  const [analytics, setAnalytics] = useState<FuelAnalyticsDto | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [fuelTypeFilter, setFuelTypeFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateFuelTransactionDto>>({
    quantityLiters: 0,
    pricePerLiter: 0,
    fuelType: 'DIESEL',
    transactionSource: 'MANUAL',
  });

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [txRes, analyticsRes] = await Promise.all([
        fetchFuelTransactions(companyId, {
          fuelType: fuelTypeFilter !== 'ALL' ? (fuelTypeFilter as any) : undefined,
          page,
          limit: 15,
        }),
        fetchFuelAnalytics(companyId),
      ]);
      setTransactions(txRes.data || []);
      setTotalCount(txRes.total || 0);
      setTotalPages(txRes.totalPages || 1);
      setAnalytics(analyticsRes);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to load fuel records');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, fuelTypeFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.quantityLiters || !formData.pricePerLiter) {
      alert('Please fill all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      await createFuelTransaction(companyId, formData as CreateFuelTransactionDto);
      setIsModalOpen(false);
      setFormData({ quantityLiters: 0, pricePerLiter: 0, fuelType: 'DIESEL', transactionSource: 'MANUAL' });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record fuel purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fuel record?')) return;
    try {
      await deleteFuelTransaction(companyId, id);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete record');
    }
  };

  return (
    <RouteGuard requiredPermission="fuel.read">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Fuel className="h-7 w-7 text-amber-500" />
              Fuel Management
            </h1>
            <p className="text-sm text-slate-400">
              Monitor fuel purchases, mileage efficiency, telemetry consumption, and cost per kilometer.
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
                className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Record Fuel
              </button>
            )}
          </div>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
                <Fuel className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Total Fuel Consumed</p>
                <h3 className="text-xl font-bold text-white mt-1">
                  {analytics.totalFuelConsumed.toLocaleString()} L
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Total Fuel Spend</p>
                <h3 className="text-xl font-bold text-white mt-1">
                  ${analytics.totalFuelCost.toLocaleString()}
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                <Gauge className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Average Efficiency</p>
                <h3 className="text-xl font-bold text-white mt-1">
                  {analytics.avgKmPerLiter > 0 ? `${analytics.avgKmPerLiter} km/L` : 'N/A'}
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Fuel Cost / KM</p>
                <h3 className="text-xl font-bold text-white mt-1">
                  {analytics.fuelCostPerKm > 0 ? `$${analytics.fuelCostPerKm}/km` : 'N/A'}
                </h3>
              </div>
            </div>
          </div>
        )}

        {/* Transactions Table & Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-white">Fuel Purchase Logs</span>
              <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                {totalCount} Records
              </span>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={fuelTypeFilter}
                onChange={(e) => setFuelTypeFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-sm text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="ALL">All Fuel Types</option>
                <option value="DIESEL">Diesel</option>
                <option value="PETROL">Petrol</option>
                <option value="CNG">CNG</option>
                <option value="ELECTRIC">Electric</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
              Loading fuel transactions...
            </div>
          ) : errorMsg ? (
            <div className="p-6 text-center text-red-400 flex items-center justify-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {errorMsg}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Fuel className="h-10 w-10 mx-auto text-slate-600 mb-3" />
              <p className="text-base font-medium text-slate-300">No fuel records recorded yet</p>
              <p className="text-sm text-slate-500 mt-1">Log refuel transactions to calculate fleet efficiency.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Fuel Type</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Rate / L</th>
                    <th className="px-4 py-3">Total Amount</th>
                    <th className="px-4 py-3">Odometer</th>
                    <th className="px-4 py-3">Station / Ref</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(tx.transactionDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {tx.vehicleNumber || tx.vehicleId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {tx.fuelType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-400">
                        {tx.quantityLiters} L
                      </td>
                      <td className="px-4 py-3 text-slate-400">${tx.pricePerLiter}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">
                        ${tx.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {tx.odometer ? `${tx.odometer.toLocaleString()} km` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {tx.stationName || tx.reference || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Page {page} of {totalPages}
              </span>
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

        {/* Modal: Record Fuel Transaction */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-amber-500" />
                  Record Fuel Purchase
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Vehicle ID / Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter vehicle UUID or select vehicle"
                    value={formData.vehicleId || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Quantity (Liters) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 45"
                      value={formData.quantityLiters || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, quantityLiters: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Price / Liter *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 1.85"
                      value={formData.pricePerLiter || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, pricePerLiter: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Odometer (KM)
                    </label>
                    <input
                      type="number"
                      placeholder="Current odometer"
                      value={formData.odometer || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, odometer: parseInt(e.target.value, 10) || undefined })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Fuel Type
                    </label>
                    <select
                      value={formData.fuelType || 'DIESEL'}
                      onChange={(e) => setFormData({ ...formData, fuelType: e.target.value as any })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none"
                    >
                      <option value="DIESEL">Diesel</option>
                      <option value="PETROL">Petrol</option>
                      <option value="CNG">CNG</option>
                      <option value="ELECTRIC">Electric</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Station / Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shell Station #402"
                    value={formData.stationName || ''}
                    onChange={(e) => setFormData({ ...formData, stationName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
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
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium rounded-lg disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Record Transaction'}
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
