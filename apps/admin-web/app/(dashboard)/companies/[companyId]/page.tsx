'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCompany } from '@/lib/company/company-context';
import { PermissionGate } from '@/components/auth/permission-gate';
import { RouteGuard } from '@/components/auth/route-guard';
import {
  Building2, Users, Settings, Calendar, Globe, Mail, Phone,
  AlertCircle, Loader2, Shield, Hash, Car, UserCheck,
} from 'lucide-react';
import type { CompanyDto } from '@ai-mos/types';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  ACTIVE:    { label: 'Active',    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  SUSPENDED: { label: 'Suspended', color: 'text-amber-400  bg-amber-400/10  border-amber-400/20'  },
  INACTIVE:  { label: 'Inactive',  color: 'text-slate-400  bg-slate-400/10  border-slate-400/20'  },
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground truncate">{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export default function CompanyDetailPage() {
  return (
    <RouteGuard requiredPermission="company.read">
      <CompanyDetailContent />
    </RouteGuard>
  );
}

function CompanyDetailContent() {
  const { companyId } = useParams<{ companyId: string }>();
  const { getCompany, getMembers, activeCompany, companies, setActiveCompany } = useCompany();
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMembership = companies.find((c) => c.id === companyId);
  const status = company ? (STATUS_CONFIG[company.status] ?? STATUS_CONFIG.INACTIVE) : null;

  useEffect(() => {
    if (!companyId) return;
    // Set active company from list if not already set
    const found = companies.find((c) => c.id === companyId);
    if (found && (!activeCompany || activeCompany.id !== companyId)) {
      setActiveCompany(found);
    }

    setLoading(true);
    Promise.all([
      getCompany(companyId),
      getMembers(companyId),
    ])
      .then(([c, members]) => {
        setCompany(c);
        setMemberCount(members.length);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load company'))
      .finally(() => setLoading(false));
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
              {status && (
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', status.color)}>
                  {status.label}
                </span>
              )}
            </div>
            {company.legalName && (
              <p className="text-sm text-muted-foreground">{company.legalName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate permission="vehicle.read">
            <Link
              href={`/companies/${companyId}/vehicles`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              <Car className="h-3.5 w-3.5" />
              Vehicles
            </Link>
          </PermissionGate>
          <PermissionGate permission="driver.read">
            <Link
              href={`/companies/${companyId}/drivers`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Drivers
            </Link>
          </PermissionGate>
          <PermissionGate permission="company.members.read">
            <Link
              href={`/companies/${companyId}/members`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              Members
            </Link>
          </PermissionGate>
          <PermissionGate permission="company.settings.read">
            <Link
              href={`/companies/${companyId}/settings`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Members" value={memberCount} icon={Users} />
        <StatCard label="Your Role" value={currentMembership?.role ?? '—'} icon={Shield} />
        <StatCard label="Timezone" value={company.timezone} icon={Globe} />
        <StatCard label="Currency" value={company.currency} icon={Hash} />
      </div>

      {/* Details */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Contact info */}
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Contact</h2>
          <InfoRow icon={Mail}  label="Email"   value={company.email} />
          <InfoRow icon={Phone} label="Phone"   value={company.phone} />
          <InfoRow icon={Globe} label="Website" value={company.website} />
          {!company.email && !company.phone && !company.website && (
            <p className="text-xs text-muted-foreground/50 py-2">No contact info provided</p>
          )}
        </div>

        {/* Address */}
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Location</h2>
          {company.address || company.city ? (
            <div className="space-y-1 text-sm text-foreground">
              {company.address && <p>{company.address}</p>}
              <p>
                {[company.city, company.state, company.postalCode].filter(Boolean).join(', ')}
              </p>
              {company.country && <p className="text-muted-foreground">{company.country}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 py-2">No address provided</p>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">System Info</h2>
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          <InfoRow icon={Hash}     label="Company ID" value={company.id} />
          <InfoRow icon={Hash}     label="Slug"       value={`/${company.slug}`} />
          <InfoRow icon={Calendar} label="Created"    value={new Date(company.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
          <InfoRow icon={Calendar} label="Updated"    value={new Date(company.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
        </div>
      </div>
    </div>
  );
}
