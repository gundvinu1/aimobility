import { RoleListView } from '@/components/rbac/role-list-view';

export const metadata = {
  title: 'Roles & Permissions | AI-MOS',
  description: 'Manage platform and tenant roles and permissions',
};

export default function RolesPage() {
  return <RoleListView baseRoute="/roles" />;
}
