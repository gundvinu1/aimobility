import { Suspense } from 'react';
import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Verify your email address',
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8 text-sm text-muted-foreground">Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
