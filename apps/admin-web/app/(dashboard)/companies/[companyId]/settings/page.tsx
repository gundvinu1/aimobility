'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCompany } from '@/lib/company/company-context';
import { PermissionGate } from '@/components/auth/permission-gate';
import { RouteGuard } from '@/components/auth/route-guard';
import { usePermissions } from '@/lib/auth/use-permissions';
import { ArrowLeft, Settings, Loader2, AlertCircle, Save } from 'lucide-react';
import type { CompanySettingsDto } from '@ai-mos/types';

const TIMEZONES = [
  'UTC','Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo',
  'Europe/London','Europe/Paris','America/New_York','America/Chicago',
  'America/Los_Angeles','America/Sao_Paulo','Australia/Sydney',
];
const CURRENCIES = ['USD','EUR','GBP','INR','AED','SGD','JPY','AUD','CAD','BRL'];
const DATE_FORMATS = ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD'];
const TIME_FORMATS = ['HH:mm','hh:mm A'];
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }, { value: 'ar', label: 'Arabic' }];

const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors';

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function CompanySettingsPage() {
  return (
    <RouteGuard requiredPermission="company.settings.read">
      <CompanySettingsContent />
    </RouteGuard>
  );
}

function CompanySettingsContent() {
  const { companyId } = useParams<{ companyId: string }>();
  const { getSettings, updateSettings } = useCompany();
  const { hasPermission } = usePermissions();
  const [settings, setSettings] = useState<CompanySettingsDto | null>(null);
  const [form, setForm] = useState({ timezone: 'UTC', currency: 'USD', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm', language: 'en' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canEdit = hasPermission('company.settings.write');

  useEffect(() => {
    if (!companyId) return;
    getSettings(companyId)
      .then((s) => {
        setSettings(s);
        setForm({ timezone: s.timezone, currency: s.currency, dateFormat: s.dateFormat, timeFormat: s.timeFormat, language: s.language });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key: string) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateSettings(companyId, form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/companies/${companyId}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to company
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Company Settings</h1>
            <p className="text-sm text-muted-foreground">Locale, timezone and display preferences</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-400">
          Settings saved successfully!
        </div>
      )}

      <form id="form-company-settings" onSubmit={handleSave} className="space-y-5">
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Locale</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Timezone" id="s-timezone">
              <select id="s-timezone" value={form.timezone} onChange={update('timezone')} disabled={!canEdit} className={inputClass}>
                {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Currency" id="s-currency">
              <select id="s-currency" value={form.currency} onChange={update('currency')} disabled={!canEdit} className={inputClass}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Date Format" id="s-dateFormat">
              <select id="s-dateFormat" value={form.dateFormat} onChange={update('dateFormat')} disabled={!canEdit} className={inputClass}>
                {DATE_FORMATS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Time Format" id="s-timeFormat">
              <select id="s-timeFormat" value={form.timeFormat} onChange={update('timeFormat')} disabled={!canEdit} className={inputClass}>
                {TIME_FORMATS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Language" id="s-language">
              <select id="s-language" value={form.language} onChange={update('language')} disabled={!canEdit} className={inputClass}>
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {settings && (
          <p className="text-[10px] text-muted-foreground/40 text-right">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}

        <PermissionGate
          permission="company.settings.write"
          fallback={
            <p className="text-xs text-muted-foreground/50 text-center">
              You do not have permission to modify company settings.
            </p>
          }
        >
          <div className="flex justify-end">
            <button
              id="btn-save-settings"
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </PermissionGate>
      </form>
    </div>
  );
}
