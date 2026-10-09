'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import { fetchAlertConfig, updateAlertConfig } from '@/lib/alert/alert-api';
import type { UpdateCompanyAlertConfigDto } from '@ai-mos/types';
import {
  Sliders,
  Gauge,
  Clock,
  AlertOctagon,
  Maximize2,
  Check,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Save,
} from 'lucide-react';

export default function AlertSettingsPage() {
  const params = useParams();
  const companyId = (params?.['companyId'] as string) || '';

  const { hasPermission } = usePermissions();
  const canConfigure = hasPermission('alert.configure');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<UpdateCompanyAlertConfigDto>({
    overspeedEnabled: true,
    overspeedThresholdKmH: 80,
    overspeedGracePeriodSeconds: 5,
    excessiveIdleEnabled: true,
    excessiveIdleThresholdMinutes: 10,
    harshBrakingEnabled: true,
    harshBrakingThresholdKmhPerSec: 15,
    geofenceEntryAlertsEnabled: true,
    geofenceExitAlertsEnabled: true,
  });

  const loadConfig = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const config = await fetchAlertConfig(companyId);
      setFormData({
        overspeedEnabled: config.overspeedEnabled,
        overspeedThresholdKmH: config.overspeedThresholdKmH,
        overspeedGracePeriodSeconds: config.overspeedGracePeriodSeconds,
        excessiveIdleEnabled: config.excessiveIdleEnabled,
        excessiveIdleThresholdMinutes: config.excessiveIdleThresholdMinutes,
        harshBrakingEnabled: config.harshBrakingEnabled,
        harshBrakingThresholdKmhPerSec: config.harshBrakingThresholdKmhPerSec,
        geofenceEntryAlertsEnabled: config.geofenceEntryAlertsEnabled,
        geofenceExitAlertsEnabled: config.geofenceExitAlertsEnabled,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load company alert configuration');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfigure || isSaving) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await updateAlertConfig(companyId, formData);
      setSuccessMessage('Alert configuration saved successfully');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save alert configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setFormData({
      overspeedEnabled: true,
      overspeedThresholdKmH: 80,
      overspeedGracePeriodSeconds: 5,
      excessiveIdleEnabled: true,
      excessiveIdleThresholdMinutes: 10,
      harshBrakingEnabled: true,
      harshBrakingThresholdKmhPerSec: 15,
      geofenceEntryAlertsEnabled: true,
      geofenceExitAlertsEnabled: true,
    });
  };

  return (
    <RouteGuard requiredPermissions={['alert.configure']}>
      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sliders className="h-6 w-6 text-primary" />
              Fleet Alert Configuration
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure detection thresholds and safety triggers for telemetry processing across your fleet
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={isSaving || isLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Defaults
            </button>
            <button
              type="submit"
              form="alert-config-form"
              disabled={isSaving || isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form id="alert-config-form" onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Overspeed Detection */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Gauge className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Overspeed Detection</h2>
                    <p className="text-xs text-muted-foreground">
                      Flags vehicles exceeding company speed limits with debounce & grace period
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.overspeedEnabled}
                    onChange={(e) => setFormData({ ...formData, overspeedEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {formData.overspeedEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/40">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Speed Limit Threshold (km/h)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="200"
                      value={formData.overspeedThresholdKmH}
                      onChange={(e) =>
                        setFormData({ ...formData, overspeedThresholdKmH: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Speeds above this value trigger an overspeed evaluation (Recommended: 80 km/h)
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Grace Period (seconds)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={formData.overspeedGracePeriodSeconds}
                      onChange={(e) =>
                        setFormData({ ...formData, overspeedGracePeriodSeconds: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Continuous duration speed must remain above threshold before raising an alert (Prevents transient spikes)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Excessive Idle Detection */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Excessive Idle Detection</h2>
                    <p className="text-xs text-muted-foreground">
                      Detects stationary vehicles running ignition without moving, wasting fuel and increasing emissions
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.excessiveIdleEnabled}
                    onChange={(e) => setFormData({ ...formData, excessiveIdleEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {formData.excessiveIdleEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/40">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Idle Duration Threshold (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      step="1"
                      value={formData.excessiveIdleThresholdMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          excessiveIdleThresholdMinutes: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Triggered when vehicle ignition is ON and speed &lt; 2 km/h for more than{' '}
                      <span className="font-semibold text-foreground">
                        {formData.excessiveIdleThresholdMinutes} minutes
                      </span>.
                    </p>
                  </div>

                  <div className="flex items-center p-3 rounded-lg border border-border/40 bg-muted/20 text-xs text-muted-foreground">
                    <Info className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                    Idle tracking is managed in-memory via Redis state and resets automatically when the vehicle resumes motion (&gt; 3 km/h) or ignition is switched off.
                  </div>
                </div>
              )}
            </div>

            {/* 3. Harsh Braking Detection */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                    <AlertOctagon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Harsh Braking Detection</h2>
                    <p className="text-xs text-muted-foreground">
                      Calculates deceleration rate (Δspeed / Δtime) between consecutive telemetry updates
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.harshBrakingEnabled}
                    onChange={(e) => setFormData({ ...formData, harshBrakingEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {formData.harshBrakingEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/40">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Deceleration Threshold (km/h per second)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={formData.harshBrakingThresholdKmhPerSec}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          harshBrakingThresholdKmhPerSec: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Rapid speed drop exceeding this rate indicates emergency or harsh braking (Default: 15 km/h/s ≈ 4.16 m/s²)
                    </p>
                  </div>

                  <div className="flex items-center p-3 rounded-lg border border-border/40 bg-muted/20 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 mr-2 flex-shrink-0" />
                    Harsh braking events are categorized as HIGH severity and immediately recorded for driver safety profile scoring.
                  </div>
                </div>
              )}
            </div>

            {/* 4. Geofencing Boundary Alerts */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Maximize2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Geofence Boundary Monitoring</h2>
                  <p className="text-xs text-muted-foreground">
                    Global company-level master switches for entry and exit transitions across all active geofences
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/10">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Geofence Entry Alerts</div>
                    <div className="text-xs text-muted-foreground">
                      Notify when a vehicle enters an assigned circular or polygon zone
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.geofenceEntryAlertsEnabled}
                      onChange={(e) =>
                        setFormData({ ...formData, geofenceEntryAlertsEnabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/10">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Geofence Exit Alerts</div>
                    <div className="text-xs text-muted-foreground">
                      Notify when an assigned vehicle leaves its permitted zone boundary
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.geofenceExitAlertsEnabled}
                      onChange={(e) =>
                        setFormData({ ...formData, geofenceExitAlertsEnabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </RouteGuard>
  );
}
