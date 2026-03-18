'use client';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const error  = params.get('error');

  useEffect(() => { if (session) router.replace('/dashboard'); }, [session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-brand-900">
      <div className="w-full max-w-md p-8 rounded-2xl bg-white/10 backdrop-blur border border-white/20 shadow-2xl text-white">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-brand-500">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Electriva CSMS</h1>
            <p className="text-sm text-gray-300">Charging Management Platform</p>
          </div>
        </div>

        {error === 'unauthorized_domain' && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm text-center">
            Access restricted to @zivahgroup.com accounts only.
          </div>
        )}
        {error && error !== 'unauthorized_domain' && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm text-center">
            Authentication failed. Please try again.
          </div>
        )}

        <div className="text-center mb-6">
          <p className="text-gray-300 text-sm">Sign in with your Zivah Group account</p>
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors shadow-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-6 text-center text-xs text-gray-400">
          Only <strong>@zivahgroup.com</strong> accounts are permitted
        </p>
      </div>
    </div>
  );
}
