'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { RoleDetailsView } from '@/components/rbac/role-details-view';

export default function CompanyRoleDetailsPage() {
  const { companyId, roleId } = useParams<{ companyId: string; roleId: string }>();

  return (
    <RoleDetailsView
      roleId={roleId}
      companyId={companyId}
      backRoute={`/companies/${companyId}/roles`}
    />
  );
}
