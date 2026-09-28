import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Request a password reset link',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
