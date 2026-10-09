'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FleetAlertDto } from '@ai-mos/types';
import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertToastProps {
  alert: FleetAlertDto | null;
  companyId: string;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function AlertToastNotification({
  alert,
  companyId,
  onDismiss,
  autoDismissMs = 8000,
}: AlertToastProps) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!alert) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [alert, autoDismissMs, onDismiss]);

  if (!alert) return null;

  const isCritical = alert.severity === 'CRITICAL';
  const isHigh = alert.severity === 'HIGH';

  const handleClick = () => {
    router.push(`/companies/${companyId}/alerts`);
    onDismiss();
  };

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border p-4 shadow-2xl backdrop-blur transition-all duration-300 cursor-pointer',
        isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95 pointer-events-none',
        isCritical
          ? 'border-red-500/40 bg-red-950/90 text-red-100'
          : isHigh
          ? 'border-amber-500/40 bg-amber-950/90 text-amber-100'
          : 'border-border bg-card/95 text-foreground',
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'p-2 rounded-lg flex-shrink-0',
            isCritical
              ? 'bg-red-500/20 text-red-400'
              : isHigh
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-primary/20 text-primary',
          )}
        >
          {isCritical ? (
            <ShieldAlert className="h-5 w-5 animate-pulse" />
          ) : isHigh ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Info className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={cn(
                'text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded',
                isCritical
                  ? 'bg-red-500 text-white'
                  : isHigh
                  ? 'bg-amber-500 text-black'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              {alert.severity} ALERT
            </span>
            <span className="text-xs font-semibold truncate">{alert.type}</span>
          </div>

          <p className="text-xs font-bold truncate">
            {alert.vehicleNumber ? `Vehicle ${alert.vehicleNumber}` : alert.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {alert.message}
          </p>

          {alert.driverName && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Driver: {alert.driverName}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
