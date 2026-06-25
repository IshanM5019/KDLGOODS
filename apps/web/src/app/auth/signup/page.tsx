'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { SignUpSchema } from '@kdlgoods/shared';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [role, setRole] = useState<'customer' | 'seller' | 'delivery'>(
    (searchParams.get('role') as any) || 'customer'
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    // Validate using @kdlgoods/shared Zod schema
    const result = SignUpSchema.safeParse({
      email,
      password,
      full_name: fullName,
      role,
      phone_number: phone || null,
    });

    if (!result.success) {
      const errorText = result.error.errors.map((err) => err.message).join(', ');
      setErrorMsg(errorText);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role,
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      setSuccessMsg('Registration successful! Please check your email for a confirmation link.');
      setTimeout(() => {
        router.push('/auth/signin');
      }, 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '450px', width: '100%', margin: 'auto' }} className="card glass">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Zap style={{ color: 'hsl(var(--primary))' }} size={32} />
          <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>KDLGOODS</span>
        </div>
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>Create your multi-tenant account</p>
      </div>

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {errorMsg && (
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.9rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            {successMsg}
          </div>
        )}

        {/* Role Selection Tabs */}
        <div>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem', color: 'hsl(var(--muted-foreground))' }}>Choose Account Type</label>
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setRole('customer')}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: role === 'customer' ? '#F7D108' : 'transparent',
                color: role === 'customer' ? '#121212' : '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => setRole('seller')}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: role === 'seller' ? '#F7D108' : 'transparent',
                color: role === 'seller' ? '#121212' : '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Seller
            </button>
            <button
              type="button"
              onClick={() => setRole('delivery')}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: role === 'delivery' ? '#F7D108' : 'transparent',
                color: role === 'delivery' ? '#121212' : '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Delivery Partner
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Full Name</label>
          <input
            type="text"
            required
            className="input"
            placeholder="Ramesh Kumar"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

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
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Phone Number (Optional)</label>
          <input
            type="tel"
            className="input"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
              <Loader2 className="animate-spin" size={18} /> Registering...
            </>
          ) : (
            'Sign Up'
          )}
        </button>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))' }}>
          Already have an account?{' '}
          <Link href="/auth/signin" style={{ color: 'hsl(var(--primary))', textDecoration: 'none', fontWeight: 500 }}>
            Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'radial-gradient(circle at top, rgba(247, 209, 8, 0.08), transparent 60%)', backgroundColor: '#121212' }}>
      <Suspense fallback={<div style={{ color: '#F7D108' }}>Loading...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
