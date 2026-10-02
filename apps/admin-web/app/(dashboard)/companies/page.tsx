'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCompany } from '@/lib/company/company-context';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Building2, Plus, Users, AlertCircle, Loader2 } from 'lucide-react';
import type { CompanySummaryDto } from '@ai-mos/types';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  ACTIVE:    { label: 'Active',    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  SUSPENDED: { label: 'Suspended', color: 'text-amber-400  bg-amber-400/10  border-amber-400/20'  },
  INACTIVE:  { label: 'Inactive',  color: 'text-slate-400  bg-slate-400/10  border-slate-400/20'  },
};

function CompanyCard({ company, onSelect }: { company: CompanySummaryDto; onSelect: () => void }) {
  const status = STATUS_CONFIG[company.status] ?? STATUS_CONFIG.INACTIVE;
  return (
    <div
      className="group relative rounded-xl border border-border/50 bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {company.name}
            </h3>
            <p className="text-xs text-muted-foreground">/{company.slug}</p>
          </div>
        </div>
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', status.color)}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          {company.memberCount ?? '—'} members
        </span>
        <span className="ml-auto capitalize opacity-60">Your role: {company.role.toLowerCase()}</span>
      </div>

      <Link
        href={`/companies/${company.id}`}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 rounded-xl"
        aria-label={`Open ${company.name}`}
      />
    </div>
  );
}

export default function CompaniesPage() {
  const { companies, isLoading, error, refreshCompanies, setActiveCompany } = useCompany();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setRefreshing(true);
    refreshCompanies().finally(() => setRefreshing(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = isLoading || refreshing;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Companies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organisations and switch between them
          </p>
        </div>
        <PermissionGate permission="company.create">
          <Link
            id="btn-new-company"
            href="/companies/new"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Company
          </Link>
        </PermissionGate>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!loading && companies.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">No companies yet</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">
            Create your first company to start managing your mobility operations.
          </p>
          <Link
            id="btn-create-first-company"
            href="/companies/new"
            className="mt-6 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create your company
          </Link>
        </div>
      )}

      {/* Company grid */}
      {!loading && companies.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onSelect={() => setActiveCompany(company)}
            />
          ))}
        </div>
      )}

      {!loading && companies.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {companies.length} {companies.length === 1 ? 'company' : 'companies'} — click to open
        </p>
      )}
    </div>
  );
}
