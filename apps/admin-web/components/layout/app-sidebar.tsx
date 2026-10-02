'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  ChevronRight,
  Building2,
  Users,
  Settings,
  Car,
  UserCheck,
  CalendarDays,
  Route,
  Radio,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@ai-mos/constants';
import { CompanySelector } from '@/components/company/company-selector';
import { usePermissions } from '@/lib/auth/use-permissions';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  anyPermission?: string[];
  disabled?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

export function AppSidebar() {
  const pathname = usePathname();
  const { activeCompany, companyRole, hasPermission, hasAnyPermission } = usePermissions();
  const companyId = activeCompany?.id;

  const isCustomer = companyRole === 'CUSTOMER';
  const isDriver = companyRole === 'DRIVER';

  const rawNavGroups: NavGroup[] = [
    {
      title: 'Platform',
      items: [
        {
          label: 'Dashboard',
          href: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          label: 'Companies',
          href: '/companies',
          icon: Building2,
          permission: 'company.read',
        },
        {
          label: 'Roles & Permissions',
          href: '/settings/roles',
          icon: Shield,
          permission: 'role.read',
        },
      ],
    },
    ...(companyId
      ? [
          {
            title: isCustomer ? 'Customer Services' : isDriver ? 'Driver Portal' : 'Fleet Operations',
            items: [
              {
                label: 'Overview',
                href: `/companies/${companyId}`,
                icon: Building2,
                permission: 'company.read',
              },
              {
                label: 'Employees',
                href: `/companies/${companyId}/employees`,
                icon: Users,
                permission: 'employee.read',
              },
              {
                label: isDriver ? 'Assigned Vehicle' : 'Vehicles',
                href: `/companies/${companyId}/vehicles`,
                icon: Car,
                permission: 'vehicle.read',
              },
              {
                label: 'Drivers',
                href: `/companies/${companyId}/drivers`,
                icon: UserCheck,
                permission: 'driver.read',
              },
              {
                label: isCustomer ? 'My Bookings' : 'Bookings',
                href: `/companies/${companyId}/bookings`,
                icon: CalendarDays,
                permission: 'booking.read',
              },
              {
                label: isCustomer || isDriver ? 'My Trips' : 'Trips',
                href: `/companies/${companyId}/trips`,
                icon: Route,
                permission: 'trip.read',
              },
              {
                label: 'Dispatch Board',
                href: `/companies/${companyId}/dispatch`,
                icon: Radio,
                permission: 'trip.dispatch',
              },
              {
                label: 'Members',
                href: `/companies/${companyId}/members`,
                icon: Users,
                permission: 'company.members.read',
              },
              {
                label: 'Roles & Permissions',
                href: `/companies/${companyId}/roles`,
                icon: Shield,
                permission: 'role.read',
              },
              {
                label: 'Settings',
                href: `/companies/${companyId}/settings`,
                icon: Settings,
                permission: 'company.settings.read',
              },
            ],
          },
        ]
      : []),
  ];

  // Dynamic permission filter — never render unauthorized items
  const navGroups: NavGroup[] = rawNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.permission && !hasPermission(item.permission)) return false;
        if (item.anyPermission && !hasAnyPermission(item.anyPermission)) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand Logo & Title */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground truncate block">
            {APP_NAME}
          </span>
          <span className="block text-[10px] text-sidebar-foreground/50 uppercase tracking-widest truncate">
            Mobility OS
          </span>
        </div>
      </div>

      {/* Tenant Context Selector */}
      <div className="border-b border-sidebar-border px-3 py-3">
        <CompanySelector />
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/companies/${companyId}` && pathname.startsWith(item.href + '/'));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-disabled={item.disabled}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                        item.disabled
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isActive
                          ? 'bg-sidebar-primary/20 text-sidebar-primary border border-sidebar-primary/20 font-semibold'
                          : 'text-sidebar-foreground/70',
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && <ChevronRight className="h-3 w-3 text-sidebar-primary" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer & Active Role Indicator */}
      <div className="border-t border-sidebar-border px-4 py-3 bg-sidebar-accent/10">
        <div className="flex items-center justify-between text-[11px] text-sidebar-foreground/60 mb-1">
          <span className="flex items-center gap-1.5 font-medium">
            <Shield className="h-3 w-3 text-primary" />
            Active Role:
          </span>
          <span className="font-semibold text-primary uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
            {companyRole || 'USER'}
          </span>
        </div>
        <p className="text-[10px] text-sidebar-foreground/30 text-center mt-1">AI-MOS Platform v0.8.0</p>
      </div>
    </aside>
  );
}
