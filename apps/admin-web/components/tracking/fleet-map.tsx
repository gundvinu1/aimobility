'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { FleetTrackingVehicleDto, GeofenceDto, CircleGeometry, PolygonGeometry } from '@ai-mos/types';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

interface FleetMapProps {
  vehicles: FleetTrackingVehicleDto[];
  selectedVehicleId?: string | null;
  onSelectVehicle: (_vehicle: FleetTrackingVehicleDto) => void;
  className?: string;
  activeAlertVehicleIds?: Set<string>;
  geofences?: GeofenceDto[];
  showGeofences?: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  ACTIVE:      { bg: '#10b981', border: '#059669', text: '#ffffff' },
  ON_TRIP:     { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
  IDLE:        { bg: '#f59e0b', border: '#d97706', text: '#ffffff' },
  OFFLINE:     { bg: '#71717a', border: '#52525b', text: '#ffffff' },
  MAINTENANCE: { bg: '#f97316', border: '#ea580c', text: '#ffffff' },
};

export function FleetMap({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  className,
  activeAlertVehicleIds,
  geofences = [],
  showGeofences = false,
}: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const geofenceLayerGroupRef = useRef<any>(null);
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;
  const [mapReady, setMapReady] = useState(false);
  const [leafletLib, setLeafletLib] = useState<any>(null);

  // ─── 1. Load Leaflet dynamically on client mount ────────────────────────────
  useEffect(() => {
    let isMounted = true;
    import('leaflet').then((L) => {
      if (isMounted) {
        setLeafletLib(L);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // ─── 2. Initialize Leaflet Map ──────────────────────────────────────────────
  useEffect(() => {
    if (!leafletLib || !mapContainerRef.current || mapInstanceRef.current) return;

    const L = leafletLib;

    const initialLat = vehiclesRef.current.find((v) => v.location)?.location?.latitude ?? 37.7749;
    const initialLng = vehiclesRef.current.find((v) => v.location)?.location?.longitude ?? -122.4194;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    geofenceLayerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    setMapReady(true);

    const currentMarkers = markersRef.current;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      currentMarkers.clear();
      geofenceLayerGroupRef.current = null;
      setMapReady(false);
    };
  }, [leafletLib]);

  // ─── 3. Sync Geofence Boundaries Overlay ──────────────────────────────────
  useEffect(() => {
    if (!mapReady || !leafletLib || !geofenceLayerGroupRef.current) return;
    const L = leafletLib;
    const layerGroup = geofenceLayerGroupRef.current;
    layerGroup.clearLayers();

    if (!showGeofences || !geofences || geofences.length === 0) return;

    geofences.forEach((geo) => {
      if (!geo.isActive) return;
      const geoColor = geo.color || '#3b82f6';

      if (geo.type === 'CIRCLE') {
        const circleGeom = geo.geometry as CircleGeometry;
        if (circleGeom?.center) {
          const circle = L.circle([circleGeom.center.latitude, circleGeom.center.longitude], {
            radius: circleGeom.radiusMeters,
            color: geoColor,
            fillColor: geoColor,
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '4, 4',
          }).addTo(layerGroup);

          circle.bindTooltip(`<b>${geo.name}</b> (Geofence)`, { sticky: true, opacity: 0.9 });
        }
      } else if (geo.type === 'POLYGON') {
        const polyGeom = geo.geometry as PolygonGeometry;
        if (polyGeom?.coordinates?.length) {
          const latLngs = polyGeom.coordinates.map((c) => [c.latitude, c.longitude] as [number, number]);
          const polygon = L.polygon(latLngs, {
            color: geoColor,
            fillColor: geoColor,
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '4, 4',
          }).addTo(layerGroup);

          polygon.bindTooltip(`<b>${geo.name}</b> (Geofence)`, { sticky: true, opacity: 0.9 });
        }
      }
    });
  }, [mapReady, leafletLib, showGeofences, geofences]);

  // ─── 4. Sync Vehicle Markers without re-rendering entire map ─────────────────
  useEffect(() => {
    if (!mapReady || !leafletLib || !mapInstanceRef.current) return;
    const L = leafletLib;
    const map = mapInstanceRef.current;
    const currentMarkers = markersRef.current;

    const validVehicles = vehicles.filter((v) => v.location && v.location.latitude && v.location.longitude);
    const activeIds = new Set<string>();

    validVehicles.forEach((vehicle) => {
      const loc = vehicle.location!;
      const vehicleId = vehicle.vehicleId;
      activeIds.add(vehicleId);

      const isSelected = selectedVehicleId === vehicleId;
      const hasActiveAlert = activeAlertVehicleIds?.has(vehicleId);
      const statusColor = STATUS_COLORS[vehicle.fleetStatus] ?? STATUS_COLORS['ACTIVE'];
      const heading = loc.heading ?? 0;

      // Custom HTML Marker with sleek pulse, orientation arrow, and alert indicator
      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-110" style="width: 44px; height: 44px;">
          ${
            hasActiveAlert
              ? `<div class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-md ring-2 ring-background animate-bounce z-30">!</div>`
              : ''
          }
          ${
            isSelected
              ? `<div class="absolute -inset-2 rounded-full animate-ping opacity-30" style="background-color: ${statusColor.bg};"></div>`
              : ''
          }
          <div class="relative flex items-center justify-center w-9 h-9 rounded-full shadow-lg border-2 transition-all"
               style="background-color: ${statusColor.bg}; border-color: ${isSelected ? '#ffffff' : hasActiveAlert ? '#ef4444' : statusColor.border}; box-shadow: 0 4px 14px ${statusColor.bg}66;">
            <div style="transform: rotate(${heading}deg); transform-origin: center; display: flex; align-items: center; justify-center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
              </svg>
            </div>
          </div>
          <div class="absolute -bottom-5 whitespace-nowrap bg-background/90 text-foreground font-semibold text-[10px] px-1.5 py-0.5 rounded shadow border border-border/40 pointer-events-none">
            ${vehicle.vehicleNumber}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'aimos-marker-container',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      if (currentMarkers.has(vehicleId)) {
        const marker = currentMarkers.get(vehicleId);
        marker.setLatLng([loc.latitude, loc.longitude]);
        marker.setIcon(customIcon);
        if (isSelected || hasActiveAlert) {
          marker.setZIndexOffset(1000);
        } else {
          marker.setZIndexOffset(0);
        }
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: customIcon,
          zIndexOffset: isSelected || hasActiveAlert ? 1000 : 0,
        }).addTo(map);

        marker.on('click', () => {
          onSelectVehicle(vehicle);
        });

        currentMarkers.set(vehicleId, marker);
      }
    });

    for (const [id, marker] of currentMarkers.entries()) {
      if (!activeIds.has(id)) {
        map.removeLayer(marker);
        currentMarkers.delete(id);
      }
    }
  }, [mapReady, leafletLib, vehicles, selectedVehicleId, activeAlertVehicleIds, onSelectVehicle]);

  // ─── 5. Pan to Selected Vehicle ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !selectedVehicleId) return;
    const selected = vehicles.find((v) => v.vehicleId === selectedVehicleId);
    if (selected?.location) {
      mapInstanceRef.current.flyTo(
        [selected.location.latitude, selected.location.longitude],
        16,
        { duration: 1.2 },
      );
    }
  }, [selectedVehicleId, mapReady, vehicles]);

  // ─── Controls: Fit Bounds ───────────────────────────────────────────────────
  const fitAllBounds = () => {
    if (!mapReady || !leafletLib || !mapInstanceRef.current) return;
    const validLocs = vehicles
      .filter((v) => v.location)
      .map((v) => [v.location!.latitude, v.location!.longitude]);

    if (validLocs.length > 0) {
      const bounds = leafletLib.latLngBounds(validLocs);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  };

  const zoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const zoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-xl border border-border/30 shadow-inner', className)}>
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="h-full w-full bg-muted/20" />

      {/* Floating Modern Map Controls */}
      <div className="absolute right-4 top-4 z-[400] flex flex-col gap-2">
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom In"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 backdrop-blur border border-border/40 text-foreground shadow-md hover:bg-accent transition"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom Out"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 backdrop-blur border border-border/40 text-foreground shadow-md hover:bg-accent transition"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={fitAllBounds}
          title="Fit all vehicles in view"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 backdrop-blur border border-border/40 text-foreground shadow-md hover:bg-accent transition"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Status Legend Floating Bar */}
      <div className="absolute bottom-4 left-4 z-[400] hidden sm:flex items-center gap-3 rounded-lg bg-card/90 backdrop-blur border border-border/40 px-3 py-2 text-xs shadow-md">
        <span className="font-semibold text-muted-foreground mr-1 text-[11px] uppercase tracking-wider">Legend</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" />
          <span className="text-foreground text-[11px]">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm" />
          <span className="text-foreground text-[11px]">On Trip</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm" />
          <span className="text-foreground text-[11px]">Idle</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-500 shadow-sm" />
          <span className="text-foreground text-[11px]">Offline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm" />
          <span className="text-foreground text-[11px]">Maintenance</span>
        </div>
        {activeAlertVehicleIds && activeAlertVehicleIds.size > 0 && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-border/60">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse shadow-sm" />
            <span className="text-red-400 font-semibold text-[11px]">Active Alert ({activeAlertVehicleIds.size})</span>
          </div>
        )}
      </div>
    </div>
  );
}
