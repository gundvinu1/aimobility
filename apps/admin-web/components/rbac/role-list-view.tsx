'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { rbacApi } from '@/lib/rbac/rbac-api';
import type { RoleSummaryDto } from '@ai-mos/types';
import {
  Shield,
  Plus,
  Search,
  Lock,
  Layers,
  CheckCircle2,
  Trash2,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  Users,
  Edit2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/route-guard';
import { PermissionGate } from '@/components/auth/permission-gate';

interface RoleListViewProps {
  companyId?: string;
  baseRoute: string; // e.g. `/settings/roles` or `/companies/${companyId}/roles`
}

export function RoleListView({ companyId, baseRoute }: RoleListViewProps) {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [roles, setRoles] = useState<RoleSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'PLATFORM' | 'COMPANY'>('ALL');

  // Create role modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createLevel, setCreateLevel] = useState(35);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit role modal state
  const [editingRole, setEditingRole] = useState<RoleSummaryDto | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Delete modal state
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadRoles = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await rbacApi.listRoles(accessToken, companyId, {
        search: search || undefined,
        scope: scopeFilter === 'ALL' ? undefined : scopeFilter,
      });
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, companyId, search, scopeFilter]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      if (scopeFilter !== 'ALL' && r.scope !== scopeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [roles, scopeFilter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await rbacApi.createRole(
        accessToken,
        {
          name: createName.trim(),
          description: createDesc.trim() || undefined,
          level: Number(createLevel),
          scope: companyId ? 'COMPANY' : 'PLATFORM',
        },
        companyId,
      );
      setIsCreateOpen(false);
      setCreateName('');
      setCreateDesc('');
      await loadRoles();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !editingRole) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await rbacApi.updateRole(
        accessToken,
        editingRole.id,
        {
          name: editingRole.isSystem ? undefined : editName.trim(),
          description: editDesc.trim(),
        },
        companyId,
      );
      setEditingRole(null);
      await loadRoles();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditModal = (role: RoleSummaryDto) => {
    setEditingRole(role);
    setEditName(role.name);
    setEditDesc(role.description ?? '');
    setUpdateError(null);
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    setIsDeleting(true);
    try {
      await rbacApi.deleteRole(accessToken, id, companyId);
      setDeletingRoleId(null);
      await loadRoles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete role');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <RouteGuard requiredPermission="role.read">
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Shield className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Role & Permission Administration
              </h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage hierarchical access control, assign permissions to roles, and define custom tenant roles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadRoles()}
              disabled={isLoading}
              className="rounded-xl border border-border/60 bg-card/60 p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
              title="Refresh roles"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </button>

            <PermissionGate permission="role.create">
              <button
                id="create-custom-role-btn"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                New Custom Role
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search roles by title or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-muted/30 pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {(['ALL', 'PLATFORM', 'COMPANY'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScopeFilter(s)}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                  scopeFilter === s
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                {s === 'ALL' ? 'All Scopes' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Roles Table */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm backdrop-blur-xl">
          {isLoading && roles.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 p-8">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading role matrix…</p>
            </div>
          ) : error ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-semibold text-destructive">{error}</p>
              <button
                onClick={() => void loadRoles()}
                className="rounded-xl border border-border/60 px-4 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Retry
              </button>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <Shield className="h-8 w-8 opacity-40 mb-1" />
              <p className="text-sm font-medium">No roles found matching your query</p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-primary hover:underline"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3.5">Role Name</th>
                    <th className="px-5 py-3.5">Type & Scope</th>
                    <th className="px-5 py-3.5">Authority Level</th>
                    <th className="px-5 py-3.5">Permissions</th>
                    <th className="px-5 py-3.5">Users</th>
                    <th className="px-5 py-3.5">Created Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredRoles.map((role) => (
                    <tr
                      key={role.id}
                      className="group transition-colors hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`${baseRoute}/${role.id}`)}
                    >
                      {/* Name & Description */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border text-xs font-bold',
                              role.isSystem
                                ? 'bg-primary/10 border-primary/20 text-primary'
                                : 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400',
                            )}
                          >
                            {role.isSystem ? <Lock className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{role.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                              {role.description ?? 'No description provided.'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type & Scope Badges */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                              role.isSystem
                                ? 'bg-muted text-muted-foreground border-border/60'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                            )}
                          >
                            {role.isSystem ? 'System' : 'Custom'}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                              role.scope === 'PLATFORM'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                            )}
                          >
                            {role.scope}
                          </span>
                        </div>
                      </td>

                      {/* Level */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(role.level, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-medium text-foreground">
                            Lvl {role.level}
                          </span>
                        </div>
                      </td>

                      {/* Permission Count */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/60 px-2.5 py-1 text-xs font-medium text-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          {role.permissionCount} permissions
                        </span>
                      </td>

                      {/* User Count */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground">
                          <Users className="h-3.5 w-3.5 text-primary" />
                          {role.userCount ?? 0} members
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="px-5 py-4 text-xs text-muted-foreground font-mono">
                        {new Date(role.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`${baseRoute}/${role.id}`}
                            className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-card/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition"
                          >
                            <span>Matrix</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </Link>

                          {/* Edit Button */}
                          <PermissionGate permission="role.update">
                            <button
                              onClick={() => openEditModal(role)}
                              className="rounded-xl p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition"
                              title="Edit role metadata"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </PermissionGate>

                          {/* Delete or Protected Indicator */}
                          {!role.isSystem ? (
                            <PermissionGate permission="role.delete">
                              <button
                                onClick={() => setDeletingRoleId(role.id)}
                                className="rounded-xl p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                                title="Delete custom role"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </PermissionGate>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[10px] text-muted-foreground bg-muted/40 border border-border/40 font-medium"
                              title="Protected system role — cannot be deleted"
                            >
                              <Lock className="h-2.5 w-2.5" />
                              Protected
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Role Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Add Custom Role
                </h2>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {createError && (
                <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Role Identifier / Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FLEET_SUPERVISOR or Fleet Supervisor"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Alphanumeric characters, spaces, hyphens, and underscores permitted.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe the responsibilities of this role…"
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Authority Level: <span className="font-mono text-primary font-bold">{createLevel}</span>
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    value={createLevel}
                    onChange={(e) => setCreateLevel(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
                    <span>10 (Customer/Driver)</span>
                    <span>30 (Ops)</span>
                    <span>50 (Supervisor)</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !createName.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Create Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Role Modal */}
        {editingRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Edit2 className="h-5 w-5 text-primary" />
                  Edit Role: {editingRole.name}
                </h2>
                <button
                  onClick={() => setEditingRole(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {updateError && (
                <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{updateError}</span>
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Role Identifier / Name
                  </label>
                  <input
                    type="text"
                    disabled={editingRole.isSystem}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {editingRole.isSystem && (
                    <p className="mt-1 text-[11px] text-amber-400">
                      System role names cannot be renamed.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Briefly describe the responsibilities of this role…"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setEditingRole(null)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingRoleId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive mx-auto">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-center text-base font-bold text-foreground mb-1">
                Delete Custom Role?
              </h3>
              <p className="text-center text-xs text-muted-foreground mb-6">
                This will permanently remove this custom role and unassign all permissions. This action cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDeletingRoleId(null)}
                  className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => handleDelete(deletingRoleId)}
                  className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition disabled:opacity-50"
                >
                  {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
