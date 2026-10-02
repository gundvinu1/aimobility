'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { driverApi } from '@/lib/driver/driver-api';
import { employeeApi } from '@/lib/employee/employee-api';
import type { EmployeeSummaryDto } from '@ai-mos/types';
import { UserCheck, ChevronLeft, Loader2, AlertCircle, CheckCircle2, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';

function FieldGroup({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const INPUT =
  'w-full rounded-lg border border-border bg-card/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const SELECT = cn(INPUT, 'cursor-pointer');

export default function NewDriverPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const [employees, setEmployees] = useState<EmployeeSummaryDto[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    employeeId: '',
    driverCode: '',
    licenseNumber: '',
    licenseType: 'COMMERCIAL',
    licenseIssueDate: '',
    licenseExpiryDate: '',
    licenseIssuingAuthority: '',
    badgeNumber: '',
    badgeExpiryDate: '',
    experienceYears: '2',
    bloodGroup: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    status: 'ACTIVE',
    dutyStatus: 'OFF_DUTY',
    joiningDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!accessToken || !companyId) return;
    setLoadingEmployees(true);
    employeeApi
      .list(accessToken, companyId, { limit: 100 })
      .then((res) => {
        setEmployees(res.employees ?? []);
      })
      .catch(() => {
        // non-blocking
      })
      .finally(() => setLoadingEmployees(false));
  }, [accessToken, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        driverCode: form.driverCode.trim().toUpperCase(),
        licenseNumber: form.licenseNumber.trim().toUpperCase(),
        licenseType: form.licenseType,
        licenseExpiryDate: form.licenseExpiryDate,
        experienceYears: parseInt(form.experienceYears || '0', 10),
        status: form.status,
        dutyStatus: form.dutyStatus,
      };

      if (form.employeeId) payload['employeeId'] = form.employeeId;
      if (form.licenseIssueDate) payload['licenseIssueDate'] = form.licenseIssueDate;
      if (form.licenseIssuingAuthority.trim())
        payload['licenseIssuingAuthority'] = form.licenseIssuingAuthority.trim();
      if (form.badgeNumber.trim()) payload['badgeNumber'] = form.badgeNumber.trim();
      if (form.badgeExpiryDate) payload['badgeExpiryDate'] = form.badgeExpiryDate;
      if (form.bloodGroup.trim()) payload['bloodGroup'] = form.bloodGroup.trim();
      if (form.emergencyContactName.trim())
        payload['emergencyContactName'] = form.emergencyContactName.trim();
      if (form.emergencyContactPhone.trim())
        payload['emergencyContactPhone'] = form.emergencyContactPhone.trim();
      if (form.joiningDate) payload['joiningDate'] = form.joiningDate;
      if (form.notes.trim()) payload['notes'] = form.notes.trim();

      const created = await driverApi.create(accessToken, companyId, payload);
      setSuccess(true);
      setTimeout(() => router.push(`/companies/${companyId}/drivers/${created.id}`), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create driver');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RouteGuard requiredPermission="driver.create" requireCompany>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/companies/${companyId}/drivers`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Drivers
        </Link>
        <span className="text-muted-foreground/30">/</span>
        <span className="text-xs font-medium text-foreground">New Driver</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <UserCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Register New Driver</h1>
          <p className="text-xs text-muted-foreground">
            Add a driver profile and configure license, badges, and company details
          </p>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>Driver registered successfully! Redirecting…</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Identity & Employee Link */}
        <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Driver Identity & Employee Link
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="Select Company Employee" hint="Link this driver profile to an existing employee">
              <select
                value={form.employeeId}
                onChange={(e) => {
                  const empId = e.target.value;
                  set('employeeId', empId);
                  const selEmp = employees.find((x) => x.id === empId);
                  if (selEmp) {
                    if (!form.driverCode) {
                      set('driverCode', `DRV-${selEmp.employeeNumber.replace(/\D/g, '').slice(-3) || '001'}`);
                    }
                    if (!form.emergencyContactPhone && selEmp.phone) {
                      set('emergencyContactPhone', selEmp.phone);
                    }
                  }
                }}
                disabled={loadingEmployees}
                className={SELECT}
              >
                <option value="">-- No linked employee / External driver --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeNumber}) — {e.phone}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Driver Code" required hint="e.g. DRV-001 (unique within company)">
              <input
                type="text"
                required
                placeholder="DRV-001"
                value={form.driverCode}
                onChange={(e) => set('driverCode', e.target.value.toUpperCase())}
                className={INPUT}
              />
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FieldGroup label="Initial Operational Status">
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className={SELECT}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </FieldGroup>

            <FieldGroup label="Initial Duty Status">
              <select
                value={form.dutyStatus}
                onChange={(e) => set('dutyStatus', e.target.value)}
                className={SELECT}
              >
                <option value="OFF_DUTY">Off Duty</option>
                <option value="ON_DUTY">On Duty</option>
                <option value="ON_BREAK">On Break</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </FieldGroup>

            <FieldGroup label="Joining Date">
              <input
                type="date"
                value={form.joiningDate}
                onChange={(e) => set('joiningDate', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
          </div>
        </div>

        {/* Section 2: Commercial Driving License */}
        <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" /> Driving License Details
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="License Number" required hint="e.g. DL-1420110012345">
              <input
                type="text"
                required
                placeholder="DL-XXXXXXXXXXXX"
                value={form.licenseNumber}
                onChange={(e) => set('licenseNumber', e.target.value.toUpperCase())}
                className={INPUT}
              />
            </FieldGroup>

            <FieldGroup label="License Type" required>
              <select
                value={form.licenseType}
                onChange={(e) => set('licenseType', e.target.value)}
                className={SELECT}
              >
                <option value="COMMERCIAL">Commercial</option>
                <option value="LMV">LMV (Light Motor Vehicle)</option>
                <option value="HMV">HMV (Heavy Motor Vehicle)</option>
                <option value="TRANSPORT">Transport</option>
                <option value="OTHER">Other</option>
              </select>
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FieldGroup label="Issue Date">
              <input
                type="date"
                value={form.licenseIssueDate}
                onChange={(e) => set('licenseIssueDate', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>

            <FieldGroup label="Expiry Date" required hint="Required for compliance monitoring">
              <input
                type="date"
                required
                value={form.licenseExpiryDate}
                onChange={(e) => set('licenseExpiryDate', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>

            <FieldGroup label="Issuing Authority" hint="e.g. RTO Delhi / DMV">
              <input
                type="text"
                placeholder="Transport Authority"
                value={form.licenseIssuingAuthority}
                onChange={(e) => set('licenseIssuingAuthority', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
          </div>
        </div>

        {/* Section 3: Badge & Additional Details */}
        <div className="rounded-xl border border-border/30 bg-card/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Badge, Experience & Emergency Contact
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="Badge Number (if applicable)">
              <input
                type="text"
                placeholder="BDG-12345"
                value={form.badgeNumber}
                onChange={(e) => set('badgeNumber', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>

            <FieldGroup label="Badge Expiry Date">
              <input
                type="date"
                value={form.badgeExpiryDate}
                onChange={(e) => set('badgeExpiryDate', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="Experience (Years)">
              <input
                type="number"
                min="0"
                max="50"
                value={form.experienceYears}
                onChange={(e) => set('experienceYears', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>

            <FieldGroup label="Blood Group">
              <select
                value={form.bloodGroup}
                onChange={(e) => set('bloodGroup', e.target.value)}
                className={SELECT}
              >
                <option value="">Select blood group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </FieldGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="Emergency Contact Name">
              <input
                type="text"
                placeholder="Full Name"
                value={form.emergencyContactName}
                onChange={(e) => set('emergencyContactName', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>

            <FieldGroup label="Emergency Contact Phone">
              <input
                type="tel"
                placeholder="+1 234 567 8900"
                value={form.emergencyContactPhone}
                onChange={(e) => set('emergencyContactPhone', e.target.value)}
                className={INPUT}
              />
            </FieldGroup>
          </div>

          <FieldGroup label="Notes / Remarks">
            <textarea
              rows={3}
              placeholder="Special permits, certifications, driving notes…"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={INPUT}
            />
          </FieldGroup>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/companies/${companyId}/drivers`}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Registering…' : 'Register Driver'}
          </button>
        </div>
      </form>
      </div>
    </RouteGuard>
  );
}
