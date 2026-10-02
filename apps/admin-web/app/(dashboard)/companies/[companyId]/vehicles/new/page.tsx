'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { vehicleApi } from '@/lib/vehicle/vehicle-api';
import { Car, ChevronLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';

// ─── Form field helpers ───────────────────────────────────────────────────────
function FieldGroup({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const INPUT = 'w-full rounded-lg border border-border bg-card/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const SELECT = cn(INPUT, 'cursor-pointer');

export default function NewVehiclePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  const [form, setForm] = useState({
    vehicleNumber: '',
    make: '',
    model: '',
    year: new Date().getFullYear().toString(),
    color: '',
    vin: '',
    fuelType: 'DIESEL',
    ownership: 'OWNED',
    capacity: '',
    odometer: '0',
    registrationExpiry: '',
    insuranceExpiry: '',
    notes: '',
  });

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
        make:          form.make.trim(),
        model:         form.model.trim(),
        year:          parseInt(form.year, 10),
        fuelType:      form.fuelType,
        ownership:     form.ownership,
        odometer:      parseInt(form.odometer || '0', 10),
      };
      if (form.color)               payload['color']               = form.color.trim();
      if (form.vin)                 payload['vin']                 = form.vin.trim().toUpperCase();
      if (form.capacity)            payload['capacity']            = parseInt(form.capacity, 10);
      if (form.registrationExpiry)  payload['registrationExpiry']  = form.registrationExpiry;
      if (form.insuranceExpiry)     payload['insuranceExpiry']     = form.insuranceExpiry;
      if (form.notes.trim())        payload['notes']               = form.notes.trim();

      await vehicleApi.create(accessToken, companyId, payload);
      setSuccess(true);
      setTimeout(() => router.push(`/companies/${companyId}/vehicles`), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RouteGuard requiredPermission="vehicle.create" requireCompany>
      <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/companies/${companyId}/vehicles`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Vehicles
        </Link>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-xs text-foreground font-medium">New Vehicle</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Car className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Add Vehicle</h1>
          <p className="text-xs text-muted-foreground">Register a new vehicle for this company</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Vehicle created! Redirecting…
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border/30 pb-3">Vehicle Identity</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Registration Number" required hint="e.g. MH12AB1234 (uppercase, no spaces)">
              <input
                id="vehicle-number"
                type="text"
                required
                placeholder="MH12AB1234"
                value={form.vehicleNumber}
                onChange={e => set('vehicleNumber', e.target.value.toUpperCase())}
                className={INPUT}
              />
            </FieldGroup>
            <FieldGroup label="VIN" hint="17-character Vehicle Identification Number (optional)">
              <input
                id="vehicle-vin"
                type="text"
                placeholder="MATP23BA4N7123456"
                maxLength={17}
                value={form.vin}
                onChange={e => set('vin', e.target.value.toUpperCase())}
                className={INPUT}
              />
            </FieldGroup>
            <FieldGroup label="Make" required hint="e.g. Toyota, Tata, Maruti">
              <input
                id="vehicle-make"
                type="text"
                required
                placeholder="Toyota"
                value={form.make}
                onChange={e => set('make', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
            <FieldGroup label="Model" required hint="e.g. Innova Crysta, Ace Gold">
              <input
                id="vehicle-model"
                type="text"
                required
                placeholder="Innova Crysta"
                value={form.model}
                onChange={e => set('model', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
            <FieldGroup label="Year" required>
              <input
                id="vehicle-year"
                type="number"
                required
                min={1900}
                max={2100}
                value={form.year}
                onChange={e => set('year', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
            <FieldGroup label="Color">
              <input
                id="vehicle-color"
                type="text"
                placeholder="White"
                value={form.color}
                onChange={e => set('color', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
          </div>
        </div>

        {/* Classification */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border/30 pb-3">Classification</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <FieldGroup label="Fuel Type" required>
              <select
                id="vehicle-fuel-type"
                value={form.fuelType}
                onChange={e => set('fuelType', e.target.value)}
                className={SELECT}
              >
                <option value="PETROL">Petrol</option>
                <option value="DIESEL">Diesel</option>
                <option value="ELECTRIC">Electric</option>
                <option value="HYBRID">Hybrid</option>
                <option value="CNG">CNG</option>
                <option value="LPG">LPG</option>
                <option value="OTHER">Other</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Ownership" required>
              <select
                id="vehicle-ownership"
                value={form.ownership}
                onChange={e => set('ownership', e.target.value)}
                className={SELECT}
              >
                <option value="OWNED">Owned</option>
                <option value="LEASED">Leased</option>
                <option value="RENTED">Rented</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Seating Capacity" hint="No. of passengers">
              <input
                id="vehicle-capacity"
                type="number"
                min={1}
                placeholder="7"
                value={form.capacity}
                onChange={e => set('capacity', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
            <FieldGroup label="Current Odometer (km)">
              <input
                id="vehicle-odometer"
                type="number"
                min={0}
                placeholder="0"
                value={form.odometer}
                onChange={e => set('odometer', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
          </div>
        </div>

        {/* Registration */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground border-b border-border/30 pb-3">Registration & Compliance</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Registration Expiry" hint="Date when RC expires">
              <input
                id="vehicle-reg-expiry"
                type="date"
                value={form.registrationExpiry}
                onChange={e => set('registrationExpiry', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
            <FieldGroup label="Insurance Expiry" hint="Date when insurance expires">
              <input
                id="vehicle-ins-expiry"
                type="date"
                value={form.insuranceExpiry}
                onChange={e => set('insuranceExpiry', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <FieldGroup label="Notes">
            <textarea
              id="vehicle-notes"
              placeholder="Any additional information about this vehicle…"
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className={cn(INPUT, 'resize-none')}
            />
          </FieldGroup>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/companies/${companyId}/vehicles`}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            id="submit-vehicle"
            disabled={submitting || success}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
            {submitting ? 'Creating…' : 'Create Vehicle'}
          </button>
        </div>
      </form>
    </div>
  </RouteGuard>
  );
}
