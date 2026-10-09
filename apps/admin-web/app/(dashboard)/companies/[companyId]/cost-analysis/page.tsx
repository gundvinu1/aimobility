'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/auth/route-guard';
import {
  fetchCostSummary,
  fetchVehicleCosts,
  fetchCategoryCosts,
  fetchCostTrends,
} from '@/lib/fleet-management/fleet-management-api';
import type {
  FleetCostSummaryDto,
  VehicleCostSummaryDto,
  CategoryCostSummaryDto,
  CostTrendDto,
} from '@ai-mos/types';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Fuel,
  Wrench,
  RefreshCw,
  PieChart,
  Car,
} from 'lucide-react';

export default function CostAnalysisPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';

  const [range, setRange] = useState<'today' | '7d' | '30d' | 'this_month'>('30d');
  const [summary, setSummary] = useState<FleetCostSummaryDto | null>(null);
  const [vehicleCosts, setVehicleCosts] = useState<VehicleCostSummaryDto[]>([]);
  const [categoryCosts, setCategoryCosts] = useState<CategoryCostSummaryDto[]>([]);
  const [trends, setTrends] = useState<CostTrendDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const [sumRes, vehRes, catRes, trendRes] = await Promise.all([
        fetchCostSummary(companyId, { range }),
        fetchVehicleCosts(companyId, { range }),
        fetchCategoryCosts(companyId, { range }),
        fetchCostTrends(companyId, { range }),
      ]);
      setSummary(sumRes);
      setVehicleCosts(vehRes || []);
      setCategoryCosts(catRes || []);
      setTrends(trendRes || []);
    } catch (err: any) {
      console.error('Error fetching cost analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <RouteGuard requiredPermission="tco.read">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-indigo-400" />
              Fleet TCO & Operating Cost Analytics
            </h1>
            <p className="text-sm text-slate-400">
              Total Cost of Ownership (TCO), cost per kilometer, fuel consumption, and vehicle cost rankings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="this_month">This Month</option>
            </select>
            <button
              onClick={() => loadData()}
              className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-2 border border-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Total Operating Cost</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                ${summary.totalOperatingCost.toLocaleString()}
              </h2>
              <p className="text-xs text-slate-500">Across {summary.vehicleCount} vehicles</p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Cost Per Kilometer</span>
                <TrendingUp className="h-4 w-4 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                ${summary.costPerKm} <span className="text-xs font-normal text-slate-400">/ km</span>
              </h2>
              <p className="text-xs text-slate-500">{summary.totalDistanceKm.toLocaleString()} km recorded</p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Fuel Spend</span>
                <Fuel className="h-4 w-4 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                ${summary.fuelCost.toLocaleString()}
              </h2>
              <p className="text-xs text-slate-500">
                {summary.totalOperatingCost > 0
                  ? `${Math.round((summary.fuelCost / summary.totalOperatingCost) * 100)}% of total cost`
                  : '0%'}
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                <span>Maintenance & Repairs</span>
                <Wrench className="h-4 w-4 text-rose-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                ${(summary.maintenanceCost + summary.repairCost).toLocaleString()}
              </h2>
              <p className="text-xs text-slate-500">
                Maint: ${summary.maintenanceCost} | Repairs: ${summary.repairCost}
              </p>
            </div>
          </div>
        )}

        {/* Mid-Row: Category Breakdown & Monthly Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PieChart className="h-4 w-4 text-indigo-400" />
              Expenditure by Category
            </h3>

            {categoryCosts.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No expenses in this period.</p>
            ) : (
              <div className="space-y-3">
                {categoryCosts.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">{cat.category}</span>
                      <span className="font-semibold text-white">
                        ${cat.totalAmount.toLocaleString()} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, cat.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly Trends */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Monthly Cost Trends
            </h3>

            {trends.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No trend data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/50 uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2">Fuel</th>
                      <th className="px-3 py-2">Maintenance</th>
                      <th className="px-3 py-2">Repairs</th>
                      <th className="px-3 py-2">Other</th>
                      <th className="px-3 py-2 font-bold text-white">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {trends.map((t) => (
                      <tr key={t.period} className="hover:bg-slate-800/30">
                        <td className="px-3 py-2 font-mono font-semibold text-indigo-400">{t.period}</td>
                        <td className="px-3 py-2 text-amber-400">${t.fuelCost.toLocaleString()}</td>
                        <td className="px-3 py-2 text-indigo-400">${t.maintenanceCost.toLocaleString()}</td>
                        <td className="px-3 py-2 text-rose-400">${t.repairCost.toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-400">${t.otherCost.toLocaleString()}</td>
                        <td className="px-3 py-2 font-bold text-emerald-400">${t.totalCost.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Vehicle Ranking & Cost / KM Comparison */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Car className="h-4 w-4 text-indigo-400" />
              Vehicle Cost Breakdown & Cost per KM Rankings
            </h3>
            <span className="text-xs text-slate-400">{vehicleCosts.length} vehicles</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
              Loading vehicle analytics...
            </div>
          ) : vehicleCosts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No vehicle cost data available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Make / Model</th>
                    <th className="px-4 py-3">Distance (KM)</th>
                    <th className="px-4 py-3">Fuel Cost</th>
                    <th className="px-4 py-3">Maint & Repairs</th>
                    <th className="px-4 py-3">Other Costs</th>
                    <th className="px-4 py-3 font-bold text-white">Total Operating Cost</th>
                    <th className="px-4 py-3 font-bold text-emerald-400">Cost / KM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {vehicleCosts.map((v) => (
                    <tr key={v.vehicleId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{v.vehicleNumber}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {v.make} {v.model}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {v.distanceKm ? `${v.distanceKm.toLocaleString()} km` : '—'}
                      </td>
                      <td className="px-4 py-3 text-amber-400">${v.fuelCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-indigo-400">
                        ${(v.maintenanceCost + v.repairCost).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-400">${v.otherCost.toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-white">
                        ${v.totalOperatingCost.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-400">
                        ${v.costPerKm} / km
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </RouteGuard>
  );
}
