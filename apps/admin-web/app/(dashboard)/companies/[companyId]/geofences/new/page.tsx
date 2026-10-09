'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { RouteGuard } from '@/components/auth/route-guard';
import { createGeofence } from '@/lib/geofence/geofence-api';
import { apiClient } from '@/lib/api/api-client';
import type { GeofenceType, LatLng } from '@ai-mos/types';
import {
  Maximize2,
  Circle as CircleIcon,
  ArrowLeft,
  Undo2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function NewGeofencePage() {
  const params = useParams();
  const router = useRouter();
  const companyId = (params?.['companyId'] as string) || '';

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GeofenceType>('CIRCLE');
  const [color, setColor] = useState('#3b82f6');
  const [isActive, setIsActive] = useState(true);
  const [entryAlertEnabled, setEntryAlertEnabled] = useState(true);
  const [exitAlertEnabled, setExitAlertEnabled] = useState(true);

  // Circle Geometry
  const [circleCenter, setCircleCenter] = useState<LatLng | null>(null);
  const [circleRadius, setCircleRadius] = useState<number>(500);

  // Polygon Geometry
  const [polygonCoords, setPolygonCoords] = useState<LatLng[]>([]);

  // Vehicle assignments
  const [vehicles, setVehicles] = useState<Array<{ id: string; vehicleNumber: string; make: string; model: string }>>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

  // Submission & Validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Leaflet Map Refs
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

  // ─── 2. Fetch Company Vehicles for Assignment Multi-Select ─────────────────
  useEffect(() => {
    if (!companyId) return;
    apiClient
      .get<{ data: Array<{ id: string; vehicleNumber: string; make: string; model: string }> }>(
        '/vehicles',
        { headers: { 'x-company-id': companyId } },
      )
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data ?? [];
        setVehicles(list);
      })
      .catch(() => {});
  }, [companyId]);

  // ─── 3. Initialize Map ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletLib || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = leafletLib;

    const map = L.map(mapContainerRef.current, {
      center: [37.7749, -122.4194],
      zoom: 13,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLib]);

  // ─── 4. Map Click Handler for Geometry Definition ──────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleMapClick = (e: any) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));

      if (type === 'CIRCLE') {
        setCircleCenter({ latitude: lat, longitude: lng });
      } else {
        setPolygonCoords((prev) => [...prev, { latitude: lat, longitude: lng }]);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [type]);

  // ─── 5. Sync Drawn Shapes to Map Preview ───────────────────────────────────
  useEffect(() => {
    if (!leafletLib || !mapInstanceRef.current || !layerGroupRef.current) return;
    const L = leafletLib;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    if (type === 'CIRCLE' && circleCenter) {
      // Draw center marker
      const centerIcon = L.divIcon({
        className: 'custom-center-pin',
        html: `<div style="width:12px; height:12px; background:${color}; border:2px solid white; border-radius:50%; box-shadow:0 0 6px rgba(0,0,0,0.5);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([circleCenter.latitude, circleCenter.longitude], { icon: centerIcon }).addTo(layerGroup);

      // Draw circle overlay
      L.circle([circleCenter.latitude, circleCenter.longitude], {
        radius: circleRadius,
        color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(layerGroup);
    }

    if (type === 'POLYGON' && polygonCoords.length > 0) {
      // Draw vertex markers
      polygonCoords.forEach((pt) => {
        const vertexIcon = L.divIcon({
          className: 'custom-vertex-pin',
          html: `<div style="width:10px; height:10px; background:${color}; border:1.5px solid white; border-radius:50%;"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        L.marker([pt.latitude, pt.longitude], { icon: vertexIcon }).addTo(layerGroup);
      });

      if (polygonCoords.length >= 3) {
        const latLngs = polygonCoords.map((pt) => [pt.latitude, pt.longitude]);
        L.polygon(latLngs, {
          color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2,
        }).addTo(layerGroup);
      } else if (polygonCoords.length === 2) {
        const latLngs = polygonCoords.map((pt) => [pt.latitude, pt.longitude]);
        L.polyline(latLngs, { color, weight: 2, dashArray: '4, 4' }).addTo(layerGroup);
      }
    }
  }, [leafletLib, type, circleCenter, circleRadius, polygonCoords, color]);

  // ─── 6. Submit Geofence Creation ───────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Geofence name is required');
      return;
    }

    let geometry: any;
    if (type === 'CIRCLE') {
      if (!circleCenter) {
        setValidationError('Please click on the map to place the circle center');
        return;
      }
      geometry = {
        center: circleCenter,
        radiusMeters: Number(circleRadius),
      };
    } else {
      if (polygonCoords.length < 3) {
        setValidationError('Polygon requires at least 3 points. Click the map to add vertices.');
        return;
      }
      geometry = {
        coordinates: polygonCoords,
      };
    }

    setIsSubmitting(true);
    try {
      await createGeofence(companyId, {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        geometry,
        color,
        isActive,
        entryAlertEnabled,
        exitAlertEnabled,
        vehicleIds: selectedVehicleIds.length > 0 ? selectedVehicleIds : undefined,
      });

      router.push(`/companies/${companyId}/geofences`);
    } catch (err: any) {
      setValidationError(err.message ?? 'Failed to create geofence');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RouteGuard requiredPermission="geofence.create">
      <div className="flex flex-col gap-6 p-6 min-h-screen bg-slate-950 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/companies/${companyId}/geofences`}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Create Geofence</h1>
              <p className="text-sm text-slate-400">
                Define geographic boundary and alert parameters
              </p>
            </div>
          </div>
        </div>

        {validationError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {validationError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Map Drawing Interface (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setType('CIRCLE')}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                    type === 'CIRCLE'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
                  )}
                >
                  <CircleIcon className="w-3.5 h-3.5" />
                  Circle Mode
                </button>
                <button
                  type="button"
                  onClick={() => setType('POLYGON')}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                    type === 'POLYGON'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700',
                  )}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Polygon Mode
                </button>
              </div>

              {type === 'POLYGON' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">
                    {polygonCoords.length} points
                  </span>
                  <button
                    type="button"
                    disabled={polygonCoords.length === 0}
                    onClick={() => setPolygonCoords((prev) => prev.slice(0, -1))}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
                    title="Undo last point"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={polygonCoords.length === 0}
                    onClick={() => setPolygonCoords([])}
                    className="p-1.5 rounded bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 disabled:opacity-40 transition"
                    title="Clear points"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="relative rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden h-[480px]">
              <div ref={mapContainerRef} className="w-full h-full" />
              <div className="absolute bottom-3 left-3 z-[1000] px-3 py-1.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs text-slate-300">
                {type === 'CIRCLE'
                  ? circleCenter
                    ? `Center: ${circleCenter.latitude.toFixed(4)}, ${circleCenter.longitude.toFixed(4)}`
                    : 'Click map to place circle center'
                  : polygonCoords.length < 3
                    ? `Click map to add points (min 3 required, currently ${polygonCoords.length})`
                    : `Polygon complete (${polygonCoords.length} points). Click to add more.`}
              </div>
            </div>

            {type === 'CIRCLE' && circleCenter && (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-4">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider shrink-0">
                  Radius: {circleRadius}m
                </span>
                <input
                  type="range"
                  min="50"
                  max="10000"
                  step="50"
                  value={circleRadius}
                  onChange={(e) => setCircleRadius(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            )}
          </div>

          {/* Form Fields (5 cols) */}
          <form onSubmit={handleSubmit} className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
              <h2 className="text-base font-semibold text-white">Geofence Settings</h2>

              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Airport Terminal 2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional notes or operational instructions"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">
                  Display Color
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition',
                        color === c ? 'border-white scale-110' : 'border-transparent',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2.5">
                <label className="flex items-center justify-between text-sm cursor-pointer">
                  <span className="text-slate-300">Geofence Active</span>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between text-sm cursor-pointer">
                  <span className="text-slate-300">Alert on Entry</span>
                  <input
                    type="checkbox"
                    checked={entryAlertEnabled}
                    onChange={(e) => setEntryAlertEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between text-sm cursor-pointer">
                  <span className="text-slate-300">Alert on Exit</span>
                  <input
                    type="checkbox"
                    checked={exitAlertEnabled}
                    onChange={(e) => setExitAlertEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                </label>
              </div>

              {/* Vehicle Assignment Multi-Select */}
              <div className="pt-2 border-t border-slate-800">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">
                  Assign Vehicles (Leave empty for all company fleet)
                </label>
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 rounded-lg bg-slate-950 border border-slate-800 p-2">
                  {vehicles.length === 0 ? (
                    <span className="text-xs text-slate-500 block p-2">No vehicles found</span>
                  ) : (
                    vehicles.map((v) => {
                      const isSelected = selectedVehicleIds.includes(v.id);
                      return (
                        <label
                          key={v.id}
                          className="flex items-center justify-between p-2 hover:bg-slate-900 rounded cursor-pointer text-xs"
                        >
                          <span className="font-medium text-slate-200">
                            {v.vehicleNumber} ({v.make} {v.model})
                          </span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedVehicleIds((prev) => [...prev, v.id]);
                              } else {
                                setSelectedVehicleIds((prev) => prev.filter((id) => id !== v.id));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded accent-blue-500"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Creating Geofence...' : 'Save Geofence'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RouteGuard>
  );
}
