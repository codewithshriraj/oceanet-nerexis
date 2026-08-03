'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useNotificationStore } from '@/store/notificationStore';
import { apiFetch } from '@/utils/api';

export default function SignInPage() {
  const router = useRouter();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loginType, setLoginType] = useState<'admin' | 'general'>('general');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'signin' ? '/auth/signin' : '/auth/signup';
      const payload =
        mode === 'signin'
          ? { email, password, login_type: loginType }
          : {
              name,
              email,
              password,
              login_type: loginType,
              admin_key: loginType === 'admin' ? adminKey : null,
            };

      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: 10000,
        retryOnTimeout: false,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Authentication failed');
      }

      const data = await response.json();
      document.cookie = `nerexis_auth_token=${data.token}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      document.cookie = `nerexis_user_email=${encodeURIComponent(data.user.email)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      document.cookie = `nerexis_user_role=${encodeURIComponent(data.user.role || 'general')}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      
      // Show success notification
      const messageType = mode === 'signin' ? 'successfully logged in' : 'account created successfully';
      addNotification({
        message: `Welcome ${data.user.name}! You've ${messageType}.`,
        type: 'success',
        duration: 3000,
      });

      // Redirect after a brief delay to show notification
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 500);
    } catch (err) {
      const errorMsg = err instanceof TypeError
        ? 'Unable to reach authentication server. Please ensure backend is running.'
        : err instanceof Error
          ? err.message
          : 'Authentication failed';
      setError(errorMsg);
      addNotification({
        message: errorMsg,
        type: 'error',
        duration: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-ocean-gradient flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl rounded-3xl border border-white border-opacity-15 bg-white bg-opacity-95 shadow-glow overflow-hidden"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 w-full">
          <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary via-secondary to-bioluminescent p-10 text-white">
            <div>
              {!logoFailed ? (
                <img
                  src="/assets/nerexis-logo.png"
                  alt="Nerexis"
                  className="h-[64px] xl:h-[96px] w-auto max-w-[320px] xl:max-w-[520px] object-contain"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <p className="text-sm tracking-[0.28em] uppercase text-white text-opacity-80">Nerexis Platform</p>
              )}
              <h2 className="text-4xl font-bold mt-4 leading-tight">Integrated Environmental Intelligence.</h2>
              <p className="mt-4 text-white text-opacity-85 text-sm leading-relaxed max-w-sm">
                A scalable AI platform for multimodal environmental data fusion and predictive ecosystem intelligence.
              </p>
            </div>

            <div className="space-y-3">
              {[
                'Live global marine risk monitoring',
                'Automated 15-second analytics refresh',
                'Integrated reporting and insights',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-white bg-opacity-15 px-4 py-3 border border-white border-opacity-20">
                  <span className="h-2.5 w-2.5 rounded-full bg-white" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 sm:p-10 w-full flex flex-col items-center justify-center">
            <div className="w-full max-w-sm">
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.22em] text-text-secondary font-semibold">Secure Access</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mt-2">{mode === 'signin' ? 'Welcome back' : 'Create account'}</h1>
              <p className="text-text-secondary mt-2">
                {mode === 'signin' ? 'Sign in to continue to your Nerexis dashboard.' : 'Set up your account to start working with live environmental data.'}
              </p>
            </div>

            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.18em] text-text-secondary font-semibold mb-2">Login Type</p>
              <div className="flex rounded-xl bg-deep-twilight bg-opacity-70 p-1 border border-white border-opacity-20">
                <button
                  type="button"
                  onClick={() => setLoginType('general')}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                    loginType === 'general'
                      ? 'bg-white text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  General Login
                </button>
                <button
                  type="button"
                  onClick={() => setLoginType('admin')}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                    loginType === 'admin'
                      ? 'bg-white text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Admin Login
                </button>
              </div>
            </div>

            <div className="flex rounded-xl bg-deep-twilight bg-opacity-70 p-1 mb-6 border border-white border-opacity-20">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${{
                  signin: 'bg-white text-text-primary shadow-sm',
                  signup: 'text-text-secondary hover:text-text-primary',
                }[mode]}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${{
                  signup: 'bg-white text-text-primary shadow-sm',
                  signin: 'text-text-secondary hover:text-text-primary',
                }[mode]}`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Full Name</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-deep-twilight bg-white px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-bioluminescent focus:border-bioluminescent"
                    placeholder="Your full name"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-deep-twilight bg-white px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-bioluminescent focus:border-bioluminescent"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-deep-twilight bg-white px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-bioluminescent focus:border-bioluminescent"
                  placeholder="Minimum 8 characters"
                />
              </div>

              {mode === 'signup' && loginType === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Admin Key</label>
                  <input
                    required
                    type="password"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    className="w-full rounded-xl border border-deep-twilight bg-white px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-bioluminescent focus:border-bioluminescent"
                    placeholder="Enter admin signup key"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-neon-coral border-opacity-40 bg-neon-coral bg-opacity-10 px-3 py-2">
                  <p className="text-sm text-neon-coral">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-secondary py-3 font-semibold text-white shadow-glow disabled:opacity-70"
              >
                {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 border-t border-deep-twilight/15 pt-5 text-sm leading-6 text-text-secondary">
              <p>
                By continuing, you agree to the platform <Link href="/terms" className="font-semibold text-cyan hover:text-text-primary">Terms of Use</Link> and acknowledge the <Link href="/privacy" className="font-semibold text-cyan hover:text-text-primary">Privacy Notice</Link>.
              </p>
              <p className="mt-2">
                Need a direct contact route? Visit <Link href="/contact" className="font-semibold text-cyan hover:text-text-primary">Contact</Link>.
              </p>
            </div>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
