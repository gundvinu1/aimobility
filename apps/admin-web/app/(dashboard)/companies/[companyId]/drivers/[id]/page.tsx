'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { driverApi } from '@/lib/driver/driver-api';
import { vehicleApi } from '@/lib/vehicle/vehicle-api';
import type {
  DriverDto,
  DriverDocumentDto,
  DriverDutyLogDto,
  DriverVehicleAssignmentDto,
  VehicleSummaryDto,
} from '@ai-mos/types';
import {
  UserCheck, ChevronLeft, Loader2, AlertCircle,
  Car, Shield, Clock, AlertTriangle, FileText, Plus, Trash2,
  ExternalLink, User, Phone, Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';

// ─── Status Configs ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  ACTIVE:     { label: 'Active',     badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  INACTIVE:   { label: 'Inactive',   badge: 'text-slate-400   bg-slate-400/10   border-slate-400/20'   },
  SUSPENDED:  { label: 'Suspended',  badge: 'text-amber-400   bg-amber-400/10   border-amber-400/20'   },
  TERMINATED: { label: 'Terminated', badge: 'text-red-400     bg-red-400/10     border-red-400/20'     },
};

const DUTY_STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  OFF_DUTY:    { label: 'Off Duty',    dot: 'bg-slate-400',   badge: 'text-slate-400   bg-slate-400/10   border-slate-400/20'   },
  ON_DUTY:     { label: 'On Duty',     dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  ON_TRIP:     { label: 'On Trip',     dot: 'bg-blue-400',    badge: 'text-blue-400    bg-blue-400/10    border-blue-400/20'    },
  ON_BREAK:    { label: 'On Break',    dot: 'bg-amber-400',   badge: 'text-amber-400   bg-amber-400/10   border-amber-400/20'   },
  UNAVAILABLE: { label: 'Unavailable', dot: 'bg-rose-400',    badge: 'text-rose-400    bg-rose-400/10    border-rose-400/20'    },
};

const DOC_TYPES = [
  { value: 'DRIVING_LICENSE',     label: 'Driving License' },
  { value: 'BADGE',               label: 'Commercial Badge' },
  { value: 'POLICE_VERIFICATION', label: 'Police Verification' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate' },
  { value: 'IDENTITY_PROOF',      label: 'Identity Proof (Passport/National ID)' },
  { value: 'ADDRESS_PROOF',       label: 'Address Proof' },
  { value: 'OTHER',               label: 'Other Document' },
];

export default function DriverDetailPage() {
  const { companyId, id: driverId } = useParams<{ companyId: string; id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [driver, setDriver] = useState<DriverDto | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<DriverVehicleAssignmentDto | null>(null);
  const [documents, setDocuments] = useState<DriverDocumentDto[]>([]);
  const [dutyLogs, setDutyLogs] = useState<DriverDutyLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: 'overview' | 'vehicle' | 'documents' | 'duty'
  const [tab, setTab] = useState<'overview' | 'vehicle' | 'documents' | 'duty'>('overview');

  // Modals state
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [dutyStatusInput, setDutyStatusInput] = useState('ON_DUTY');
  const [dutyNotesInput, setDutyNotesInput] = useState('');
  const [dutySubmitting, setDutySubmitting] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState<VehicleSummaryDto[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const [showDocModal, setShowDocModal] = useState(false);
  const [docType, setDocType] = useState('POLICE_VERIFICATION');
  const [docNumber, setDocNumber] = useState('');
  const [docIssueDate, setDocIssueDate] = useState('');
  const [docExpiryDate, setDocExpiryDate] = useState('');
  const [docFileUrl, setDocFileUrl] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [docSubmitting, setDocSubmitting] = useState(false);

  const { hasPermission } = usePermissions();
  const canManage = hasPermission('driver.update');
  const canDelete = hasPermission('driver.delete');

  const loadDriver = useCallback(async () => {
    if (!accessToken || !companyId || !driverId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, v, docs, logs] = await Promise.all([
        driverApi.get(accessToken, companyId, driverId),
        driverApi.getVehicle(accessToken, companyId, driverId),
        driverApi.getDocuments(accessToken, companyId, driverId),
        driverApi.getDutyHistory(accessToken, companyId, driverId),
      ]);
      setDriver(d);
      setAssignedVehicle(v);
      setDocuments(docs);
      setDutyLogs(logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load driver details');
    } finally {
      setLoading(false);
    }
  }, [accessToken, companyId, driverId]);

  useEffect(() => {
    loadDriver();
  }, [loadDriver]);

  // Handle duty status change
  const handleUpdateDutyStatus = async () => {
    if (!accessToken || !companyId) return;
    setDutySubmitting(true);
    try {
      await driverApi.updateDutyStatus(
        accessToken,
        companyId,
        driverId,
        dutyStatusInput,
        dutyNotesInput || undefined,
      );
      setShowDutyModal(false);
      setDutyNotesInput('');
      loadDriver();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update duty status');
    } finally {
      setDutySubmitting(false);
    }
  };

  // Handle operational status
  const handleUpdateStatus = async (status: string) => {
    if (!accessToken || !companyId) return;
    try {
      await driverApi.updateStatus(accessToken, companyId, driverId, status);
      loadDriver();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  // Open assign vehicle modal
  const openAssignModal = async () => {
    if (!accessToken || !companyId) return;
    setShowAssignModal(true);
    try {
      const res = await vehicleApi.list(accessToken, companyId, { limit: 100, status: 'ACTIVE' });
      setAvailableVehicles(res.vehicles ?? []);
      if (res.vehicles?.length > 0) setSelectedVehicleId(res.vehicles[0].id);
    } catch {
      // non-blocking
    }
  };

  const handleAssignVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !companyId || !selectedVehicleId) return;
    setAssignSubmitting(true);
    try {
      await driverApi.assignVehicle(accessToken, companyId, driverId, {
        vehicleId: selectedVehicleId,
        notes: assignNotes || undefined,
      });
      setShowAssignModal(false);
      setAssignNotes('');
      loadDriver();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to assign vehicle');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleUnassignVehicle = async () => {
    if (!confirm('Unassign this vehicle from the driver?')) return;
    if (!accessToken || !companyId) return;
    try {
      await driverApi.unassignVehicle(accessToken, companyId, driverId);
      loadDriver();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to unassign vehicle');
    }
  };

  // Add document
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !companyId) return;
    setDocSubmitting(true);
    try {
      await driverApi.addDocument(accessToken, companyId, driverId, {
        documentType: docType,
        documentNumber: docNumber || undefined,
        issueDate: docIssueDate || undefined,
        expiryDate: docExpiryDate || undefined,
        fileUrl: docFileUrl || undefined,
        notes: docNotes || undefined,
      });
      setShowDocModal(false);
      setDocNumber('');
      setDocIssueDate('');
      setDocExpiryDate('');
      setDocFileUrl('');
      setDocNotes('');
      loadDriver();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add document');
    } finally {
      setDocSubmitting(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    if (!accessToken || !companyId) return;
    try {
      await driverApi.deleteDocument(accessToken, companyId, driverId, docId);
      loadDriver();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete document');
    }
  };

  const handleDeleteDriver = async () => {
    if (!confirm(`Are you sure you want to delete driver ${driver?.driverCode}? This cannot be undone.`))
      return;
    if (!accessToken || !companyId) return;
    try {
      await driverApi.remove(accessToken, companyId, driverId);
      router.push(`/companies/${companyId}/drivers`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete driver');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Link
          href={`/companies/${companyId}/drivers`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Drivers
        </Link>
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error ?? 'Driver not found'}</span>
        </div>
      </div>
    );
  }

  // Expiry check
  const now = new Date();
  const expiryDate = new Date(driver.licenseExpiryDate);
  const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isLicenseExpired = diffDays < 0;
  const isLicenseExpiringSoon = diffDays >= 0 && diffDays <= 30;

  const sc = STATUS_CONFIG[driver.status] ?? STATUS_CONFIG['ACTIVE']!;
  const dsc = DUTY_STATUS_CONFIG[driver.dutyStatus] ?? DUTY_STATUS_CONFIG['OFF_DUTY']!;

  return (
    <RouteGuard requiredPermission="driver.read" requireCompany>
      <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Link
          href={`/companies/${companyId}/drivers`}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Drivers
        </Link>
        <span className="text-muted-foreground/30">/</span>
        <span className="font-mono font-medium text-foreground">{driver.driverCode}</span>
      </div>

      {/* Expiry Alert Warning */}
      {isLicenseExpired && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <div>
              <p className="text-xs font-semibold">Driving License Has Expired!</p>
              <p className="text-[11px] text-red-400/80">
                License expired on {expiryDate.toLocaleDateString()}. Driver cannot be scheduled for active duty.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isLicenseExpired && isLicenseExpiringSoon && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-400">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 flex-shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-semibold">License Expiring in {diffDays} Days</p>
              <p className="text-[11px] text-amber-400/80">
                License expires on {expiryDate.toLocaleDateString()}. Please ensure renewal before expiry.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/30 bg-card/40 p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserCheck className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{driver.driverCode}</h1>
              {driver.employee && (
                <span className="text-sm font-medium text-muted-foreground">
                  ({driver.employee.firstName} {driver.employee.lastName})
                </span>
              )}
              <span className={cn('text-xs px-2.5 py-0.5 rounded-full border font-medium', sc.badge)}>
                {sc.label}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-mono">
                <Shield className="h-3.5 w-3.5 text-primary" /> {driver.licenseNumber} ({driver.licenseType})
              </span>
              {driver.employee?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {driver.employee.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Duty Status & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Duty status badge with quick update */}
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/50 px-3 py-1.5">
            <span className={cn('h-2 w-2 rounded-full', dsc.dot)} />
            <span className="text-xs font-medium text-foreground">{dsc.label}</span>
            <button
              onClick={() => {
                setDutyStatusInput(driver.dutyStatus);
                setShowDutyModal(true);
              }}
              className="text-[11px] text-primary hover:underline ml-2"
            >
              Change
            </button>
          </div>

          {canManage && (
            <select
              value={driver.status}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          )}

          {canDelete && (
            <button
              onClick={handleDeleteDriver}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 text-muted-foreground hover:bg-red-400/10 hover:text-red-400 transition-colors"
              title="Delete Driver"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/30 text-xs">
        <button
          onClick={() => setTab('overview')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-4 py-2.5 font-medium transition-colors',
            tab === 'overview'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <User className="h-3.5 w-3.5" /> Overview & Profile
        </button>
        <button
          onClick={() => setTab('vehicle')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-4 py-2.5 font-medium transition-colors',
            tab === 'vehicle'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Car className="h-3.5 w-3.5" /> Assigned Vehicle
          {assignedVehicle && (
            <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] text-primary">
              1
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('documents')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-4 py-2.5 font-medium transition-colors',
            tab === 'documents'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <FileText className="h-3.5 w-3.5" /> Documents
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
            {documents.length}
          </span>
        </button>
        <button
          onClick={() => setTab('duty')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-4 py-2.5 font-medium transition-colors',
            tab === 'duty'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Clock className="h-3.5 w-3.5" /> Duty Shift History
        </button>
      </div>

      {/* Tab 1: Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* License Information */}
          <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Driving License Details
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">License Number</span>
                <span className="font-mono font-medium text-foreground">{driver.licenseNumber}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">License Category</span>
                <span className="font-medium text-foreground">{driver.licenseType}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">Issue Date</span>
                <span className="text-foreground">
                  {driver.licenseIssueDate
                    ? new Date(driver.licenseIssueDate).toLocaleDateString()
                    : 'Not provided'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">Expiry Date</span>
                <span className="font-medium text-foreground">
                  {expiryDate.toLocaleDateString()}{' '}
                  <span className="ml-1 text-[10px]">
                    ({isLicenseExpired ? 'Expired' : `${diffDays} days remaining`})
                  </span>
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Issuing Authority</span>
                <span className="text-foreground">{driver.licenseIssuingAuthority ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Linked Employee Information */}
          <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Linked Employee Profile
            </h2>
            {driver.employee ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/20">
                  <span className="text-muted-foreground">Full Name</span>
                  <span className="font-medium text-foreground">
                    {driver.employee.firstName} {driver.employee.lastName}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/20">
                  <span className="text-muted-foreground">Employee Code</span>
                  <span className="font-mono text-foreground">{driver.employee.employeeNumber}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/20">
                  <span className="text-muted-foreground">Phone Number</span>
                  <span className="text-foreground">{driver.employee.phone}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/20">
                  <span className="text-muted-foreground">Email Address</span>
                  <span className="text-foreground">{driver.employee.email ?? '—'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Employment Status</span>
                  <span className="text-foreground">{driver.employee.employmentStatus}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <p>No internal employee record linked to this driver.</p>
              </div>
            )}
          </div>

          {/* Badge & Experience */}
          <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" /> Badge & Background
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">Commercial Badge</span>
                <span className="text-foreground">{driver.badgeNumber ?? 'None'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">Badge Expiry</span>
                <span className="text-foreground">
                  {driver.badgeExpiryDate
                    ? new Date(driver.badgeExpiryDate).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">Years of Experience</span>
                <span className="font-medium text-foreground">{driver.experienceYears} Years</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Blood Group</span>
                <span className="font-semibold text-foreground">{driver.bloodGroup ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Emergency Contact & Notes */}
          <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> Emergency Contact & Notes
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">Emergency Contact</span>
                <span className="text-foreground">{driver.emergencyContactName ?? '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">Emergency Phone</span>
                <span className="text-foreground">{driver.emergencyContactPhone ?? '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/20">
                <span className="text-muted-foreground">Joining Date</span>
                <span className="text-foreground">
                  {new Date(driver.joiningDate).toLocaleDateString()}
                </span>
              </div>
              <div className="pt-2">
                <span className="text-muted-foreground block mb-1">Notes:</span>
                <p className="text-muted-foreground italic bg-background/50 p-2.5 rounded-lg">
                  {driver.notes || 'No special notes recorded.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Vehicle Assignment */}
      {tab === 'vehicle' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Assigned Vehicle</h2>
              <p className="text-xs text-muted-foreground">
                Current active vehicle assignment for this driver
              </p>
            </div>
            {canManage && (
              <button
                onClick={openAssignModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {assignedVehicle ? 'Reassign Vehicle' : 'Assign Vehicle'}
              </button>
            )}
          </div>

          {assignedVehicle?.vehicle ? (
            <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Car className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {assignedVehicle.vehicle.vehicleNumber}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {assignedVehicle.vehicle.make} {assignedVehicle.vehicle.model}
                      {assignedVehicle.vehicle.year && ` (${assignedVehicle.vehicle.year})`}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={handleUnassignVehicle}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    Unassign Vehicle
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium text-foreground">{assignedVehicle.vehicle.status ?? 'ACTIVE'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Assigned Date</span>
                  <p className="font-medium text-foreground">
                    {new Date(assignedVehicle.assignedAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Assignment Status</span>
                  <p className="font-medium text-emerald-400">Active</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Notes</span>
                  <p className="text-foreground">{assignedVehicle.notes ?? '—'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 p-8 text-center">
              <Car className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">No vehicle currently assigned</p>
              <p className="text-xs text-muted-foreground mb-4">
                Assign a company fleet vehicle to this driver for operational dispatch
              </p>
              {canManage && (
                <button
                  onClick={openAssignModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Assign Vehicle
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Documents */}
      {tab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Driver Documents</h2>
              <p className="text-xs text-muted-foreground">
                Driving license, badge, police verification, and certifications
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => setShowDocModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Document
              </button>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 p-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">No documents uploaded</p>
              <p className="text-xs text-muted-foreground mb-4">
                Upload verification, license copies, and medical proofs
              </p>
              {canManage && (
                <button
                  onClick={() => setShowDocModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Upload Document
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => {
                const docExp = doc.expiryDate ? new Date(doc.expiryDate) : null;
                const isDocExpired = docExp && docExp.getTime() < Date.now();
                const docLabel =
                  DOC_TYPES.find((t) => t.value === doc.documentType)?.label ?? doc.documentType;

                return (
                  <div
                    key={doc.id}
                    className="flex flex-col justify-between rounded-xl border border-border/30 bg-card/40 p-4 space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <h4 className="text-xs font-semibold text-foreground">{docLabel}</h4>
                        </div>
                        {canManage && (
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {doc.documentNumber && (
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          ID: {doc.documentNumber}
                        </p>
                      )}

                      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                        {doc.issueDate && (
                          <p>Issued: {new Date(doc.issueDate).toLocaleDateString()}</p>
                        )}
                        {doc.expiryDate && (
                          <div className="flex items-center gap-1">
                            <span>Expires: {docExp?.toLocaleDateString()}</span>
                            {isDocExpired ? (
                              <span className="text-[10px] text-red-400 font-semibold">(Expired)</span>
                            ) : null}
                          </div>
                        )}
                        {doc.notes && <p className="italic text-foreground/80 mt-1">{doc.notes}</p>}
                      </div>
                    </div>

                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline pt-2 border-t border-border/20"
                      >
                        <ExternalLink className="h-3 w-3" /> View attachment
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Duty History */}
      {tab === 'duty' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Duty Shift History</h2>
              <p className="text-xs text-muted-foreground">
                Chronological record of driver shifts and duty state transitions
              </p>
            </div>
            <button
              onClick={() => {
                setDutyStatusInput(driver.dutyStatus);
                setShowDutyModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Clock className="h-3.5 w-3.5" /> Log Shift / Duty Change
            </button>
          </div>

          {dutyLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/40 p-8 text-center text-xs text-muted-foreground">
              No duty shift logs recorded yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/30 bg-card/40">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/30 bg-muted/20 text-[11px] font-semibold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">Duty Status</th>
                    <th className="px-4 py-3">Started At</th>
                    <th className="px-4 py-3">Ended At</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {dutyLogs.map((log) => {
                    const logCfg =
                      DUTY_STATUS_CONFIG[log.status] ?? DUTY_STATUS_CONFIG['OFF_DUTY']!;
                    return (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
                              logCfg.badge,
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 rounded-full', logCfg.dot)} />
                            {logCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-foreground font-mono">
                          {new Date(log.startedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">
                          {log.endedAt ? new Date(log.endedAt).toLocaleString() : 'Active shift'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{log.notes ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Modal 1: Update Duty Status ─── */}
      {showDutyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Update Duty Status</h3>
            <p className="text-xs text-muted-foreground">
              Transition the current driver shift status and append to duty history
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  New Duty Status
                </label>
                <select
                  value={dutyStatusInput}
                  onChange={(e) => setDutyStatusInput(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="OFF_DUTY">Off Duty</option>
                  <option value="ON_DUTY">On Duty (Available for trips)</option>
                  <option value="ON_TRIP">On Trip</option>
                  <option value="ON_BREAK">On Break</option>
                  <option value="UNAVAILABLE">Unavailable / Sick</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Shift Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Starting morning regional shift"
                  value={dutyNotesInput}
                  onChange={(e) => setDutyNotesInput(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDutyModal(false)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDutyStatus}
                disabled={dutySubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {dutySubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Assign Vehicle ─── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleAssignVehicle}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-foreground">Assign Fleet Vehicle</h3>
            <p className="text-xs text-muted-foreground">
              Select an available company vehicle to assign to driver {driver.driverCode}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Select Vehicle *
                </label>
                <select
                  required
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} — {v.make} {v.model} ({v.year})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Assignment Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scheduled for East Coast distribution"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assignSubmitting || !selectedVehicleId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {assignSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Assign Vehicle
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Modal 3: Add Document ─── */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleAddDocument}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-foreground">Upload Driver Document</h3>
            <p className="text-xs text-muted-foreground">
              Add compliance documents, licenses, or verification records
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Document Type *
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Document Number / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. PV-2024-88392"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={docIssueDate}
                    onChange={(e) => setDocIssueDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={docExpiryDate}
                    onChange={(e) => setDocExpiryDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  File URL / Cloud Storage Reference
                </label>
                <input
                  type="url"
                  placeholder="https://storage.example.com/docs/file.pdf"
                  value={docFileUrl}
                  onChange={(e) => setDocFileUrl(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional remarks…"
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="rounded-lg border border-border px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={docSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {docSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Document
              </button>
            </div>
          </form>
        </div>
      )}
      </div>
    </RouteGuard>
  );
}
