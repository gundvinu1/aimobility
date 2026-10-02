import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { CompanyProvider } from '@/lib/company/company-context';
import '@/app/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AI-MOS | AI Mobility Operating System',
    template: '%s | AI-MOS',
  },
  description:
    'AI-MOS — Enterprise SaaS Platform for Mobility Businesses. Manage fleets, drivers, bookings and more.',
  keywords: ['mobility', 'fleet management', 'car rental', 'transportation', 'saas'],
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <AuthProvider>
              <CompanyProvider>{children}</CompanyProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
