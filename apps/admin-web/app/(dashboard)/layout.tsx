import type { Metadata } from 'next';

import { AppSidebar } from '@/components/layout/app-sidebar';
import { TopNav } from '@/components/layout/top-nav';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
