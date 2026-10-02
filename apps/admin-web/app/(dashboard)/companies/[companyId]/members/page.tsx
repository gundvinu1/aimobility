'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCompany } from '@/lib/company/company-context';
import { PermissionGate } from '@/components/auth/permission-gate';
import { RouteGuard } from '@/components/auth/route-guard';
import {
  ArrowLeft, Users, Shield, AlertCircle, Loader2,
  Crown, UserMinus, UserCheck, Mail, Plus,
} from 'lucide-react';
import type { CompanyMemberDto } from '@ai-mos/types';
import { cn } from '@/lib/utils';

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  OWNER:   { label: 'Owner',   color: 'text-amber-400   bg-amber-400/10   border-amber-400/20',   icon: Crown     },
  ADMIN:   { label: 'Admin',   color: 'text-primary      bg-primary/10      border-primary/20',      icon: Shield    },
  MANAGER: { label: 'Manager', color: 'text-sky-400      bg-sky-400/10      border-sky-400/20',      icon: UserCheck },
  MEMBER:  { label: 'Member',  color: 'text-slate-400    bg-slate-400/10    border-slate-400/20',    icon: Users     },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: 'Active',    color: 'text-emerald-400' },
  SUSPENDED: { label: 'Suspended', color: 'text-amber-400' },
  REMOVED:   { label: 'Removed',   color: 'text-red-400' },
  INVITED:   { label: 'Invited',   color: 'text-sky-400' },
};

function MemberRow({
  member, currentUserId, onUpdate, onRemove,
}: {
  member: CompanyMemberDto;
  currentUserId?: string;
  onUpdate: (_userId: string, _data: { role?: string }) => Promise<void>;
  onRemove: (_userId: string) => Promise<void>;
}) {
  const roleConf = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.MEMBER;
  const statusConf = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.ACTIVE;
  const RoleIcon = roleConf.icon;
  const isMe = member.userId === currentUserId;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0">
      {/* Avatar */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-sm font-semibold text-primary">
        {member.user.firstName.charAt(0)}{member.user.lastName.charAt(0)}
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
      <span className={cn('flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0', roleConf.color)}>
        <RoleIcon className="h-3 w-3" />
        {roleConf.label}
      </span>

      {/* Status */}
      <span className={cn('text-[10px] flex-shrink-0', statusConf.color)}>{statusConf.label}</span>

      {/* Actions */}
      {!isMe && member.role !== 'OWNER' && (
        <PermissionGate permission="company.members.write">
          <div className="flex items-center gap-1">
            <select
              className="rounded border border-border/50 bg-background px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              value={member.role}
              onChange={(e) => onUpdate(member.userId, { role: e.target.value })}
              aria-label="Change role"
            >
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="MEMBER">Member</option>
            </select>
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
  const [members, setMembers] = useState<CompanyMemberDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  const reload = async () => {
    const m = await getMembers(companyId);
    setMembers(m);
  };

  useEffect(() => {
    if (!companyId) return;
    getMembers(companyId)
      .then((m) => setMembers(m))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load members'))
      .finally(() => setLoading(false));
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = async (userId: string, data: { role?: string }) => {
    try {
      await updateMember(companyId, userId, data);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
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
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Link href={`/companies/${companyId}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to company
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Members</h1>
            <p className="text-sm text-muted-foreground">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
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
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="MEMBER">Member</option>
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
          {inviteResult && (
            <p className="text-xs text-emerald-400 font-mono break-all">{inviteResult}</p>
          )}
        </div>
      </PermissionGate>

      {/* Members list */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Team</h2>
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 py-4 text-center">No members found</p>
        ) : (
          members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              currentUserId={undefined}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>
    </div>
  );
}
