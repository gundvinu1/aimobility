'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowLeft, LayoutDashboard, Building2 } from 'lucide-react';

export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      {/* Background radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-destructive/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-md rounded-2xl border border-border/60 bg-card/60 p-8 shadow-2xl backdrop-blur-xl">
        {/* Shield Icon with glowing ring */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 border border-destructive/30 shadow-inner">
          <ShieldAlert className="h-8 w-8 text-destructive animate-pulse" />
        </div>

        {/* Status Pill */}
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          HTTP 403 Forbidden
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Access Restricted
        </h1>

        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          You don&apos;t have permission to access this resource. Your current role and active company
          context do not grant the required authorization.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
          >
            <LayoutDashboard className="h-4 w-4" />
            Go to Dashboard
          </Link>

          <Link
            href="/companies"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/40 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
          >
            <Building2 className="h-4 w-4" />
            Switch Company
          </Link>

          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground/60">
        AI-MOS Enterprise Mobility Platform • Security Boundary Enforced
      </p>
    </div>
  );
}
