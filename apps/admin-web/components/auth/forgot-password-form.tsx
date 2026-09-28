'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Zap, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json() as { data?: { developmentToken?: string } };
      setSent(true);
      if (json.data?.developmentToken) setDevToken(json.data.developmentToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Check your inbox</h1>
        <p className="text-sm text-muted-foreground mb-6">
          If an account with <strong>{email}</strong> exists, a reset link has been sent.
        </p>
        {devToken && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 mb-6 text-left">
            <p className="text-xs font-semibold text-yellow-400 mb-1">🛠 Development token</p>
            <code className="text-xs text-yellow-300 break-all">{devToken}</code>
          </div>
        )}
        <Link href="/login" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">← Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">AI-MOS</p>
          <p className="text-xs text-muted-foreground">Password recovery</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-1">Forgot your password?</h1>
      <p className="text-sm text-muted-foreground mb-6">Enter your email and we&apos;ll send a reset link.</p>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive mb-4">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="fp-email">Email address</label>
          <input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">← Back to sign in</Link>
      </p>
    </div>
  );
}
