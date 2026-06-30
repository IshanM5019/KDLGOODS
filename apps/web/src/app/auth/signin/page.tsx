'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { SignInSchema } from '@kdlgoods/shared';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SigninPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    // Validate using @kdlgoods/shared
    const result = SignInSchema.safeParse({ email, password });
    if (!result.success) {
      const errorText = result.error.errors.map((err) => err.message).join(', ');
      setErrorMsg(errorText);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user returned from authentication.');

      // Fetch user profile to verify claims/role
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      // If the profile is missing in the database, fallback to the role from user metadata or 'customer'
      let role = data.user.user_metadata?.role || 'customer';
      if (!profileErr && profile) {
        role = profile.role;
      } else if (profileErr && profileErr.code !== 'PGRST116') {
        // Only throw if it's a real database error, not a "no rows returned" error (PGRST116)
        throw profileErr;
      }

      // Redirect depending on user role claim
      if (role === 'admin') {
        router.push('/admin/dashboard');
      } else if (role === 'seller') {
        router.push('/seller/dashboard');
      } else if (role === 'delivery') {
        router.push('/delivery/dashboard');
      } else {
        router.push('/customer/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'radial-gradient(circle at top, rgba(139, 92, 246, 0.15), transparent 60%)' }}>
      <div style={{ maxWidth: '400px', width: '100%' }} className="card glass">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Zap style={{ color: 'hsl(var(--primary))' }} size={32} />
            <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>KDLGOODS</span>
          </div>
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSignin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {errorMsg && (
            <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              {errorMsg}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Email Address</label>
            <input
              type="email"
              required
              className="input"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', gap: '0.5rem' }}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))' }}>
            Don't have an account?{' '}
            <Link href="/auth/signup" style={{ color: 'hsl(var(--primary))', textDecoration: 'none', fontWeight: 500 }}>
              Sign Up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
