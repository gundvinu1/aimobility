'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  ChevronRight,
  Server,
  Database,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@ai-mos/constants';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navItems: NavGroup[] = [
  {
    title: 'Foundation',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Coming Soon',
    items: [
      { label: 'Fleet', href: '#', icon: Server, disabled: true },
      { label: 'Database', href: '#', icon: Database, disabled: true },
      { label: 'Analytics', href: '#', icon: Activity, disabled: true },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div>
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground">{APP_NAME}</span>
          <span className="block text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Admin</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navItems.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-disabled={item.disabled}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                      item.disabled
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      pathname === item.href
                        ? 'bg-sidebar-primary/20 text-sidebar-primary border border-sidebar-primary/20'
                        : 'text-sidebar-foreground/70',
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {pathname === item.href && (
                      <ChevronRight className="h-3 w-3 text-sidebar-primary" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <p className="text-[10px] text-sidebar-foreground/30 text-center">
          Foundation v0.1.0
        </p>
      </div>
    </aside>
  );
}
