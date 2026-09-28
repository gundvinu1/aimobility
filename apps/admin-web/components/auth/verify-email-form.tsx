'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Zap, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function VerifyEmailInner() {
  const params = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = params.get('token');
    if (t) { setToken(t); void verify(t); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async (t: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: { message?: string } };
        throw new Error(json.error?.message ?? 'Verification failed');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); void verify(token); };

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div><p className="text-sm font-bold text-foreground">AI-MOS</p><p className="text-xs text-muted-foreground">Email verification</p></div>
      </div>

      {done ? (
        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto mb-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Email verified!</h1>
          <p className="text-sm text-muted-foreground mb-6">Your email address has been confirmed.</p>
          <Link href="/dashboard" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">Go to dashboard →</Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-foreground mb-1">Verify your email</h1>
          <p className="text-sm text-muted-foreground mb-6">Enter your verification token below or click the link from your email.</p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive mb-4">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="ve-token">Verification token</label>
              <input id="ve-token" type="text" required value={token} onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from email"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Verifying…' : 'Verify email'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export function VerifyEmailForm() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-border bg-card p-8 animate-pulse h-64" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
