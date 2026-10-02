'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { employeeApi } from '@/lib/employee/employee-api';
import type { EmployeeDto } from '@ai-mos/types';
import {
  ArrowLeft, Loader2, Save, Edit3, AlertTriangle, AlertCircle,
  User, Phone, MapPin, Briefcase, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';

// ─── Config ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  ACTIVE:     { label: 'Active',     badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  INACTIVE:   { label: 'Inactive',   badge: 'text-slate-400   bg-slate-400/10   border-slate-400/30'   },
  ON_LEAVE:   { label: 'On Leave',   badge: 'text-amber-400   bg-amber-400/10   border-amber-400/30'   },
  SUSPENDED:  { label: 'Suspended',  badge: 'text-orange-400  bg-orange-400/10  border-orange-400/30'  },
  TERMINATED: { label: 'Terminated', badge: 'text-red-400     bg-red-400/10     border-red-400/30'     },
};

const DEPT_LABEL: Record<string, string> = {
  OPERATIONS: 'Operations', DISPATCH: 'Dispatch', ACCOUNTS: 'Accounts',
  HR: 'HR', SALES: 'Sales', CUSTOMER_SUPPORT: 'Customer Support',
  ADMINISTRATION: 'Administration', MANAGEMENT: 'Management', OTHER: 'Other',
};

const TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Full-Time', PART_TIME: 'Part-Time',
  CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern',
};

const DEPARTMENTS = Object.keys(DEPT_LABEL);
const EMPLOYMENT_TYPES = Object.keys(TYPE_LABEL);
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
const STATUSES = Object.keys(STATUS_CONFIG);

const inputCls = 'rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full disabled:opacity-50';

// ─── Info row (read mode) ─────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value ?? <span className="text-muted-foreground/50">—</span>}</p>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-card/50 p-5 backdrop-blur">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />{title}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmployeeDetailPage() {
  const { companyId, id } = useParams<{ companyId: string; id: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const [employee, setEmployee] = useState<EmployeeDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { hasPermission } = usePermissions();
  const canManage = hasPermission('employee.update');
  const canDelete  = hasPermission('employee.delete');

  useEffect(() => {
    if (!accessToken || !companyId || !id) return;
    setIsLoading(true);
    employeeApi.get(accessToken, companyId, id)
      .then(e => { setEmployee(e); setForm(toForm(e)); })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load employee'))
      .finally(() => setIsLoading(false));
  }, [accessToken, companyId, id]);

  function toForm(e: EmployeeDto): Record<string, string> {
    return {
      firstName:  e.firstName,
      middleName: e.middleName ?? '',
      lastName:   e.lastName,
      displayName: e.displayName ?? '',
      gender:     e.gender ?? '',
      dateOfBirth: e.dateOfBirth ?? '',
      email:          e.email ?? '',
      phone:          e.phone,
      alternatePhone: e.alternatePhone ?? '',
      address:   e.address ?? '',
      city:      e.city ?? '',
      state:     e.state ?? '',
      country:   e.country ?? '',
      postalCode: e.postalCode ?? '',
      department:      e.department ?? '',
      designation:     e.designation ?? '',
      joiningDate:     e.joiningDate,
      employmentType:  e.employmentType,
      employmentStatus: e.employmentStatus,
      emergencyContactName:     e.emergencyContactName ?? '',
      emergencyContactPhone:    e.emergencyContactPhone ?? '',
      emergencyContactRelation: e.emergencyContactRelation ?? '',
      notes: e.notes ?? '',
    };
  }

  function fieldChange(name: string, value: string) {
    setForm(f => ({ ...f, [name]: value }));
  }

  async function save() {
    if (!accessToken || !companyId || !id) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const payload: Record<string, unknown> = {};
      Object.entries(form).forEach(([k, v]) => {
        if (k !== 'employmentStatus') payload[k] = v || null;
      });
      const updated = await employeeApi.update(accessToken, companyId, id, payload);
      setEmployee(updated);
      setForm(toForm(updated));
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }

  async function changeStatus(s: string) {
    if (!accessToken || !companyId || !id) return;
    const updated = await employeeApi.updateStatus(accessToken, companyId, id, s);
    setEmployee(updated);
    setForm(f => ({ ...f, employmentStatus: s }));
  }

  async function handleDelete() {
    if (!confirm('Delete this employee permanently?')) return;
    if (!accessToken || !companyId || !id) return;
    await employeeApi.remove(accessToken, companyId, id);
    router.push(`/companies/${companyId}/employees`);
  }

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  if (error || !employee) return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-destructive">
      <AlertCircle className="h-8 w-8" />
      <p className="text-sm">{error ?? 'Employee not found'}</p>
      <Link href={`/companies/${companyId}/employees`} className="text-xs text-primary hover:underline">← Back to list</Link>
    </div>
  );

  const sc = STATUS_CONFIG[employee.employmentStatus] ?? STATUS_CONFIG['ACTIVE'];
  const fullName = employee.displayName ?? `${employee.firstName} ${employee.middleName ?? ''} ${employee.lastName}`.trim();

  const Field = ({ label, name, type = 'text', opts }: {
    label: string; name: string; type?: string; opts?: { value: string; label: string }[];
  }) => (
    <div className={editing ? undefined : undefined}>
      {editing ? (
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</label>
          {opts ? (
            <select
              value={form[name] ?? ''}
              onChange={e => fieldChange(name, e.target.value)}
              className={inputCls}
            >
              <option value="">— Select —</option>
              {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              type={type}
              value={form[name] ?? ''}
              onChange={e => fieldChange(name, e.target.value)}
              className={inputCls}
            />
          )}
        </div>
      ) : (
        <InfoRow label={label} value={form[name] || null} />
      )}
    </div>
  );

  return (
    <RouteGuard requiredPermission="employee.read" requireCompany>
      <div className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/companies/${companyId}/employees`}
          className="rounded-lg border border-border/40 p-2 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{fullName}</h1>
            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium', sc.badge)}>
              {sc.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{employee.employeeNumber}</p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saved
            </span>
          )}
          {canManage && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm hover:bg-white/5 transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={() => { setEditing(false); setForm(toForm(employee)); setSaveError(null); }}
                className="rounded-lg border border-border/40 px-3 py-2 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void save()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />{saveError}
        </div>
      )}

      {/* Status change (only in view mode, by managers) */}
      {!editing && canManage && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border/30 bg-card/50 p-4 backdrop-blur">
          <span className="text-xs text-muted-foreground mr-2">Status:</span>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => void changeStatus(s)}
              disabled={employee.employmentStatus === s}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                employee.employmentStatus === s
                  ? (STATUS_CONFIG[s]?.badge ?? '')
                  : 'border-border/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {STATUS_CONFIG[s]?.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Personal */}
        <Section icon={User} title="Personal Information">
          <Field label="First Name" name="firstName" />
          <Field label="Middle Name" name="middleName" />
          <Field label="Last Name" name="lastName" />
          <Field label="Display Name" name="displayName" />
          <Field label="Gender" name="gender" opts={GENDERS.map(g => ({ value: g, label: g.replace(/_/g, ' ') }))} />
          <Field label="Date of Birth" name="dateOfBirth" type="date" />
        </Section>

        {/* Contact */}
        <Section icon={Phone} title="Contact Details">
          <Field label="Primary Phone" name="phone" />
          <Field label="Alternate Phone" name="alternatePhone" />
          <Field label="Email" name="email" type="email" />
        </Section>

        {/* Address */}
        <Section icon={MapPin} title="Address">
          <InfoRow label="Street" value={form['address']} />
          <InfoRow label="City"   value={form['city']}    />
          <InfoRow label="State"  value={form['state']}   />
          <InfoRow label="Country" value={form['country']} />
          <InfoRow label="Postal Code" value={form['postalCode']} />
          {editing && (
            <>
              <Field label="Street Address" name="address" />
              <Field label="City" name="city" />
              <Field label="State" name="state" />
              <Field label="Country" name="country" />
              <Field label="Postal Code" name="postalCode" />
            </>
          )}
        </Section>

        {/* Employment */}
        <Section icon={Briefcase} title="Employment">
          <Field label="Joining Date" name="joiningDate" type="date" />
          <Field label="Employment Type" name="employmentType" opts={EMPLOYMENT_TYPES.map(t => ({ value: t, label: TYPE_LABEL[t] ?? t }))} />
          <Field label="Department" name="department" opts={DEPARTMENTS.map(d => ({ value: d, label: DEPT_LABEL[d] ?? d }))} />
          <Field label="Designation" name="designation" />
          <InfoRow label="Employee Number" value={employee.employeeNumber} />
        </Section>

        {/* Emergency */}
        <Section icon={Phone} title="Emergency Contact">
          <Field label="Name" name="emergencyContactName" />
          <Field label="Phone" name="emergencyContactPhone" />
          <Field label="Relation" name="emergencyContactRelation" />
        </Section>

        {/* Notes */}
        {(form['notes'] || editing) && (
          <div className="rounded-xl border border-border/30 bg-card/50 p-5 backdrop-blur">
            <h2 className="mb-3 text-sm font-semibold">Notes</h2>
            {editing ? (
              <textarea
                value={form['notes'] ?? ''}
                onChange={e => fieldChange('notes', e.target.value)}
                rows={4}
                className={cn(inputCls, 'resize-y')}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{form['notes']}</p>
            )}
          </div>
        )}

        {/* Danger zone */}
        {canDelete && !editing && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
            <h2 className="mb-2 text-sm font-semibold text-destructive">Danger Zone</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Deleting an employee is permanent and cannot be undone.
            </p>
            <button
              onClick={() => void handleDelete()}
              className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              Delete Employee
            </button>
          </div>
        )}
      </div>
    </div>
    </RouteGuard>
  );
}
