'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import {
  getGeofence,
  updateGeofence,
  deleteGeofence,
  fetchAssignedVehicles,
  assignVehiclesToGeofence,
  removeVehicleFromGeofence,
} from '@/lib/geofence/geofence-api';
import { fetchAlerts } from '@/lib/alert/alert-api';
import { apiClient } from '@/lib/api/api-client';
import type {
  GeofenceDto,
  GeofenceVehicleDto,
  FleetAlertDto,
  CircleGeometry,
  PolygonGeometry,
} from '@ai-mos/types';
import {
  ArrowLeft,
  Circle as CircleIcon,
  Layers,
  MapPin,
  Bell,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  Car,
  X,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

export default function GeofenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = (params?.['companyId'] as string) || '';
  const geofenceId = (params?.['id'] as string) || '';

  const { hasPermission } = usePermissions();
  const canUpdate = hasPermission('geofence.update');
  const canDelete = hasPermission('geofence.delete');

  // Core Data
  const [geofence, setGeofence] = useState<GeofenceDto | null>(null);
  const [assignedVehicles, setAssignedVehicles] = useState<GeofenceVehicleDto[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<FleetAlertDto[]>([]);
  const [allCompanyVehicles, setAllCompanyVehicles] = useState<
    Array<{ id: string; vehicleNumber: string; make: string; model: string }>
  >([]);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedToAssign, setSelectedToAssign] = useState<string[]>([]);
  const [assigningLoading, setAssigningLoading] = useState(false);

  // Map references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const [leafletLib, setLeafletLib] = useState<any>(null);

  // ─── 1. Load Leaflet Dynamically ───────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    import('leaflet').then((L) => {
      if (isMounted) setLeafletLib(L);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // ─── 2. Fetch Data ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!companyId || !geofenceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [geo, vehiclesAssigned, alertsRes] = await Promise.all([
        getGeofence(companyId, geofenceId),
        fetchAssignedVehicles(companyId, geofenceId),
        fetchAlerts(companyId, { geofenceId, limit: 10 }),
      ]);
      setGeofence(geo);
      setAssignedVehicles(vehiclesAssigned);
      setRecentAlerts(alertsRes.alerts || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load geofence details');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, geofenceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch all company vehicles for assignment dialog
  useEffect(() => {
    if (!companyId) return;
    apiClient
      .get<{ data: Array<{ id: string; vehicleNumber: string; make: string; model: string }> }>(
        '/vehicles',
        { headers: { 'x-company-id': companyId } },
      )
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? [];
        setAllCompanyVehicles(list);
      })
      .catch(() => {});
  }, [companyId]);

  // ─── 3. Render Leaflet Map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletLib || !mapContainerRef.current || !geofence) return;
    const L = leafletLib;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [37.7749, -122.4194],
        zoom: 13,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const geoColor = geofence.color || '#3b82f6';

    if (geofence.type === 'CIRCLE') {
      const circleGeom = geofence.geometry as CircleGeometry;
      if (circleGeom?.center) {
        const circle = L.circle([circleGeom.center.latitude, circleGeom.center.longitude], {
          radius: circleGeom.radiusMeters,
          color: geoColor,
          fillColor: geoColor,
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(layerGroup);

        L.circleMarker([circleGeom.center.latitude, circleGeom.center.longitude], {
          radius: 6,
          color: '#ffffff',
          fillColor: geoColor,
          fillOpacity: 1,
          weight: 2,
        }).addTo(layerGroup);

        map.fitBounds(circle.getBounds(), { padding: [40, 40] });
      }
    } else if (geofence.type === 'POLYGON') {
      const polyGeom = geofence.geometry as PolygonGeometry;
      if (polyGeom?.coordinates?.length) {
        const latLngs = polyGeom.coordinates.map((c) => [c.latitude, c.longitude] as [number, number]);
        const polygon = L.polygon(latLngs, {
          color: geoColor,
          fillColor: geoColor,
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(layerGroup);

        latLngs.forEach((coord) => {
          L.circleMarker(coord, {
            radius: 5,
            color: '#ffffff',
            fillColor: geoColor,
            fillOpacity: 1,
            weight: 2,
          }).addTo(layerGroup);
        });

        map.fitBounds(polygon.getBounds(), { padding: [40, 40] });
      }
    }
  }, [leafletLib, geofence]);

  // ─── 4. Handlers ───────────────────────────────────────────────────────────
  const handleToggleActive = async () => {
    if (!geofence || isUpdating) return;
    setIsUpdating(true);
    try {
      const updated = await updateGeofence(companyId, geofenceId, {
        isActive: !geofence.isActive,
      });
      setGeofence(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to update geofence');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleEntryAlert = async () => {
    if (!geofence || isUpdating) return;
    setIsUpdating(true);
    try {
      const updated = await updateGeofence(companyId, geofenceId, {
        entryAlertEnabled: !geofence.entryAlertEnabled,
      });
      setGeofence(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to update entry alert setting');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleExitAlert = async () => {
    if (!geofence || isUpdating) return;
    setIsUpdating(true);
    try {
      const updated = await updateGeofence(companyId, geofenceId, {
        exitAlertEnabled: !geofence.exitAlertEnabled,
      });
      setGeofence(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to update exit alert setting');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete geofence "${geofence?.name}"?`)) return;
    setIsDeleting(true);
    try {
      await deleteGeofence(companyId, geofenceId);
      router.push(`/companies/${companyId}/geofences`);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete geofence');
      setIsDeleting(false);
    }
  };

  const handleRemoveVehicle = async (vehicleId: string) => {
    if (!confirm('Remove this vehicle from the geofence?')) return;
    try {
      await removeVehicleFromGeofence(companyId, geofenceId, vehicleId);
      setAssignedVehicles((prev) => prev.filter((v) => v.vehicleId !== vehicleId));
    } catch (err: any) {
      alert(err?.message || 'Failed to remove vehicle');
    }
  };

  const handleAssignVehiclesSubmit = async () => {
    if (selectedToAssign.length === 0) return;
    setAssigningLoading(true);
    try {
      await assignVehiclesToGeofence(companyId, geofenceId, selectedToAssign);
      const updatedAssigned = await fetchAssignedVehicles(companyId, geofenceId);
      setAssignedVehicles(updatedAssigned);
      setIsAssignModalOpen(false);
      setSelectedToAssign([]);
    } catch (err: any) {
      alert(err?.message || 'Failed to assign vehicles');
    } finally {
      setAssigningLoading(false);
    }
  };

  const assignedVehicleIdSet = new Set(assignedVehicles.map((v) => v.vehicleId));
  const unassignedVehicles = allCompanyVehicles.filter((v) => !assignedVehicleIdSet.has(v.id));

  return (
    <RouteGuard requiredPermissions={['geofence.read']}>
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/companies/${companyId}/geofences`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Geofences
          </Link>

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete Geofence
            </button>
          )}
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {geofence && !isLoading && (
          <>
            {/* Header Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner"
                  style={{ backgroundColor: `${geofence.color}20`, border: `2px solid ${geofence.color}` }}
                >
                  {geofence.type === 'CIRCLE' ? (
                    <CircleIcon className="h-6 w-6" style={{ color: geofence.color }} />
                  ) : (
                    <Layers className="h-6 w-6" style={{ color: geofence.color }} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{geofence.name}</h1>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium border',
                        geofence.isActive
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : 'border-slate-500/20 bg-slate-500/10 text-slate-400',
                      )}
                    >
                      {geofence.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                      {geofence.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {geofence.description || 'No description provided'}
                  </p>
                </div>
              </div>

              {canUpdate && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleToggleActive}
                    disabled={isUpdating}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      geofence.isActive
                        ? 'border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                        : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
                    )}
                  >
                    {geofence.isActive ? 'Deactivate' : 'Activate'}
                  </button>

                  <button
                    onClick={handleToggleEntryAlert}
                    disabled={isUpdating}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      geofence.entryAlertEnabled
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-muted/20 text-muted-foreground',
                    )}
                  >
                    Entry: {geofence.entryAlertEnabled ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={handleToggleExitAlert}
                    disabled={isUpdating}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      geofence.exitAlertEnabled
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-muted/20 text-muted-foreground',
                    )}
                  >
                    Exit: {geofence.exitAlertEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              )}
            </div>

            {/* Main Content Grid: Map & Geometry */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map Viewport (2 cols) */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Boundary Map
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {geofence.type === 'CIRCLE'
                      ? `Radius: ${(geofence.geometry as CircleGeometry)?.radiusMeters}m`
                      : `Vertices: ${(geofence.geometry as PolygonGeometry)?.coordinates?.length}`}
                  </span>
                </div>
                <div ref={mapContainerRef} className="h-96 w-full z-0" />
              </div>

              {/* Geometry Specs & Details (1 col) */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    Configuration & Specs
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-semibold">{geofence.type}</span>
                    </div>

                    {geofence.type === 'CIRCLE' && (
                      <>
                        <div className="flex justify-between py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Radius</span>
                          <span className="font-mono">{(geofence.geometry as CircleGeometry)?.radiusMeters} m</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Center Latitude</span>
                          <span className="font-mono">
                            {(geofence.geometry as CircleGeometry)?.center?.latitude?.toFixed(6)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Center Longitude</span>
                          <span className="font-mono">
                            {(geofence.geometry as CircleGeometry)?.center?.longitude?.toFixed(6)}
                          </span>
                        </div>
                      </>
                    )}

                    {geofence.type === 'POLYGON' && (
                      <>
                        <div className="flex justify-between py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Vertices Count</span>
                          <span className="font-mono font-semibold">
                            {(geofence.geometry as PolygonGeometry)?.coordinates?.length} points
                          </span>
                        </div>
                        <div className="pt-2">
                          <span className="text-muted-foreground block mb-2">Coordinates:</span>
                          <div className="max-h-36 overflow-y-auto rounded-lg border border-border/40 bg-muted/20 p-2 space-y-1 font-mono text-[11px]">
                            {(geofence.geometry as PolygonGeometry)?.coordinates?.map((coord, idx) => (
                              <div key={idx} className="flex justify-between text-muted-foreground">
                                <span>P{idx + 1}</span>
                                <span>
                                  {coord.latitude.toFixed(5)}, {coord.longitude.toFixed(5)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between py-1.5 border-b border-border/30">
                      <span className="text-muted-foreground">Created At</span>
                      <span>{new Date(geofence.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">Last Updated</span>
                      <span>{new Date(geofence.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground mb-1">
                    <Bell className="h-3.5 w-3.5 text-primary" />
                    Alert Behavior
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vehicles assigned to this geofence will emit real-time events when entering or exiting its
                    boundaries, according to your alert settings.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Row: Assigned Vehicles & Recent Geofence Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Assigned Vehicles */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Car className="h-4 w-4 text-primary" />
                      Assigned Vehicles ({assignedVehicles.length})
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Vehicles evaluated against this boundary
                    </p>
                  </div>
                  {canUpdate && (
                    <button
                      onClick={() => setIsAssignModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Assign Vehicles
                    </button>
                  )}
                </div>

                {assignedVehicles.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border">
                    No vehicles assigned yet. Assign vehicles to begin geofence boundary monitoring.
                  </div>
                ) : (
                  <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
                    {assignedVehicles.map((av) => (
                      <div key={av.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground font-mono">
                            {av.vehicleNumber || av.vehicleId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {av.vehicleMakeModel || 'Assigned Vehicle'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground">
                            Assigned {new Date(av.assignedAt).toLocaleDateString()}
                          </span>
                          {canUpdate && (
                            <button
                              onClick={() => handleRemoveVehicle(av.vehicleId)}
                              className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition-colors"
                              title="Remove from geofence"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Geofence Alerts */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      Recent Geofence Alerts
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Entry and exit events detected within this zone
                    </p>
                  </div>
                  <Link
                    href={`/companies/${companyId}/alerts?geofenceId=${geofenceId}`}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    View in Alert Center
                  </Link>
                </div>

                {recentAlerts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground rounded-lg border border-dashed border-border">
                    No alerts recorded for this geofence yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
                    {recentAlerts.map((alert) => (
                      <div key={alert.id} className="py-2.5 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider',
                                alert.type === 'GEOFENCE_ENTRY'
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : 'bg-amber-500/10 text-amber-400',
                              )}
                            >
                              {alert.type}
                            </span>
                            <span className="text-xs font-semibold text-foreground">{alert.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            <span>Vehicle: {alert.vehicleNumber || 'N/A'}</span>
                            <span>•</span>
                            <span>{new Date(alert.triggeredAt).toLocaleString()}</span>
                          </div>
                        </div>

                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold border flex-shrink-0',
                            alert.status === 'OPEN'
                              ? 'border-red-500/30 bg-red-500/10 text-red-400'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                          )}
                        >
                          {alert.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Assign Vehicles Modal */}
        {isAssignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Assign Vehicles</h3>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Select company vehicles to monitor against this geofence boundary:
              </p>

              {unassignedVehicles.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  All available company vehicles are already assigned to this geofence.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-border/20 border border-border/40 rounded-lg p-2">
                  {unassignedVehicles.map((v) => {
                    const isSelected = selectedToAssign.includes(v.id);
                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedToAssign((prev) =>
                            isSelected ? prev.filter((id) => id !== v.id) : [...prev, v.id],
                          );
                        }}
                        className={cn(
                          'flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs',
                          isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40',
                        )}
                      >
                        <div>
                          <div className="font-mono font-semibold">{v.vehicleNumber}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {v.make} {v.model}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignVehiclesSubmit}
                  disabled={selectedToAssign.length === 0 || assigningLoading}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {assigningLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  Assign Selected ({selectedToAssign.length})
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
