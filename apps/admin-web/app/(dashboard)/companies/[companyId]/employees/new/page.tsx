'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { employeeApi } from '@/lib/employee/employee-api';
import { ArrowLeft, Loader2, Save, User, Phone, MapPin, Briefcase, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';

const DEPARTMENTS = [
  { value: 'OPERATIONS',     label: 'Operations'        },
  { value: 'DISPATCH',       label: 'Dispatch'           },
  { value: 'ACCOUNTS',       label: 'Accounts'           },
  { value: 'HR',             label: 'HR'                 },
  { value: 'SALES',          label: 'Sales'              },
  { value: 'CUSTOMER_SUPPORT', label: 'Customer Support' },
  { value: 'ADMINISTRATION', label: 'Administration'     },
  { value: 'MANAGEMENT',     label: 'Management'         },
  { value: 'OTHER',          label: 'Other'              },
];

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME',  label: 'Full-Time'  },
  { value: 'PART_TIME',  label: 'Part-Time'  },
  { value: 'CONTRACT',   label: 'Contract'   },
  { value: 'TEMPORARY',  label: 'Temporary'  },
  { value: 'INTERN',     label: 'Intern'     },
];

const GENDERS = [
  { value: 'MALE',              label: 'Male'              },
  { value: 'FEMALE',            label: 'Female'            },
  { value: 'OTHER',             label: 'Other'             },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

// ─── Simple field components ─────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-full';

function Input({ name, value, onChange, placeholder, type = 'text', required }: {
  name: string; value: string; onChange: (_n: string, _v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      required={required}
      placeholder={placeholder}
      onChange={e => onChange(name, e.target.value)}
      className={inputCls}
    />
  );
}

function Select({ name, value, onChange, options }: {
  name: string; value: string; onChange: (_n: string, _v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={name}
      name={name}
      value={value}
      onChange={e => onChange(name, e.target.value)}
      className={inputCls}
    >
      <option value="">— Select —</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-card/50 p-5 backdrop-blur">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

// ─── Initial state ────────────────────────────────────────────────────────────
const INITIAL_FORM = {
  firstName: '', middleName: '', lastName: '', displayName: '',
  gender: '', dateOfBirth: '',
  email: '', phone: '', alternatePhone: '',
  address: '', city: '', state: '', country: '', postalCode: '',
  department: '', designation: '', joiningDate: '', employmentType: 'FULL_TIME',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
  notes: '',
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NewEmployeePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { accessToken } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<typeof INITIAL_FORM>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onChange(name: string, value: string) {
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !companyId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Build payload — omit empty optionals
      const payload: Record<string, unknown> = {};
      const req: (keyof typeof INITIAL_FORM)[] = ['firstName', 'lastName', 'phone', 'joiningDate'];
      req.forEach(k => { payload[k] = form[k]; });

      const optional: (keyof typeof INITIAL_FORM)[] = [
        'middleName', 'displayName', 'gender', 'dateOfBirth',
        'email', 'alternatePhone',
        'address', 'city', 'state', 'country', 'postalCode',
        'department', 'designation', 'employmentType',
        'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
        'notes',
      ];
      optional.forEach(k => { if (form[k]) payload[k] = form[k]; });

      const emp = await employeeApi.create(accessToken, companyId, payload);
      router.push(`/companies/${companyId}/employees/${emp.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <RouteGuard requiredPermission="employee.create" requireCompany>
      <form onSubmit={e => void handleSubmit(e)} className="mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/companies/${companyId}/employees`}
          className="rounded-lg border border-border/40 p-2 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Add Employee</h1>
          <p className="text-sm text-muted-foreground">Fill in the employee details below</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Personal */}
        <Section icon={User} title="Personal Information">
          <Field label="First Name" required><Input name="firstName" value={form.firstName} onChange={onChange} placeholder="Ravi" required /></Field>
          <Field label="Middle Name"><Input name="middleName" value={form.middleName} onChange={onChange} placeholder="Kumar" /></Field>
          <Field label="Last Name" required><Input name="lastName" value={form.lastName} onChange={onChange} placeholder="Sharma" required /></Field>
          <Field label="Display Name"><Input name="displayName" value={form.displayName} onChange={onChange} placeholder="Ravi Sharma" /></Field>
          <Field label="Gender"><Select name="gender" value={form.gender} onChange={onChange} options={GENDERS} /></Field>
          <Field label="Date of Birth"><Input name="dateOfBirth" value={form.dateOfBirth} onChange={onChange} type="date" /></Field>
        </Section>

        {/* Contact */}
        <Section icon={Phone} title="Contact Details">
          <Field label="Primary Phone" required><Input name="phone" value={form.phone} onChange={onChange} placeholder="+919876543210" required /></Field>
          <Field label="Alternate Phone"><Input name="alternatePhone" value={form.alternatePhone} onChange={onChange} placeholder="+917890123456" /></Field>
          <div className="sm:col-span-2">
            <Field label="Email"><Input name="email" value={form.email} onChange={onChange} type="email" placeholder="ravi@company.com" /></Field>
          </div>
        </Section>

        {/* Address */}
        <Section icon={MapPin} title="Address">
          <div className="sm:col-span-2">
            <Field label="Street Address"><Input name="address" value={form.address} onChange={onChange} placeholder="123 Main Street" /></Field>
          </div>
          <Field label="City"><Input name="city" value={form.city} onChange={onChange} placeholder="Mumbai" /></Field>
          <Field label="State"><Input name="state" value={form.state} onChange={onChange} placeholder="Maharashtra" /></Field>
          <Field label="Country"><Input name="country" value={form.country} onChange={onChange} placeholder="India" /></Field>
          <Field label="Postal Code"><Input name="postalCode" value={form.postalCode} onChange={onChange} placeholder="400001" /></Field>
        </Section>

        {/* Employment */}
        <Section icon={Briefcase} title="Employment Details">
          <Field label="Joining Date" required><Input name="joiningDate" value={form.joiningDate} onChange={onChange} type="date" required /></Field>
          <Field label="Employment Type"><Select name="employmentType" value={form.employmentType} onChange={onChange} options={EMPLOYMENT_TYPES} /></Field>
          <Field label="Department"><Select name="department" value={form.department} onChange={onChange} options={DEPARTMENTS} /></Field>
          <Field label="Designation"><Input name="designation" value={form.designation} onChange={onChange} placeholder="Driver / Dispatcher" /></Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                id="notes"
                name="notes"
                value={form.notes}
                onChange={e => onChange('notes', e.target.value)}
                placeholder="Additional notes…"
                rows={3}
                className={cn(inputCls, 'resize-y')}
              />
            </Field>
          </div>
        </Section>

        {/* Emergency contact */}
        <Section icon={Phone} title="Emergency Contact">
          <Field label="Contact Name"><Input name="emergencyContactName" value={form.emergencyContactName} onChange={onChange} placeholder="Sita Sharma" /></Field>
          <Field label="Contact Phone"><Input name="emergencyContactPhone" value={form.emergencyContactPhone} onChange={onChange} placeholder="+919000000000" /></Field>
          <Field label="Relation"><Input name="emergencyContactRelation" value={form.emergencyContactRelation} onChange={onChange} placeholder="Spouse / Parent" /></Field>
        </Section>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end gap-3">
        <Link
          href={`/companies/${companyId}/employees`}
          className="rounded-lg border border-border/40 px-4 py-2 text-sm hover:bg-white/5 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSubmitting ? 'Saving…' : 'Save Employee'}
        </button>
      </div>
      </form>
    </RouteGuard>
  );
}
