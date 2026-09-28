'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex items-center rounded-lg border border-border bg-background p-0.5 gap-0.5">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          id={`theme-${value}-btn`}
          aria-label={`Switch to ${label} theme`}
          onClick={() => setTheme(value)}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            theme === value
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
