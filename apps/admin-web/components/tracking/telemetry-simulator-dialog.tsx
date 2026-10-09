'use client';

import React, { useState } from 'react';
import type { FleetTrackingVehicleDto } from '@ai-mos/types';
import { trackingApi } from '@/lib/tracking/tracking-api';
import { useAuth } from '@/lib/auth/auth-context';
import {
  X,
  Send,
  Zap,
  Gauge,
  Compass,
  MapPin,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TelemetrySimulatorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: FleetTrackingVehicleDto[];
  initialVehicle?: FleetTrackingVehicleDto | null;
  companyId: string;
}

export function TelemetrySimulatorDialog({
  isOpen,
  onClose,
  vehicles,
  initialVehicle,
  companyId,
}: TelemetrySimulatorDialogProps) {
  const { accessToken } = useAuth();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    initialVehicle?.vehicleId ?? vehicles[0]?.vehicleId ?? '',
  );

  const selectedVehicle = vehicles.find((v) => v.vehicleId === selectedVehicleId) ?? initialVehicle;
  const currentLoc = selectedVehicle?.location;

  const [latitude, setLatitude] = useState<number>(currentLoc?.latitude ?? 37.7749);
  const [longitude, setLongitude] = useState<number>(currentLoc?.longitude ?? -122.4194);
  const [speed, setSpeed] = useState<number>(currentLoc?.speed ?? 45);
  const [heading, setHeading] = useState<number>(currentLoc?.heading ?? 90);
  const [ignition, setIgnition] = useState<boolean>(currentLoc?.ignition ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleStep = (dLat: number, dLng: number, newHeading: number) => {
    setLatitude((prev) => Number((prev + dLat).toFixed(5)));
    setLongitude((prev) => Number((prev + dLng).toFixed(5)));
    setHeading(newHeading);
  };

  const handleSendPing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return;

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await trackingApi.ingestTelemetry(
        {
          vehicleId: selectedVehicleId,
          latitude: Number(latitude),
          longitude: Number(longitude),
          speed: Number(speed),
          heading: Number(heading),
          accuracy: 4.5,
          altitude: 12.0,
          ignition,
          source: 'SIMULATOR',
          timestamp: new Date().toISOString(),
        },
        companyId,
        accessToken ?? undefined,
      );

      setStatusMsg({
        type: 'success',
        text: `Ping sent! Vehicle ${selectedVehicle?.vehicleNumber ?? ''} moved.`,
      });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message ?? 'Failed to ingest telemetry',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border/30 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">Telemetry Simulator</h2>
              <p className="text-xs text-muted-foreground">Emit live GPS events for real-time tracking demo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSendPing} className="space-y-4 pt-4">
          {/* Vehicle Select */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Select Vehicle
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedVehicleId(id);
                const v = vehicles.find((item) => item.vehicleId === id);
                if (v?.location) {
                  setLatitude(v.location.latitude);
                  setLongitude(v.location.longitude);
                  setSpeed(v.location.speed);
                  setHeading(v.location.heading ?? 0);
                  setIgnition(v.location.ignition);
                }
              }}
              className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {vehicles.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.vehicleNumber} — {v.make} {v.model} ({v.fleetStatus})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Step Buttons (Move North, South, East, West) */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Quick Directional Move (+0.002° ~ 200m)
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleStep(0.002, 0, 0)}
                className="rounded-lg border border-border/30 bg-muted/10 py-1.5 text-xs font-medium hover:bg-accent transition"
              >
                North ↑
              </button>
              <button
                type="button"
                onClick={() => handleStep(-0.002, 0, 180)}
                className="rounded-lg border border-border/30 bg-muted/10 py-1.5 text-xs font-medium hover:bg-accent transition"
              >
                South ↓
              </button>
              <button
                type="button"
                onClick={() => handleStep(0, 0.002, 90)}
                className="rounded-lg border border-border/30 bg-muted/10 py-1.5 text-xs font-medium hover:bg-accent transition"
              >
                East →
              </button>
              <button
                type="button"
                onClick={() => handleStep(0, -0.002, 270)}
                className="rounded-lg border border-border/30 bg-muted/10 py-1.5 text-xs font-medium hover:bg-accent transition"
              >
                West ←
              </button>
            </div>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.00001"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.00001"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Speed & Heading */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <Gauge className="h-3 w-3" /> Speed (km/h): {speed}
              </label>
              <input
                type="range"
                min="0"
                max="160"
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                <Compass className="h-3 w-3" /> Heading (°): {heading}
              </label>
              <input
                type="range"
                min="0"
                max="360"
                value={heading}
                onChange={(e) => setHeading(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
          </div>

          {/* Ignition Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/10 p-3">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Zap className={cn('h-3.5 w-3.5', ignition ? 'text-amber-400' : 'text-muted-foreground')} />
              Ignition Engine Status
            </span>
            <button
              type="button"
              onClick={() => setIgnition(!ignition)}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                ignition ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                  ignition ? 'translate-x-4' : 'translate-x-1',
                )}
              />
            </button>
          </div>

          {/* Feedback banner */}
          {statusMsg && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl p-3 text-xs font-medium border',
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-destructive/10 text-destructive border-destructive/20',
              )}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border/40 px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Broadcast Telemetry Ping
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
