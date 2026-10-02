'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { vehicleApi } from '@/lib/vehicle/vehicle-api';
import type { VehicleDto, VehicleDocumentDto, VehicleMaintenanceDto } from '@ai-mos/types';
import {
  Car, ChevronLeft, Loader2, AlertCircle, Fuel, Wrench, FileText,
  Plus, Trash2, X, Save, Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  ACTIVE:      { label: 'Active',      badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  INACTIVE:    { label: 'Inactive',    badge: 'text-slate-400   bg-slate-400/10   border-slate-400/20'   },
  MAINTENANCE: { label: 'Maintenance', badge: 'text-amber-400   bg-amber-400/10   border-amber-400/20'   },
  ON_TRIP:     { label: 'On Trip',     badge: 'text-blue-400    bg-blue-400/10    border-blue-400/20'    },
  RETIRED:     { label: 'Retired',     badge: 'text-red-400     bg-red-400/10     border-red-400/20'     },
};

const MAINT_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  SCHEDULED:   { label: 'Scheduled',   badge: 'text-blue-400  bg-blue-400/10  border-blue-400/20'  },
  IN_PROGRESS: { label: 'In Progress', badge: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  COMPLETED:   { label: 'Completed',   badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  CANCELLED:   { label: 'Cancelled',   badge: 'text-red-400   bg-red-400/10   border-red-400/20'   },
};

const DOC_TYPE_LABEL: Record<string, string> = {
  REGISTRATION_CERTIFICATE: 'Registration Certificate',
  INSURANCE:                'Insurance',
  POLLUTION_CERTIFICATE:    'Pollution Certificate',
  FITNESS_CERTIFICATE:      'Fitness Certificate',
  PERMIT:                   'Permit',
  TAX_TOKEN:                'Tax Token',
  OTHER:                    'Other',
};

const FUEL_LABEL: Record<string, string> = {
  PETROL: 'Petrol', DIESEL: 'Diesel', ELECTRIC: 'Electric',
  HYBRID: 'Hybrid', CNG: 'CNG', LPG: 'LPG', OTHER: 'Other',
};

const INPUT = 'w-full rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';
const SELECT = cn(INPUT, 'cursor-pointer');

// ─── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/20 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

// ─── Add Document Modal ───────────────────────────────────────────────────────
function AddDocumentModal({ vehicleId, companyId, token, onClose, onAdded }: {
  vehicleId: string; companyId: string; token: string;
  onClose: () => void; onAdded: () => void;
}) {
  const [form, setForm] = useState({ documentType: 'INSURANCE', name: '', documentNumber: '', issuedAt: '', expiresAt: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        documentType: form.documentType,
        name: form.name.trim(),
      };
      if (form.documentNumber) payload['documentNumber'] = form.documentNumber.trim();
      if (form.issuedAt) payload['issuedAt'] = form.issuedAt;
      if (form.expiresAt) payload['expiresAt'] = form.expiresAt;
      if (form.notes.trim()) payload['notes'] = form.notes.trim();
      await vehicleApi.addDocument(token, companyId, vehicleId, payload);
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Add Document</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Document Type *</label>
            <select
              value={form.documentType}
              onChange={e => setForm(p => ({ ...p, documentType: e.target.value }))}
              className={SELECT}
              required
            >
              {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Document Name *</label>
            <input type="text" required placeholder="Vehicle Insurance Policy" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Document Number</label>
            <input type="text" placeholder="POL-2024-98765" value={form.documentNumber} onChange={e => setForm(p => ({ ...p, documentNumber: e.target.value }))} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Issued Date</label>
              <input type="date" value={form.issuedAt} onChange={e => setForm(p => ({ ...p, issuedAt: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Expiry Date</label>
              <input type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
            <textarea rows={2} placeholder="Optional notes…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={cn(INPUT, 'resize-none')} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Maintenance Modal ────────────────────────────────────────────────────
function AddMaintenanceModal({ vehicleId, companyId, token, onClose, onAdded }: {
  vehicleId: string; companyId: string; token: string;
  onClose: () => void; onAdded: () => void;
}) {
  const [form, setForm] = useState({ maintenanceType: 'PREVENTIVE', description: '', scheduledAt: '', odometerAtService: '', cost: '', vendor: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        maintenanceType: form.maintenanceType,
        description: form.description.trim(),
      };
      if (form.scheduledAt) payload['scheduledAt'] = form.scheduledAt;
      if (form.odometerAtService) payload['odometerAtService'] = parseInt(form.odometerAtService, 10);
      if (form.cost) payload['cost'] = form.cost;
      if (form.vendor.trim()) payload['vendor'] = form.vendor.trim();
      if (form.notes.trim()) payload['notes'] = form.notes.trim();
      await vehicleApi.addMaintenance(token, companyId, vehicleId, payload);
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add maintenance record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Log Maintenance</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Type</label>
            <select value={form.maintenanceType} onChange={e => setForm(p => ({ ...p, maintenanceType: e.target.value }))} className={SELECT}>
              <option value="PREVENTIVE">Preventive</option>
              <option value="CORRECTIVE">Corrective</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="INSPECTION">Inspection</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Description *</label>
            <textarea required rows={2} placeholder="e.g. Oil change and filter replacement" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={cn(INPUT, 'resize-none')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Scheduled Date</label>
              <input type="date" value={form.scheduledAt} onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Odometer (km)</label>
              <input type="number" min={0} placeholder="45000" value={form.odometerAtService} onChange={e => setForm(p => ({ ...p, odometerAtService: e.target.value }))} className={INPUT} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Cost (₹)</label>
              <input type="text" placeholder="2500.00" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Vendor / Garage</label>
              <input type="text" placeholder="City Garage" value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
            <textarea rows={2} placeholder="Optional notes…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={cn(INPUT, 'resize-none')} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VehicleDetailPage() {
  const { companyId, id } = useParams<{ companyId: string; id: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const [vehicle, setVehicle]       = useState<VehicleDto | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showDocModal, setShowDocModal]   = useState(false);
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  const { hasPermission } = usePermissions();
  const canManage  = hasPermission('vehicle.update');
  const canDelete  = hasPermission('vehicle.delete');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const v = await vehicleApi.get(accessToken, companyId, id);
      setVehicle(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vehicle');
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, id]);

  useEffect(() => { void load(); }, [load]);

  const handleStatusChange = async (newStatus: string) => {
    if (!accessToken || !vehicle) return;
    setStatusChanging(true);
    try {
      await vehicleApi.updateStatus(accessToken, companyId, vehicle.id, newStatus);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setStatusChanging(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !vehicle) return;
    if (!confirm(`Permanently delete vehicle ${vehicle.vehicleNumber}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await vehicleApi.remove(accessToken, companyId, vehicle.id);
      router.push(`/companies/${companyId}/vehicles`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete vehicle');
      setDeleting(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!accessToken || !confirm('Delete this document?')) return;
    await vehicleApi.deleteDocument(accessToken, companyId, id, docId);
    await load();
  };

  const handleMaintStatus = async (maintId: string, status: string) => {
    if (!accessToken) return;
    await vehicleApi.updateMaintenanceStatus(accessToken, companyId, id, maintId, { status });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-lg mx-auto mt-12">
        <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
      </div>
    );
  }

  if (!vehicle) return null;

  const sc = STATUS_CONFIG[vehicle.status] ?? STATUS_CONFIG['ACTIVE']!;
  const allStatuses = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ON_TRIP', 'RETIRED'];

  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
  const isExpiringSoon = (d?: string | null) => {
    if (!d) return false;
    const diff = new Date(d).getTime() - Date.now();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };

  return (
    <RouteGuard requiredPermission="vehicle.read" requireCompany>
      <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href={`/companies/${companyId}/vehicles`} className="hover:text-foreground flex items-center gap-1">
          <ChevronLeft className="h-3.5 w-3.5" /> Vehicles
        </Link>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-foreground font-medium">{vehicle.vehicleNumber}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <Car className="h-7 w-7 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{vehicle.vehicleNumber}</h1>
              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', sc.badge)}>
                {sc.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {vehicle.make} {vehicle.model} · {vehicle.year} · {FUEL_LABEL[vehicle.fuelType] ?? vehicle.fuelType}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={vehicle.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={statusChanging}
              className="rounded-lg border border-border bg-card/50 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              {allStatuses.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
              ))}
            </select>
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-60"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Vehicle details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identity */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-2">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Hash className="h-4 w-4 text-primary" /> Identity
          </h2>
          <InfoRow label="Vehicle Number" value={vehicle.vehicleNumber} />
          <InfoRow label="Make"           value={vehicle.make} />
          <InfoRow label="Model"          value={vehicle.model} />
          <InfoRow label="Year"           value={String(vehicle.year)} />
          <InfoRow label="Color"          value={vehicle.color} />
          <InfoRow label="VIN"            value={vehicle.vin} />
        </div>

        {/* Classification */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-2">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Fuel className="h-4 w-4 text-primary" /> Classification
          </h2>
          <InfoRow label="Fuel Type"     value={FUEL_LABEL[vehicle.fuelType] ?? vehicle.fuelType} />
          <InfoRow label="Ownership"     value={vehicle.ownership} />
          <InfoRow label="Capacity"      value={vehicle.capacity ? `${vehicle.capacity} seats` : null} />
          <InfoRow label="Odometer"      value={`${vehicle.odometer.toLocaleString()} km`} />
          <div className="flex justify-between py-1.5 border-b border-border/20">
            <span className="text-xs text-muted-foreground">Reg. Expiry</span>
            <span className={cn('text-xs font-medium', isExpiringSoon(vehicle.registrationExpiry) ? 'text-amber-400' : 'text-foreground')}>
              {fmtDate(vehicle.registrationExpiry) ?? '—'}
              {isExpiringSoon(vehicle.registrationExpiry) && ' ⚠'}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-xs text-muted-foreground">Ins. Expiry</span>
            <span className={cn('text-xs font-medium', isExpiringSoon(vehicle.insuranceExpiry) ? 'text-orange-400' : 'text-foreground')}>
              {fmtDate(vehicle.insuranceExpiry) ?? '—'}
              {isExpiringSoon(vehicle.insuranceExpiry) && ' ⚠'}
            </span>
          </div>
        </div>
      </div>

      {vehicle.notes && (
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2">Notes</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{vehicle.notes}</p>
        </div>
      )}

      {/* Documents */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Documents
            <span className="text-xs text-muted-foreground font-normal">({vehicle.documents?.length ?? 0})</span>
          </h2>
          {canManage && (
            <button
              onClick={() => setShowDocModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Document
            </button>
          )}
        </div>
        <div className="divide-y divide-border/20">
          {!vehicle.documents?.length ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <FileText className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No documents added yet</p>
            </div>
          ) : vehicle.documents.map((doc: VehicleDocumentDto) => {
            const expSoon = isExpiringSoon(doc.expiresAt);
            return (
              <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5">
                    <FileText className="h-4 w-4 text-primary/70" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                      {doc.documentNumber && ` · #${doc.documentNumber}`}
                      {doc.expiresAt && ` · Exp: `}
                      {doc.expiresAt && <span className={expSoon ? 'text-amber-400' : ''}>{fmtDate(doc.expiresAt)}{expSoon ? ' ⚠' : ''}</span>}
                    </p>
                  </div>
                </div>
                {canDelete && (
                  <button onClick={() => handleDeleteDoc(doc.id)} className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Maintenance */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" /> Maintenance History
            <span className="text-xs text-muted-foreground font-normal">({vehicle.maintenances?.length ?? 0})</span>
          </h2>
          {canManage && (
            <button
              onClick={() => setShowMaintModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Log Maintenance
            </button>
          )}
        </div>
        <div className="divide-y divide-border/20">
          {!vehicle.maintenances?.length ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Wrench className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No maintenance records yet</p>
            </div>
          ) : vehicle.maintenances.map((m: VehicleMaintenanceDto) => {
            const msc = MAINT_STATUS_CONFIG[m.status] ?? MAINT_STATUS_CONFIG['SCHEDULED']!;
            return (
              <div key={m.id} className="px-5 py-3 hover:bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{m.description}</p>
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', msc.badge)}>
                        {msc.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.maintenanceType}
                      {m.vendor && ` · ${m.vendor}`}
                      {m.cost && ` · ₹${m.cost}`}
                      {m.odometerAtService && ` · ${m.odometerAtService.toLocaleString()} km`}
                      {m.scheduledAt && ` · Scheduled: ${fmtDate(m.scheduledAt)}`}
                    </p>
                  </div>
                  {canManage && m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && (
                    <div className="flex gap-1.5">
                      {m.status === 'SCHEDULED' && (
                        <button
                          onClick={() => handleMaintStatus(m.id, 'IN_PROGRESS')}
                          className="rounded px-2 py-1 text-[10px] bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {m.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleMaintStatus(m.id, 'COMPLETED')}
                          className="rounded px-2 py-1 text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors"
                        >
                          Complete
                        </button>
                      )}
                      <button
                        onClick={() => handleMaintStatus(m.id, 'CANCELLED')}
                        className="rounded px-2 py-1 text-[10px] bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showDocModal && accessToken && (
        <AddDocumentModal
          vehicleId={id}
          companyId={companyId}
          token={accessToken}
          onClose={() => setShowDocModal(false)}
          onAdded={load}
        />
      )}
      {showMaintModal && accessToken && (
        <AddMaintenanceModal
          vehicleId={id}
          companyId={companyId}
          token={accessToken}
          onClose={() => setShowMaintModal(false)}
          onAdded={load}
        />
      )}
      </div>
    </RouteGuard>
  );
}
