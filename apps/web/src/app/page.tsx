'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, Store, MapPin, Zap, ShieldAlert, Award, Clock } from 'lucide-react';

export default function HomePage() {
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
        <div style={{ display: 'flex', gap: '0.75rem' }}>
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
            Groceries & Essentials<br />
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
      </footer>
    </div>
  );
}
