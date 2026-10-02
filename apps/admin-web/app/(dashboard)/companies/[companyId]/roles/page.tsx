'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { RoleListView } from '@/components/rbac/role-list-view';

export default function CompanyRolesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  return <RoleListView companyId={companyId} baseRoute={`/companies/${companyId}/roles`} />;
}
