import { RoleDetailsView } from '@/components/rbac/role-details-view';

export const metadata = {
  title: 'Role Details & Permissions | AI-MOS',
  description: 'Role permissions matrix and assigned members',
};

interface RoleDetailsPageProps {
  params: {
    id: string;
  };
}

export default function RoleDetailsPage({ params }: RoleDetailsPageProps) {
  return <RoleDetailsView roleId={params.id} backRoute="/roles" />;
}
