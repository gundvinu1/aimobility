'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/lib/company/company-context';
import { Building2, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface FormData {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  timezone: string;
  currency: string;
}

const TIMEZONES = [
  'UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Australia/Sydney',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'BRL'];

function Field({
  label, id, required, children,
}: { label: string; id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

import { RouteGuard } from '@/components/auth/route-guard';

export default function NewCompanyPage() {
  return (
    <RouteGuard requiredPermission="company.create">
      <NewCompanyContent />
    </RouteGuard>
  );
}

function NewCompanyContent() {
  const { createCompany } = useCompany();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    name: '', legalName: '', email: '', phone: '', website: '',
    address: '', city: '', state: '', country: '', postalCode: '',
    timezone: 'UTC', currency: 'USD',
  });

  const update = (key: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      // Remove empty strings
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '') delete payload[k];
      });
      const company = await createCompany(payload);
      router.push(`/companies/${company.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link href="/companies" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to companies
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Create Company</h1>
            <p className="text-sm text-muted-foreground">You will become the owner</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form id="form-create-company" onSubmit={handleSubmit} className="space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Basic Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company Name" id="name" required>
              <input id="name" type="text" required value={form.name} onChange={update('name')}
                placeholder="ABC Travels" className={inputClass} />
            </Field>
            <Field label="Legal Name" id="legalName">
              <input id="legalName" type="text" value={form.legalName} onChange={update('legalName')}
                placeholder="ABC Travels Pvt Ltd" className={inputClass} />
            </Field>
            <Field label="Email" id="email">
              <input id="email" type="email" value={form.email} onChange={update('email')}
                placeholder="contact@company.com" className={inputClass} />
            </Field>
            <Field label="Phone" id="phone">
              <input id="phone" type="tel" value={form.phone} onChange={update('phone')}
                placeholder="+91 98765 43210" className={inputClass} />
            </Field>
            <Field label="Website" id="website">
              <input id="website" type="url" value={form.website} onChange={update('website')}
                placeholder="https://company.com" className={inputClass} />
            </Field>
          </div>
        </div>

        {/* Address */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Street Address" id="address">
                <input id="address" type="text" value={form.address} onChange={update('address')}
                  placeholder="123 Main Street" className={inputClass} />
              </Field>
            </div>
            <Field label="City" id="city">
              <input id="city" type="text" value={form.city} onChange={update('city')}
                placeholder="Mumbai" className={inputClass} />
            </Field>
            <Field label="State / Province" id="state">
              <input id="state" type="text" value={form.state} onChange={update('state')}
                placeholder="Maharashtra" className={inputClass} />
            </Field>
            <Field label="Country" id="country">
              <input id="country" type="text" value={form.country} onChange={update('country')}
                placeholder="India" className={inputClass} />
            </Field>
            <Field label="Postal Code" id="postalCode">
              <input id="postalCode" type="text" value={form.postalCode} onChange={update('postalCode')}
                placeholder="400001" className={inputClass} />
            </Field>
          </div>
        </div>

        {/* Locale */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Locale & Currency</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Timezone" id="timezone">
              <select id="timezone" value={form.timezone} onChange={update('timezone')} className={inputClass}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
            <Field label="Currency" id="currency">
              <select id="currency" value={form.currency} onChange={update('currency')} className={inputClass}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <Link href="/companies" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
            Cancel
          </Link>
          <button
            id="btn-submit-company"
            type="submit"
            disabled={isSubmitting || !form.name.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            {isSubmitting ? 'Creating...' : 'Create Company'}
          </button>
        </div>
      </form>
    </div>
  );
}
