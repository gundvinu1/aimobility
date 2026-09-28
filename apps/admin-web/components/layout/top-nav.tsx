'use client';

import { usePathname } from 'next/navigation';
import { Bell, User, ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

import { ThemeSwitcher } from '@/components/layout/theme-switcher';

function useBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = [{ label: 'Home', href: '/dashboard' }];
  let path = '';
  for (const segment of segments) {
    path += `/${segment}`;
    crumbs.push({
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      href: path,
    });
  }
  // Remove duplicate if first segment is already dashboard
  return crumbs.length > 1 && crumbs[0].href === crumbs[1].href
    ? crumbs.slice(1)
    : crumbs;
}

export function TopNav() {
  const breadcrumbs = useBreadcrumbs();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6 sticky top-0 z-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <Home className="h-3.5 w-3.5 text-muted-foreground" />
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <ThemeSwitcher />

        {/* Notifications placeholder */}
        <button
          id="notifications-btn"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {/* Notification indicator */}
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
        </button>

        {/* Profile placeholder */}
        <button
          id="profile-btn"
          aria-label="User profile"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
