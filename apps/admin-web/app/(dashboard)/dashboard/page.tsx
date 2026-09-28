import type { Metadata } from 'next';
import {
  Activity,
  Database,
  Server,
  Zap,
  GitBranch,
  Package,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { APP_NAME, APP_FULL_NAME, APP_VERSION } from '@ai-mos/constants';

export const metadata: Metadata = {
  title: 'Foundation Dashboard',
  description: 'AI-MOS Foundation Dashboard — System overview and health status.',
};

const modules = [
  { name: 'ConfigModule', description: 'Environment validation & configuration namespaces', status: 'active' },
  { name: 'DatabaseModule', description: 'Prisma 5 + PostgreSQL 16 connection', status: 'active' },
  { name: 'CacheModule', description: 'Redis 7 via ioredis', status: 'active' },
  { name: 'QueueModule', description: 'BullMQ job queue infrastructure', status: 'active' },
  { name: 'HealthModule', description: 'Live + Ready health endpoints', status: 'active' },
  { name: 'LoggerModule', description: 'Structured logging via nestjs-pino', status: 'active' },
  { name: 'CommonModule', description: 'Metrics endpoint + exception filter', status: 'active' },
];

const packages = [
  { name: '@ai-mos/config', description: 'TypeScript + ESLint configurations' },
  { name: '@ai-mos/types', description: 'Shared TypeScript type definitions' },
  { name: '@ai-mos/constants', description: 'Platform-wide constants' },
  { name: '@ai-mos/utils', description: 'Generic utility functions' },
  { name: '@ai-mos/validation', description: 'Zod schema validation' },
  { name: '@ai-mos/database', description: 'Prisma client & schema' },
  { name: '@ai-mos/api-client', description: 'Typed HTTP client (Axios)' },
  { name: '@ai-mos/ui', description: 'shadcn/ui component library' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{APP_NAME}</h1>
              <p className="text-muted-foreground">{APP_FULL_NAME}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <StatusBadge icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Foundation" color="green" />
            <StatusBadge icon={<GitBranch className="h-3.5 w-3.5" />} label={`v${APP_VERSION}`} color="blue" />
            <StatusBadge icon={<Globe className="h-3.5 w-3.5" />} label="Development" color="yellow" />
          </div>
          <p className="mt-6 max-w-2xl text-muted-foreground leading-relaxed">
            Foundation layer complete. The platform is ready for future business modules including
            Authentication, Fleet Management, Booking, Billing, and more.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<Server className="h-5 w-5" />} label="Backend Modules" value="7" />
        <StatCard icon={<Package className="h-5 w-5" />} label="Shared Packages" value="8" />
        <StatCard icon={<Database className="h-5 w-5" />} label="DB Tables" value="2" />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Health Endpoints" value="3" />
      </div>

      {/* Backend Modules */}
      <Section title="Backend Modules" subtitle="NestJS infrastructure modules powering the platform">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <ModuleCard key={mod.name} name={mod.name} description={mod.description} status={mod.status} />
          ))}
        </div>
      </Section>

      {/* Shared Packages */}
      <Section title="Shared Packages" subtitle="Reusable packages consumed by all apps in the monorepo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => (
            <PackageCard key={pkg.name} name={pkg.name} description={pkg.description} />
          ))}
        </div>
      </Section>

      {/* Quick Links */}
      <Section title="Quick Links" subtitle="API endpoints and developer tools">
        <div className="grid gap-3 sm:grid-cols-3">
          <LinkCard href="http://localhost:4000/api/v1/health/live" label="Health: Live" description="GET /api/v1/health/live" />
          <LinkCard href="http://localhost:4000/api/v1/health/ready" label="Health: Ready" description="GET /api/v1/health/ready" />
          <LinkCard href="http://localhost:4000/api/v1/docs" label="Swagger API Docs" description="GET /api/v1/docs" />
        </div>
      </Section>
    </div>
  );
}

function StatusBadge({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: 'green' | 'blue' | 'yellow';
}) {
  const colors = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${colors[color]}`}
    >
      {icon}
      {label}
    </span>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ModuleCard({
  name,
  description,
  status,
}: {
  name: string;
  description: string;
  status: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/20 hover:bg-accent/50">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-foreground text-sm">{name}</h3>
        <span className="mt-0.5 flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {status}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function PackageCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/20 hover:bg-accent/50">
      <h3 className="font-mono text-xs font-semibold text-primary">{name}</h3>
      <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function LinkCard({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-accent/50 hover:shadow-md group"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{label}</h3>
        <Globe className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <p className="mt-1 text-xs font-mono text-muted-foreground">{description}</p>
    </a>
  );
}
