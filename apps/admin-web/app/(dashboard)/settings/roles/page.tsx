'use client';

import React from 'react';
import { RoleListView } from '@/components/rbac/role-list-view';
import { useCompany } from '@/lib/company/company-context';

export default function SettingsRolesPage() {
  const { activeCompany } = useCompany();
  return <RoleListView companyId={activeCompany?.id} baseRoute="/settings/roles" />;
}
