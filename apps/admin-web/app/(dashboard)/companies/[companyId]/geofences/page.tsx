'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import {
  fetchGeofences,
  deleteGeofence,
} from '@/lib/geofence/geofence-api';
import type { GeofenceDto } from '@ai-mos/types';
import {
  Maximize2,
  Plus,
  Search,
  RefreshCw,
  Car,
  Trash2,
  ChevronRight,
  Circle,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GeofencesPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission('geofence.create');
  const canDelete = hasPermission('geofence.delete');

  const [geofences, setGeofences] = useState<GeofenceDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadGeofences = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchGeofences(companyId, {
        search: searchQuery.trim() || undefined,
        isActive: activeFilter === 'ALL' ? undefined : activeFilter === 'ACTIVE',
      });
      setGeofences(data);
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Failed to load geofences');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, searchQuery, activeFilter]);

  useEffect(() => {
    loadGeofences();
  }, [loadGeofences]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete geofence "${name}"?`)) return;
    try {
      await deleteGeofence(companyId, id);
      setGeofences((prev) => prev.filter((g) => g.id !== id));
    } catch (err: any) {
      alert(`Failed to delete geofence: ${err.message}`);
    }
  };

  return (
    <RouteGuard requiredPermission="geofence.read">
      <div className="flex flex-col gap-6 p-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Maximize2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Geofences</h1>
              <p className="text-sm text-slate-400">
                Manage operational zones, checkpoints, and entry/exit safety rules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadGeofences()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-300 border border-slate-700 transition"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              Refresh
            </button>
            {canCreate && (
              <Link
                href={`/companies/${companyId}/geofences/new`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition"
              >
                <Plus className="w-4 h-4" />
                Create Geofence
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by geofence name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-blue-500 w-full sm:w-auto"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Geofence Grid */}
        {isLoading && geofences.length === 0 ? (
          <div className="p-12 text-center text-slate-500 rounded-2xl bg-slate-900 border border-slate-800">
            Loading geofences...
          </div>
        ) : geofences.length === 0 ? (
          <div className="p-12 text-center text-slate-500 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-3">
            <Maximize2 className="w-10 h-10 text-slate-600" />
            <p className="text-sm">No geofences found matching your search.</p>
            {canCreate && (
              <Link
                href={`/companies/${companyId}/geofences/new`}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Create your first geofence
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {geofences.map((geo) => (
              <div
                key={geo.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between hover:border-slate-700 transition group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: geo.color || '#3b82f6' }}
                      />
                      <h3 className="font-semibold text-white text-base group-hover:text-blue-400 transition">
                        {geo.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-semibold border',
                          geo.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                        )}
                      >
                        {geo.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {geo.description && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                      {geo.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {geo.type === 'CIRCLE' ? (
                        <>
                          <Circle className="w-3 h-3 text-blue-400" />
                          Circle ({(geo.geometry as any)?.radiusMeters ?? 0}m)
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3 h-3 text-purple-400" />
                          Polygon ({(geo.geometry as any)?.coordinates?.length ?? 0} pts)
                        </>
                      )}
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      <Car className="w-3 h-3 text-amber-400" />
                      {geo.assignedVehiclesCount === 0
                        ? 'All Fleet'
                        : `${geo.assignedVehiclesCount} Assigned`}
                    </span>

                    {(geo.entryAlertEnabled || geo.exitAlertEnabled) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        <Bell className="w-3 h-3 text-emerald-400" />
                        {geo.entryAlertEnabled && geo.exitAlertEnabled
                          ? 'Entry & Exit'
                          : geo.entryAlertEnabled
                            ? 'Entry Only'
                            : 'Exit Only'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-5 pt-3 border-t border-slate-800">
                  <Link
                    href={`/companies/${companyId}/geofences/${geo.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                  >
                    View Details & Map
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>

                  {canDelete && (
                    <button
                      onClick={() => handleDelete(geo.id, geo.name)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition"
                      title="Delete Geofence"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
