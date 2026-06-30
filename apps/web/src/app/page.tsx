'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { ShoppingBag, Store, MapPin, Zap, ShieldAlert, Award, Clock, Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let user = session?.user;
        if (!user) {
          const { data: { user: apiUser } } = await supabase.auth.getUser();
          user = apiUser || undefined;
        }

        if (user) {
          // Fetch user profile to verify role and redirect
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          
          const role = profile?.role || user.user_metadata?.role || 'customer';
          if (role === 'seller') {
            router.push('/seller/dashboard');
          } else if (role === 'delivery') {
            router.push('/delivery/dashboard');
          } else {
            router.push('/customer/dashboard');
          }
        } else {
          setCheckingAuth(false);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        setCheckingAuth(false);
      }
    };
    checkSession();
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white" style={{ backgroundColor: '#121212' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-yellow-500" size={32} />
          <p className="text-sm text-zinc-400">Restoring your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#121212' }}>
      {/* Navigation Header */}
      <header className="glass" style={{ position: 'sticky', top: 0, zIndex: 10, padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap style={{ color: '#F7D108' }} size={28} />
          <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#F7D108', letterSpacing: '-0.02em' }}>
            KDLGOODS
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(247,209,8,0.1)', border: '1px solid rgba(247,209,8,0.3)', borderRadius: '999px', padding: '0.4rem 0.9rem' }}>
          <MapPin size={14} style={{ color: '#F7D108' }} />
          <span style={{ color: '#F7D108', fontSize: '0.8rem', fontWeight: 600 }}>Kirandul, Dantewada</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <a
            href="#download"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', borderRadius: '0.5rem',
              background: 'rgba(247,209,8,0.12)', border: '1px solid rgba(247,209,8,0.35)',
              color: '#F7D108', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none',
            }}
          >
            📲 Download App
          </a>
          <Link href="/auth/signin" style={{ padding: '0.5rem 1.1rem', borderRadius: '0.5rem', border: '1px solid #2E2E2E', color: '#F5F5F5', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
            Sign In
          </Link>
          <Link href="/auth/signup" className="btn-primary" style={{ padding: '0.5rem 1.1rem' }}>
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, padding: '4rem 2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Hero Banner */}
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(247,209,8,0.1)', border: '1px solid rgba(247,209,8,0.3)', borderRadius: '999px', padding: '0.4rem 1rem', marginBottom: '1.5rem' }}>
            <Clock size={14} style={{ color: '#F7D108' }} />
            <span style={{ color: '#F7D108', fontSize: '0.8rem', fontWeight: 700 }}>NOW LIVE IN KIRANDUL, DANTEWADA</span>
          </div>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1.1, marginBottom: '1.5rem', color: '#F5F5F5' }}>
            Groceries &amp; Essentials<br />
            <span style={{ color: '#F7D108' }}>Delivered in 30 Minutes</span>
          </h1>
          <p style={{ color: '#8A8A8A', fontSize: '1.2rem', maxWidth: '660px', margin: '0 auto', lineHeight: 1.7 }}>
            KDLGOODS connects Kirandul residents with local stores within a strict <strong style={{ color: '#F7D108' }}>5&nbsp;km radius</strong> — real-time PostGIS geofencing ensures your 30-minute delivery promise, every time.
          </p>
        </div>

        {/* Multi-Tenant Selection Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '5rem' }}>
          {/* Customer Portal */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div>
              <div style={{ backgroundColor: 'rgba(247,209,8,0.1)', width: '56px', height: '56px', borderRadius: '1rem', display: 'grid', placeItems: 'center', marginBottom: '1.25rem' }}>
                <ShoppingBag style={{ color: '#F7D108' }} size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.6rem', color: '#F5F5F5' }}>Customer Portal</h2>
              <p style={{ color: '#8A8A8A', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Browse local stores, add items to your cart, and track your delivery rider on a live map — all within Kirandul&apos;s 5&nbsp;km SLA zone.
              </p>
              <ul style={{ marginTop: '1rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#B0B0B0', fontSize: '0.9rem' }}>
                  <MapPin size={14} style={{ color: '#F7D108', flexShrink: 0 }} /> Locked to 5 km nearest sellers
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#B0B0B0', fontSize: '0.9rem' }}>
                  <Zap size={14} style={{ color: '#F7D108', flexShrink: 0 }} /> Live cart &amp; instant checkout in ₹ INR
                </li>
              </ul>
            </div>
            <Link href="/auth/signup?role=customer" className="btn-primary" style={{ width: '100%', textDecoration: 'none' }}>
              Enter Customer App
            </Link>
          </div>

          {/* Seller Dashboard */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div>
              <div style={{ backgroundColor: 'rgba(34,197,94,0.1)', width: '56px', height: '56px', borderRadius: '1rem', display: 'grid', placeItems: 'center', marginBottom: '1.25rem' }}>
                <Store style={{ color: '#22C55E' }} size={28} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.6rem', color: '#F5F5F5' }}>Merchant / Seller Dashboard</h2>
              <p style={{ color: '#8A8A8A', lineHeight: 1.6, fontSize: '0.95rem' }}>
                Register your Kirandul store, upload product images, set ₹ INR prices, manage inventory, and accept delivery orders in real time.
              </p>
              <ul style={{ marginTop: '1rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0 }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#B0B0B0', fontSize: '0.9rem' }}>
                  <Award size={14} style={{ color: '#22C55E', flexShrink: 0 }} /> Manage catalog &amp; ₹ INR pricing
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#B0B0B0', fontSize: '0.9rem' }}>
                  <ShieldAlert size={14} style={{ color: '#22C55E', flexShrink: 0 }} /> Real-time order analytics board
                </li>
              </ul>
            </div>
            <Link href="/auth/signup?role=seller" style={{ width: '100%', textDecoration: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1.5px solid #22C55E', color: '#22C55E', fontWeight: 700, textAlign: 'center', display: 'block', transition: 'background 0.2s' }}>
              Register as Seller
            </Link>
          </div>
        </div>

        {/* ── Download the App Section ─────────────────────────────────────── */}
        <div
          id="download"
          style={{
            marginBottom: '5rem',
            borderRadius: '1.25rem',
            overflow: 'hidden',
            border: '1px solid #2E2E2E',
            background: 'linear-gradient(135deg, #1A1A1A 0%, #111 50%, #1A1200 100%)',
            position: 'relative',
          }}
        >
          {/* Decorative glow */}
          <div style={{
            position: 'absolute', top: '-60px', right: '-60px', width: '240px', height: '240px',
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(247,209,8,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', padding: '3rem 2.5rem' }}>
            {/* Left: Copy */}
            <div style={{ flex: '1 1 320px', position: 'relative' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: 'rgba(247,209,8,0.12)', border: '1px solid rgba(247,209,8,0.3)',
                borderRadius: '999px', padding: '0.35rem 0.9rem', marginBottom: '1.25rem',
                color: '#F7D108', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.04em',
              }}>
                📱 MOBILE APP — ANDROID
              </span>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#F5F5F5', lineHeight: 1.15, marginBottom: '1rem' }}>
                Shop on the Go.<br />
                <span style={{ color: '#F7D108' }}>Download the App.</span>
              </h2>
              <p style={{ color: '#8A8A8A', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.75rem', maxWidth: '480px' }}>
                Get the full KDLGOODS experience on your Android phone — browse stores, tap to order groceries, track your rider live, and pay cash on delivery. No Play Store needed.
              </p>

              {/* Feature pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '2rem' }}>
                {['⚡ 30-Min Delivery', '📸 Product Photos', '🛒 Live Cart', '💵 Cash on Delivery', '🗺️ Rider Tracking'].map(f => (
                  <span key={f} style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid #2E2E2E',
                    borderRadius: '999px', padding: '0.3rem 0.75rem', color: '#B0B0B0',
                    fontSize: '0.8rem', fontWeight: 600,
                  }}>{f}</span>
                ))}
              </div>

              {/* Download buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                {/* Primary APK download */}
                <a
                  href="/kdlgoods.apk"
                  download="kdlgoods.apk"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    background: '#F7D108', color: '#121212',
                    padding: '0.85rem 1.5rem', borderRadius: '0.75rem',
                    fontWeight: 800, fontSize: '0.95rem', textDecoration: 'none',
                    boxShadow: '0 4px 24px rgba(247,209,8,0.25)',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>⬇️</span>
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.7 }}>Download for</div>
                    <div style={{ fontSize: '1rem', fontWeight: 900 }}>Android (.apk)</div>
                  </div>
                </a>

                {/* QR hint */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '0.6rem',
                    background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
                    fontSize: '1.6rem',
                  }}>
                    📲
                  </div>
                  <div>
                    <p style={{ color: '#F5F5F5', fontSize: '0.82rem', fontWeight: 700, margin: 0 }}>Scan QR after build</p>
                    <p style={{ color: '#555', fontSize: '0.75rem', margin: 0 }}>or install the .apk directly</p>
                  </div>
                </div>
              </div>

              {/* Install tip */}
              <p style={{ marginTop: '1.25rem', color: '#555', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>ℹ️</span>
                On Android, enable <strong style={{ color: '#8A8A8A' }}>&ldquo;Install from unknown sources&rdquo;</strong> in Settings before installing.
              </p>
            </div>

            {/* Right: App preview card */}
            <div style={{ flex: '0 1 260px', display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: '220px',
                background: '#121212',
                borderRadius: '2rem',
                border: '6px solid #2E2E2E',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px #1A1A1A',
                overflow: 'hidden',
              }}>
                {/* Notch */}
                <div style={{ height: '28px', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '60px', height: '8px', background: '#2E2E2E', borderRadius: '999px' }} />
                </div>
                {/* Status bar */}
                <div style={{ background: '#121212', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#F5F5F5', fontSize: '9px', fontWeight: 800 }}>⚡ KDLGOODS</span>
                  <span style={{ color: '#8A8A8A', fontSize: '9px' }}>🛒</span>
                </div>
                {/* App screen mock */}
                <div style={{ background: '#1A1A1A', padding: '10px' }}>
                  {/* Store card mock */}
                  <div style={{ background: '#222', borderRadius: '8px', padding: '10px', marginBottom: '8px', border: '1px solid #2E2E2E' }}>
                    <div style={{ color: '#F7D108', fontSize: '10px', fontWeight: 900, marginBottom: '3px' }}>Kirandul Store ⚡</div>
                    <div style={{ color: '#8A8A8A', fontSize: '8px', marginBottom: '6px' }}>📍 0.4 km away</div>
                    <div style={{ background: '#F7D108', borderRadius: '4px', padding: '4px', textAlign: 'center' }}>
                      <span style={{ color: '#121212', fontSize: '8px', fontWeight: 900 }}>Browse Menu →</span>
                    </div>
                  </div>
                  {/* Product grid mock */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[
                      { name: 'Rice (5kg)', price: '₹280', emoji: '🌾' },
                      { name: 'Toor Dal', price: '₹120', emoji: '🫘' },
                      { name: 'Cooking Oil', price: '₹160', emoji: '🛢️' },
                      { name: 'Sugar', price: '₹55', emoji: '🍬' },
                    ].map(p => (
                      <div key={p.name} style={{ background: '#2A2A2A', borderRadius: '6px', padding: '8px', border: '1px solid #2E2E2E' }}>
                        <div style={{ fontSize: '18px', textAlign: 'center', marginBottom: '3px' }}>{p.emoji}</div>
                        <div style={{ color: '#F5F5F5', fontSize: '7px', fontWeight: 700, textAlign: 'center', marginBottom: '2px' }}>{p.name}</div>
                        <div style={{ color: '#F7D108', fontSize: '8px', fontWeight: 900, textAlign: 'center', marginBottom: '5px' }}>{p.price}</div>
                        <div style={{ background: '#F7D108', borderRadius: '3px', padding: '2px', textAlign: 'center' }}>
                          <span style={{ color: '#121212', fontSize: '7px', fontWeight: 900 }}>+ Add</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Cart bar mock */}
                  <div style={{ background: '#F7D108', borderRadius: '6px', padding: '8px 10px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#121212', fontSize: '8px', fontWeight: 900 }}>🛒 3 items</span>
                    <span style={{ color: '#121212', fontSize: '8px', fontWeight: 900 }}>₹655 →</span>
                  </div>
                </div>
                {/* Home bar */}
                <div style={{ background: '#0A0A0A', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '40px', height: '4px', background: '#2E2E2E', borderRadius: '999px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLA Architecture Explainer */}
        <div className="glass" style={{ borderRadius: 'var(--radius)', padding: '2rem', display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 300px' }}>
            <span style={{ background: 'rgba(247,209,8,0.12)', color: '#F7D108', fontSize: '0.75rem', fontWeight: 700, padding: '0.3rem 0.75rem', borderRadius: '999px', marginBottom: '1rem', display: 'inline-block' }}>
              Engineering SLA
            </span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1rem', color: '#F5F5F5' }}>How We Guarantee 30 Minutes</h3>
            <p style={{ color: '#8A8A8A', lineHeight: 1.7, marginBottom: '1rem', fontSize: '0.95rem' }}>
              Our system runs PostgreSQL spatial searches using <strong style={{ color: '#F5F5F5' }}>PostGIS</strong>, matching customer GPS coordinates against GIST spatial indices on seller locations — restricting results to within <strong style={{ color: '#F7D108' }}>5 km of Kirandul, Dantewada</strong>:
            </p>
            <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '0.82rem', color: '#F7D108', border: '1px solid #2E2E2E' }}>
              SELECT * FROM sellers <br />
              WHERE ST_DWithin(location,<br />
              &nbsp;&nbsp;ST_MakePoint(81.7074, 18.8728)::geography, 5000)
            </code>
          </div>
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ color: '#F7D108', flexShrink: 0 }}><Zap size={24} /></div>
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#F5F5F5' }}>Automated Geohashes</h4>
                <p style={{ color: '#8A8A8A', fontSize: '0.9rem', lineHeight: 1.6 }}>Seller coordinates are encoded into base-32 geohashes via database triggers for ultra-fast cache-level proximity matching.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ color: '#22C55E', flexShrink: 0 }}><ShieldAlert size={24} /></div>
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#F5F5F5' }}>Row-Level Security (RLS)</h4>
                <p style={{ color: '#8A8A8A', fontSize: '0.9rem', lineHeight: 1.6 }}>Tenants are fully isolated. Sellers never access competitor sales data or customer contact details.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #2E2E2E', padding: '1.5rem 2rem', textAlign: 'center', color: '#8A8A8A', fontSize: '0.85rem' }}>
        KDLGOODS — Hyper-Local Delivery for Kirandul, Dantewada, Chhattisgarh. Powered by Next.js &amp; Supabase.
        <span style={{ margin: '0 0.75rem', opacity: 0.3 }}>|</span>
        <a href="#download" style={{ color: '#F7D108', textDecoration: 'none', fontWeight: 600 }}>📲 Download Android App</a>
      </footer>
    </div>
  );
}
