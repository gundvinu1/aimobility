import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Set your new password',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8 text-sm text-muted-foreground">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
