'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCompany } from '@/lib/company/company-context';
import { useAuth } from '@/lib/auth/auth-context';
import { usePermissions } from '@/lib/auth/use-permissions';
import { rbacApi } from '@/lib/rbac/rbac-api';
import { PermissionGate } from '@/components/auth/permission-gate';
import { RouteGuard } from '@/components/auth/route-guard';
import {
  ArrowLeft,
  Users,
  Shield,
  AlertCircle,
  Loader2,
  Crown,
  UserMinus,
  UserCheck,
  Mail,
  Plus,
  Edit2,
  CheckCircle2,
  X,
  Truck,
  FileText,
  Radio,
  Layers,
} from 'lucide-react';
import type { CompanyMemberDto, RoleSummaryDto } from '@ai-mos/types';
import { cn } from '@/lib/utils';

const ROLE_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  OWNER: { label: 'Owner', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: Crown },
  ADMIN: { label: 'Admin', color: 'text-primary bg-primary/10 border-primary/20', icon: Shield },
  MANAGER: { label: 'Manager', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20', icon: UserCheck },
  DISPATCHER: { label: 'Dispatcher', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: Radio },
  ACCOUNTANT: { label: 'Accountant', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: FileText },
  DRIVER: { label: 'Driver', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', icon: Truck },
  MEMBER: { label: 'Member', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20', icon: Users },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'text-emerald-400' },
  SUSPENDED: { label: 'Suspended', color: 'text-amber-400' },
  REMOVED: { label: 'Removed', color: 'text-red-400' },
  INVITED: { label: 'Invited', color: 'text-sky-400' },
};

function MemberRow({
  member,
  currentUserId,
  onOpenRoleModal,
  onRemove,
}: {
  member: CompanyMemberDto;
  currentUserId?: string;
  onOpenRoleModal: (m: CompanyMemberDto) => void;
  onRemove: (userId: string) => Promise<void>;
}) {
  const roleConf = ROLE_CONFIG[member.role] ?? {
    label: member.role,
    color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
    icon: Layers,
  };
  const statusConf = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.ACTIVE;
  const RoleIcon = roleConf.icon;
  const isMe = member.userId === currentUserId;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0">
      {/* Avatar */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-sm font-semibold text-primary">
        {member.user.firstName?.charAt(0) ?? ''}
        {member.user.lastName?.charAt(0) ?? ''}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {member.user.firstName} {member.user.lastName}
            {isMe && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}
          </p>
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
      </div>

      {/* Role badge */}
      <span
        className={cn(
          'flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0',
          roleConf.color,
        )}
      >
        <RoleIcon className="h-3 w-3" />
        {roleConf.label}
      </span>

      {/* Status */}
      <span className={cn('text-[10px] flex-shrink-0', statusConf.color)}>{statusConf.label}</span>

      {/* Actions */}
      {!isMe && member.role !== 'OWNER' && (
        <PermissionGate permission="company.members.write">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onOpenRoleModal(member)}
              title="Change Role"
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              <Edit2 className="h-3 w-3" />
              <span>Change Role</span>
            </button>
            <button
              onClick={() => onRemove(member.userId)}
              title="Remove member"
              className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <UserMinus className="h-4 w-4" />
            </button>
          </div>
        </PermissionGate>
      )}
    </div>
  );
}

export default function MembersPage() {
  return (
    <RouteGuard requiredPermission="company.members.read">
      <MembersContent />
    </RouteGuard>
  );
}

function MembersContent() {
  const { companyId } = useParams<{ companyId: string }>();
  const { getMembers, updateMember, removeMember, createInvitation } = useCompany();
  const { user, accessToken } = useAuth();
  const { companyRole } = usePermissions();

  const [members, setMembers] = useState<CompanyMemberDto[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  // Role Change Modal state
  const [roleModalMember, setRoleModalMember] = useState<CompanyMemberDto | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('MEMBER');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleUpdateError, setRoleUpdateError] = useState<string | null>(null);

  const reload = async () => {
    const m = await getMembers(companyId);
    setMembers(m);
  };

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      getMembers(companyId),
      accessToken ? rbacApi.listRoles(accessToken, companyId) : Promise.resolve([]),
    ])
      .then(([mList, rList]) => {
        setMembers(mList);
        setAvailableRoles(rList);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load members'))
      .finally(() => setLoading(false));
  }, [companyId, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter assignable roles based on current administrator authority level
  const assignableRoles = useMemo(() => {
    const levelMap: Record<string, number> = {
      OWNER: 80,
      ADMIN: 60,
      MANAGER: 40,
      DISPATCHER: 30,
      ACCOUNTANT: 30,
      DRIVER: 20,
      CUSTOMER: 10,
      MEMBER: 10,
    };
    const callerLevel = levelMap[companyRole ?? ''] ?? 10;
    const isOwner = companyRole === 'OWNER';

    // Standard platform roles
    const standardOptions = [
      { name: 'OWNER', label: 'Owner (Level 80)', level: 80 },
      { name: 'ADMIN', label: 'Admin (Level 60)', level: 60 },
      { name: 'MANAGER', label: 'Manager (Level 40)', level: 40 },
      { name: 'DISPATCHER', label: 'Dispatcher (Level 30)', level: 30 },
      { name: 'ACCOUNTANT', label: 'Accountant (Level 30)', level: 30 },
      { name: 'DRIVER', label: 'Driver (Level 20)', level: 20 },
      { name: 'MEMBER', label: 'Member (Level 10)', level: 10 },
    ];

    // Tenant-scoped custom roles
    const customOptions = availableRoles
      .filter((r) => !r.isSystem && r.scope === 'COMPANY')
      .map((r) => ({
        name: r.name,
        label: `${r.name} (Custom - Level ${r.level})`,
        level: r.level,
      }));

    return [...standardOptions, ...customOptions].filter((r) => {
      if (isOwner) return true;
      return r.level < callerLevel;
    });
  }, [companyRole, availableRoles]);

  const handleOpenRoleModal = (m: CompanyMemberDto) => {
    setRoleModalMember(m);
    setSelectedRole(m.role);
    setRoleUpdateError(null);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalMember || !companyId) return;
    setIsUpdatingRole(true);
    setRoleUpdateError(null);
    try {
      if (accessToken) {
        await rbacApi.updateMemberRole(accessToken, companyId, roleModalMember.userId, selectedRole);
      } else {
        await updateMember(companyId, roleModalMember.userId, { role: selectedRole });
      }
      setRoleModalMember(null);
      await reload();
    } catch (e) {
      setRoleUpdateError(e instanceof Error ? e.message : 'Failed to update member role');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member from the company?')) return;
    try {
      await removeMember(companyId, userId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    setInviteResult(null);
    setError(null);
    try {
      const result = await createInvitation(companyId, { email: inviteEmail, role: inviteRole });
      const inv = result as { developmentToken?: string };
      if (inv.developmentToken) {
        setInviteResult(`[DEV] Invite token: ${inv.developmentToken}`);
      } else {
        setInviteResult(`Invitation sent to ${inviteEmail}`);
      }
      setInviteEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create invitation');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/companies/${companyId}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to company
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Company Members & Roles</h1>
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? 'member' : 'members'} in this organization
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Invite form */}
      <PermissionGate permission="company.invite">
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Invite Member
          </h2>
          <form id="form-invite-member" onSubmit={handleInvite} className="flex gap-2">
            <input
              id="invite-email"
              type="email"
              required
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
            >
              {assignableRoles.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              id="btn-send-invite"
              type="submit"
              disabled={inviting || !inviteEmail}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Invite
            </button>
          </form>
          {inviteResult && <p className="text-xs text-emerald-400 font-mono break-all">{inviteResult}</p>}
        </div>
      </PermissionGate>

      {/* Members list */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Organization Team</h2>
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 py-4 text-center">No members found</p>
        ) : (
          members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              currentUserId={user?.id}
              onOpenRoleModal={handleOpenRoleModal}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>

      {/* Change Role Modal */}
      {roleModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Change Member Role
              </h2>
              <button
                onClick={() => setRoleModalMember(null)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {roleUpdateError && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{roleUpdateError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRole} className="space-y-4">
              {/* Member Summary */}
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-sm font-bold text-primary">
                  {roleModalMember.user.firstName?.charAt(0) ?? ''}
                  {roleModalMember.user.lastName?.charAt(0) ?? ''}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {roleModalMember.user.firstName} {roleModalMember.user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{roleModalMember.user.email}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Current role: <strong className="text-foreground">{roleModalMember.role}</strong>
                  </p>
                </div>
              </div>

              {/* Role Selection Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Select New Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {assignableRoles.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Only roles with authority level permitted by your administrative status are displayed.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setRoleModalMember(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingRole}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUpdatingRole ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
