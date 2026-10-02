'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/auth-context';
import { usePermissions } from '@/lib/auth/use-permissions';
import { rbacApi } from '@/lib/rbac/rbac-api';
import type { RoleDetailDto, PermissionDto } from '@ai-mos/types';
import {
  Shield,
  ArrowLeft,
  Lock,
  Layers,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';

interface RoleDetailsViewProps {
  roleId: string;
  companyId?: string;
  backRoute: string; // e.g. `/settings/roles` or `/companies/${companyId}/roles`
}

export function RoleDetailsView({ roleId, companyId, backRoute }: RoleDetailsViewProps) {
  const { accessToken } = useAuth();
  const { hasPermission, companyRole } = usePermissions();

  const [role, setRole] = useState<RoleDetailDto | null>(null);
  const [allPermissions, setAllPermissions] = useState<PermissionDto[]>([]);
  const [assignedPermNames, setAssignedPermNames] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Save state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const [roleData, permsData] = await Promise.all([
        rbacApi.getRole(accessToken, roleId, companyId),
        rbacApi.listPermissions(accessToken),
      ]);
      setRole(roleData);
      setAllPermissions(permsData);
      setAssignedPermNames(new Set(roleData.permissions.map((p) => p.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load role details');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, roleId, companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Group permissions by module
  const moduleGroups = useMemo(() => {
    const groups: Record<string, PermissionDto[]> = {};
    for (const p of allPermissions) {
      const mod = p.module ?? 'GENERAL';
      if (!groups[mod]) groups[mod] = [];
      groups[mod]!.push(p);
    }
    return groups;
  }, [allPermissions]);

  const togglePermission = (permName: string) => {
    setAssignedPermNames((prev) => {
      const next = new Set(prev);
      if (next.has(permName)) next.delete(permName);
      else next.add(permName);
      return next;
    });
    setSaveSuccess(null);
  };

  const toggleModule = (moduleName: string, selectAll: boolean) => {
    const perms = moduleGroups[moduleName] ?? [];
    setAssignedPermNames((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (selectAll) next.add(p.name);
        else next.delete(p.name);
      }
      return next;
    });
    setSaveSuccess(null);
  };

  const handleSave = async () => {
    if (!accessToken || !role) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await rbacApi.updateRolePermissions(
        accessToken,
        role.id,
        Array.from(assignedPermNames),
        companyId,
      );
      setRole(updated);
      setAssignedPermNames(new Set(updated.permissions.map((p) => p.name)));
      setIsConfirmOpen(false);
      setSaveSuccess(`Permissions for role "${role.name}" updated successfully!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update permissions');
      setIsConfirmOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit =
    (hasPermission('permission.assign') || hasPermission('role.update')) &&
    (role?.name !== 'SUPER_ADMIN' || companyRole === 'SUPER_ADMIN');

  return (
    <RouteGuard requiredPermission="role.read">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link
            href={backRoute}
            className="flex items-center gap-1 hover:text-foreground transition font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Roles
          </Link>
          <span>/</span>
          <span className="text-foreground font-semibold">{role?.name ?? 'Role Details'}</span>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-8 shadow-sm">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading permission matrix…</p>
          </div>
        ) : error && !role ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
            <button onClick={() => loadData()} className="mt-4 text-xs underline font-semibold">
              Try again
            </button>
          </div>
        ) : role ? (
          <>
            {/* Role Header Card */}
            <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border text-xl font-bold shadow-sm',
                      role.isSystem
                        ? 'bg-primary/10 border-primary/20 text-primary'
                        : 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400',
                    )}
                  >
                    {role.isSystem ? <Lock className="h-7 w-7" /> : <Layers className="h-7 w-7" />}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold text-foreground">{role.name}</h1>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                          role.isSystem
                            ? 'bg-muted text-muted-foreground border-border/60'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                        )}
                      >
                        {role.isSystem ? 'System Role' : 'Custom Role'}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                          role.scope === 'PLATFORM'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                        )}
                      >
                        {role.scope} Scope
                      </span>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono font-medium border border-border/60 bg-muted/40">
                        Authority Level {role.level}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {role.description ?? 'No description provided.'}
                    </p>
                  </div>
                </div>

                {/* Right side stats & Save CTA */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-2 text-center">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                      Assigned
                    </p>
                    <p className="text-lg font-bold text-foreground font-mono">
                      {assignedPermNames.size}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        / {allPermissions.length}
                      </span>
                    </p>
                  </div>

                  {canEdit && (
                    <button
                      id="save-permissions-btn"
                      onClick={() => setIsConfirmOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4" />
                      Save Permission Matrix
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Success Feedback Alert */}
            {saveSuccess && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {/* Error Feedback Alert */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Read-Only Notice */}
            {!canEdit && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>
                  Viewing permission matrix in read-only mode. Your role does not have authorization to modify this matrix.
                </span>
              </div>
            )}

            {/* Permission Matrix by Module */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Hierarchical Permission Matrix
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Granted
                  </span>
                  <span className="flex items-center gap-1 ml-2">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                    Restricted
                  </span>
                </div>
              </div>

              {Object.entries(moduleGroups).map(([moduleName, perms]) => {
                const allSelected = perms.every((p) => assignedPermNames.has(p.name));
                const noneSelected = perms.every((p) => !assignedPermNames.has(p.name));
                const countSelected = perms.filter((p) => assignedPermNames.has(p.name)).length;

                return (
                  <div
                    key={moduleName}
                    className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm backdrop-blur-xl"
                  >
                    {/* Module Header Bar */}
                    <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          {moduleName} Module
                        </span>
                        <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {countSelected} of {perms.length} active
                        </span>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => toggleModule(moduleName, true)}
                            disabled={allSelected}
                            className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-30 transition"
                          >
                            Grant All
                          </button>
                          <span className="text-muted-foreground/40">|</span>
                          <button
                            type="button"
                            onClick={() => toggleModule(moduleName, false)}
                            disabled={noneSelected}
                            className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-30 transition"
                          >
                            Revoke All
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Permissions Grid */}
                    <div className="grid grid-cols-1 divide-y divide-border/20 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-3">
                      {perms.map((p) => {
                        const isChecked = assignedPermNames.has(p.name);

                        return (
                          <div
                            key={p.id}
                            onClick={() => canEdit && togglePermission(p.name)}
                            className={cn(
                              'flex items-start gap-3 p-4 transition-colors',
                              canEdit ? 'cursor-pointer hover:bg-muted/30' : 'cursor-default',
                              isChecked ? 'bg-primary/[0.02]' : 'opacity-70',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={!canEdit}
                              onChange={() => togglePermission(p.name)}
                              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-foreground truncate">
                                  {p.name}
                                </span>
                                {p.action && (
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {p.action}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                                {p.description ?? 'Allows operational access to this resource.'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Save Bar (sticky on scroll if edited) */}
            {canEdit && (
              <div className="sticky bottom-6 z-20 flex items-center justify-between rounded-2xl border border-border/80 bg-card/90 p-4 shadow-xl backdrop-blur-xl">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>
                    Current selection:{' '}
                    <strong className="text-foreground">{assignedPermNames.size}</strong> permissions
                  </span>
                </div>
                <button
                  onClick={() => setIsConfirmOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
                >
                  <Save className="h-4 w-4" />
                  Save Permission Matrix
                </button>
              </div>
            )}

            {/* Save Confirmation Modal */}
            {isConfirmOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mx-auto">
                    <Shield className="h-6 w-6" />
                  </div>
                  <h3 className="text-center text-base font-bold text-foreground mb-1">
                    Update permissions for this role?
                  </h3>
                  <p className="text-center text-xs text-muted-foreground mb-6">
                    Updating the permission matrix for <strong>{role.name}</strong> will take effect
                    immediately across the entire platform and active tenant sessions.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setIsConfirmOpen(false)}
                      className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold hover:bg-muted transition"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={isSaving}
                      onClick={handleSave}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition disabled:opacity-50"
                    >
                      {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Confirm & Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </RouteGuard>
  );
}
