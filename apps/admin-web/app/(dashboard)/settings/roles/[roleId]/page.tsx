'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { RoleDetailsView } from '@/components/rbac/role-details-view';
import { useCompany } from '@/lib/company/company-context';

export default function SettingsRoleDetailsPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const { activeCompany } = useCompany();

  return (
    <RoleDetailsView
      roleId={roleId}
      companyId={activeCompany?.id}
      backRoute="/settings/roles"
    />
  );
}
