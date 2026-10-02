'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Plus, Check, Loader2 } from 'lucide-react';
import { useCompany } from '@/lib/company/company-context';
import { cn } from '@/lib/utils';
import type { CompanySummaryDto } from '@ai-mos/types';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-emerald-500',
  SUSPENDED: 'bg-amber-500',
  INACTIVE:  'bg-slate-500',
};

export function CompanySelector() {
  const { companies, activeCompany, setActiveCompany, isLoading } = useCompany();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSelect = (company: CompanySummaryDto) => {
    setActiveCompany(company);
    setOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sidebar-foreground/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <button
        id="btn-create-company"
        onClick={() => router.push('/companies/new')}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/50 hover:border-primary/40 hover:text-sidebar-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Create a company</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        id="btn-company-selector"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-sidebar-accent transition-colors group"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {/* Company icon */}
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/20 border border-primary/30">
          <Building2 className="h-3.5 w-3.5 text-primary" />
        </div>

        {/* Company name */}
        <div className="flex-1 min-w-0 text-left">
          {activeCompany ? (
            <>
              <p className="truncate text-xs font-semibold text-sidebar-foreground leading-none">
                {activeCompany.name}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40 mt-0.5 leading-none capitalize">
                {activeCompany.role.toLowerCase()}
              </p>
            </>
          ) : (
            <p className="text-xs text-sidebar-foreground/50">Select company</p>
          )}
        </div>

        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 flex-shrink-0 text-sidebar-foreground/40 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-sidebar-border bg-sidebar shadow-lg overflow-hidden"
          >
            <div className="max-h-56 overflow-y-auto py-1">
              {companies.map((company) => (
                <button
                  key={company.id}
                  role="option"
                  aria-selected={activeCompany?.id === company.id}
                  onClick={() => handleSelect(company)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-sidebar-accent transition-colors"
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full flex-shrink-0',
                      STATUS_COLORS[company.status] ?? 'bg-slate-500',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-sidebar-foreground">{company.name}</p>
                    <p className="text-[10px] text-sidebar-foreground/40 capitalize">{company.role.toLowerCase()}</p>
                  </div>
                  {activeCompany?.id === company.id && (
                    <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Divider + Create new */}
            <div className="border-t border-sidebar-border">
              <button
                id="btn-selector-create-company"
                onClick={() => { setOpen(false); router.push('/companies/new'); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New company</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
