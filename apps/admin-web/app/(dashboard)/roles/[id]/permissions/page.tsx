import { RoleDetailsView } from '@/components/rbac/role-details-view';

export const metadata = {
  title: 'Role Permissions Matrix | AI-MOS',
  description: 'Role permissions matrix and management',
};

interface RolePermissionsPageProps {
  params: {
    id: string;
  };
}

export default function RolePermissionsPage({ params }: RolePermissionsPageProps) {
  return <RoleDetailsView roleId={params.id} backRoute="/roles" />;
}
